<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/Chat.php';
require_once __DIR__ . '/../models/Message.php';
require_once __DIR__ . '/../models/ChatParticipant.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Ad.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/EmailService.php';
require_once __DIR__ . '/../utils/UploadHelper.php';

class ChatController {
    private $db;
    private $authMiddleware;

    private static $supportColsChecked = false;
    private static $dealsTableChecked = false;
    private static $dealsTableExists = false;
    private static $dealsColumns = null;
    private static $dealsSummaryCache = [];

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->authMiddleware = new AuthMiddleware();
        
        // Ensure support_requested columns exist on chats table (only check once per process)
        if (!self::$supportColsChecked) {
            self::$supportColsChecked = true;
            try {
                $check = $this->db->query("SHOW COLUMNS FROM chats LIKE 'support_requested'");
                if (!$check->fetch()) {
                    $this->db->exec("ALTER TABLE chats ADD COLUMN support_requested TINYINT(1) DEFAULT 0");
                    $this->db->exec("ALTER TABLE chats ADD COLUMN support_requested_at DATETIME NULL");
                }
            } catch (Exception $e) {
                error_log('Error adding support_requested columns: ' . $e->getMessage());
            }

            // Cleanup: ensure all automated deal/system messages have isRead = 1 in database
            try {
                $this->db->exec("
                    UPDATE messages 
                    SET isRead = 1 
                    WHERE isRead = 0 
                      AND (
                          messageType IN ('system', 'deal_card', 'deal_event', 'deal', 'escrow')
                          OR content LIKE '%Transaction ID:%'
                          OR content LIKE '%Deal Initiated%'
                      )
                ");
            } catch (Throwable $e) {}
        }
    }

    /**
     * Unified, robust authorization check for chat access.
     * Auto-activates participants if they belong to a linked deal or ad.
     */
    public function ensureUserCanAccessChat($chatId, $userId, $user = null) {
        $adminEmail = getenv('ADMIN_EMAIL');
        $isStaff = ($adminEmail && !empty($user['email']) && strtolower($user['email']) === strtolower($adminEmail))
            || !empty($user['isAdmin'])
            || in_array($user['role'] ?? '', ['admin', 'manager', 'agent', 'viewer']);

        if ($isStaff) {
            return true;
        }

        // 1. Check if user is an active participant
        $stmt = $this->db->prepare("
            SELECT id FROM chat_participants
            WHERE chatId = ? AND userId = ? AND isActive = 1
        ");
        $stmt->execute([$chatId, $userId]);
        if ($stmt->fetch()) {
            return true;
        }

        // 2. Check if user has an existing participant row marked inactive — reactivate!
        $stmtInactive = $this->db->prepare("
            SELECT id FROM chat_participants
            WHERE chatId = ? AND userId = ?
        ");
        $stmtInactive->execute([$chatId, $userId]);
        if ($stmtInactive->fetch()) {
            $this->db->prepare("
                UPDATE chat_participants SET isActive = 1 WHERE chatId = ? AND userId = ?
            ")->execute([$chatId, $userId]);
            return true;
        }

        // A user's own prior message is authoritative evidence of membership.
        $messageCheck = $this->db->prepare("
            SELECT 1 FROM messages WHERE chatId = ? AND senderId = ? LIMIT 1
        ");
        $messageCheck->execute([$chatId, $userId]);
        if ($messageCheck->fetchColumn()) {
            $this->db->prepare("
                INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                VALUES (?, ?, 'member', NOW(), 1)
                ON DUPLICATE KEY UPDATE isActive = 1
            ")->execute([$chatId, $userId]);
            return true;
        }

        // 3. Check if chat belongs to a deal where user is buyer or seller
        $dealCheck = $this->db->prepare("
            SELECT id, buyer_id, seller_id FROM deals
            WHERE chat_id = ? AND (buyer_id = ? OR seller_id = ?)
            LIMIT 1
        ");
        $dealCheck->execute([$chatId, $userId, $userId]);
        $deal = $dealCheck->fetch(PDO::FETCH_ASSOC);
        if ($deal) {
            $this->db->prepare("
                INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                VALUES (?, ?, 'member', NOW(), 1)
                ON DUPLICATE KEY UPDATE isActive = 1
            ")->execute([$chatId, $userId]);
            return true;
        }

        // 4. Check if chat belongs to an ad where user is the seller
        $chatCheck = $this->db->prepare("
            SELECT c.adId, a.userId as adSellerId
            FROM chats c
            LEFT JOIN ads a ON c.adId = a.id
            WHERE c.id = ?
        ");
        $chatCheck->execute([$chatId]);
        $chatRow = $chatCheck->fetch(PDO::FETCH_ASSOC);
        if ($chatRow && !empty($chatRow['adSellerId']) && (int)$chatRow['adSellerId'] === (int)$userId) {
            $this->db->prepare("
                INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                VALUES (?, ?, 'member', NOW(), 1)
                ON DUPLICATE KEY UPDATE isActive = 1
            ")->execute([$chatId, $userId]);
            return true;
        }

        return false;
    }

    // Get all chats for a user (optimized: batch queries, no N+1, no quadratic joins)
    public function getUserChats() {
        try {
            $user = $this->authMiddleware->authenticate();
            $userId = (int)$user['id'];

            require_once __DIR__ . '/../utils/SystemUser.php';
            $systemUserId = function_exists('getSystemUserId') ? (int)getSystemUserId($this->db) : 1;

            // Restore inbox membership only for chats this user has personally messaged in.
            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT DISTINCT m.chatId, m.senderId, 'member', NOW(), 1
                    FROM messages m
                    WHERE m.senderId = ?
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$userId]);
            } catch (Throwable $ignore) {}

            // Auto-heal missing or inactive chat_participants for any linked deals for this user
            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT d.chat_id, ?, 'member', NOW(), 1
                    FROM deals d
                    WHERE d.chat_id IS NOT NULL 
                      AND (d.buyer_id = ? OR d.seller_id = ?)
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$userId, $userId, $userId]);
            } catch (Throwable $ignore) {}

            // Auto-heal: also ensure the counterparty (buyer/seller) is an active participant in each deal chat
            // This repairs cases where the initial deal creation's participant INSERT failed or was skipped
            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT d.chat_id, d.buyer_id, 'member', NOW(), 1
                    FROM deals d
                    WHERE d.chat_id IS NOT NULL AND d.seller_id = ?
                      AND d.buyer_id IS NOT NULL AND d.buyer_id > 0
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$userId]);
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT d.chat_id, d.seller_id, 'member', NOW(), 1
                    FROM deals d
                    WHERE d.chat_id IS NOT NULL AND d.buyer_id = ?
                      AND d.seller_id IS NOT NULL AND d.seller_id > 0
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$userId]);
            } catch (Throwable $ignore) {}

            // Auto-heal missing or inactive chat_participants for any linked ads for this seller
            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT c.id, ?, 'member', NOW(), 1
                    FROM chats c
                    INNER JOIN ads a ON c.adId = a.id AND a.userId = ?
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$userId, $userId]);
            } catch (Throwable $ignore) {}

            // Fast indexed query: avoids quadratic self-join on messages
            // System messages, deal cards/events are strictly excluded from unread counts.
            $stmt = $this->db->prepare("
                SELECT DISTINCT c.*,
                       a.id as ad_id, a.title as ad_title, a.price as ad_price, a.userId as ad_seller_id,
                       (SELECT COUNT(*) FROM messages um 
                        WHERE um.chatId = c.id 
                          AND um.senderId != ? 
                          AND um.senderId IS NOT NULL 
                          AND um.senderId != 0 
                          AND (um.messageType IS NULL OR um.messageType NOT IN ('system', 'deal_card', 'deal_event', 'deal', 'escrow'))
                          AND um.content NOT LIKE '%Transaction ID:%'
                          AND um.content NOT LIKE '%Deal Initiated%'
                          AND um.isRead = 0) as unread_count
                FROM chats c
                LEFT JOIN chat_participants cp ON c.id = cp.chatId AND cp.userId = ?
                LEFT JOIN ads a ON c.adId = a.id
                WHERE (cp.isActive = 1)
                   OR c.id IN (SELECT chat_id FROM deals WHERE (buyer_id = ? OR seller_id = ?) AND chat_id IS NOT NULL)
                   OR (c.adId IS NOT NULL AND c.adId IN (SELECT id FROM ads WHERE userId = ?))
                ORDER BY COALESCE(c.lastMessageTime, c.updatedAt, c.createdAt) DESC
            ");
            $stmt->execute([$userId, $userId, $userId, $userId, $userId]);
            $chats = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($chats)) {
                http_response_code(200);
                echo json_encode([]);
                return;
            }

            $chatIds = array_map(function($c) { return (int)$c['id']; }, $chats);
            $chatIdsStr = implode(',', $chatIds);

            // 1. Batch fetch all participants for all user's chats in ONE query
            $pStmt = $this->db->query("
                SELECT cp.chatId, cp.userId, cp.role, u.id as user_id, u.username, u.email, u.profilePicture
                FROM chat_participants cp
                INNER JOIN users u ON cp.userId = u.id
                WHERE cp.chatId IN ($chatIdsStr) AND cp.isActive = 1
            ");
            $allParticipants = $pStmt->fetchAll(PDO::FETCH_ASSOC);
            $participantsByChat = [];
            foreach ($allParticipants as $p) {
                $participantsByChat[(int)$p['chatId']][] = $p;
            }

            // 2. Batch fetch latest message sender for each chat in ONE query
            $latestMsgStmt = $this->db->query("
                SELECT m.chatId, m.content, m.createdAt,
                       u.id as sender_id, u.username as sender_username, u.profilePicture as sender_profilePicture
                FROM messages m
                INNER JOIN (
                    SELECT chatId, MAX(id) as max_id
                    FROM messages
                    WHERE chatId IN ($chatIdsStr)
                    GROUP BY chatId
                ) latest ON m.id = latest.max_id
                INNER JOIN users u ON m.senderId = u.id
            ");
            $latestMessagesByChat = [];
            foreach ($latestMsgStmt->fetchAll(PDO::FETCH_ASSOC) as $lm) {
                $latestMessagesByChat[(int)$lm['chatId']] = $lm;
            }

            $result = [];

            foreach ($chats as $chat) {
                $cId = (int)$chat['id'];
                $participants = $participantsByChat[$cId] ?? [];

                $otherParticipants = array_values(array_filter($participants, function($p) use ($userId) {
                    $pUid = (int)($p['userId'] ?? $p['user_id'] ?? 0);
                    return $pUid > 0 && $pUid !== $userId;
                }));

                // Fallback: If otherParticipants is empty, resolve counterparty from deal or ad
                if (empty($otherParticipants)) {
                    try {
                        $dealCheck = $this->db->prepare("SELECT buyer_id, seller_id FROM deals WHERE chat_id = ? ORDER BY id DESC LIMIT 1");
                        $dealCheck->execute([$cId]);
                        $dealRow = $dealCheck->fetch(PDO::FETCH_ASSOC);
                        if ($dealRow) {
                            $bId = (int)$dealRow['buyer_id'];
                            $sId = (int)$dealRow['seller_id'];
                            $otherId = ($userId === $bId) ? $sId : $bId;
                            if ($otherId > 0) {
                                $uStmt = $this->db->prepare("SELECT id as user_id, id as userId, username, email, profilePicture FROM users WHERE id = ?");
                                $uStmt->execute([$otherId]);
                                $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                                if ($uRow) {
                                    $otherParticipants[] = $uRow;
                                }
                            }
                        }
                    } catch (Throwable $ignore) {}

                    if (empty($otherParticipants) && !empty($chat['ad_id'])) {
                        try {
                            $adStmt = $this->db->prepare("SELECT u.id as user_id, u.id as userId, u.username, u.email, u.profilePicture FROM ads a INNER JOIN users u ON a.userId = u.id WHERE a.id = ?");
                            $adStmt->execute([(int)$chat['ad_id']]);
                            $adSeller = $adStmt->fetch(PDO::FETCH_ASSOC);
                            if ($adSeller && (int)$adSeller['user_id'] !== $userId) {
                                $otherParticipants[] = $adSeller;
                            }
                        } catch (Throwable $ignore) {}
                    }
                }

                $buyerUserId = null;
                $sellerUserId = null;
                if (!empty($chat['ad_id'])) {
                    $sellerUserId = !empty($chat['ad_seller_id']) ? (int)$chat['ad_seller_id'] : null;
                    foreach ($participants as $p) {
                        if ((int)$p['user_id'] !== $sellerUserId) {
                            $buyerUserId = (int)$p['user_id'];
                            break;
                        }
                    }
                } else {
                    $dealCheck = $this->db->prepare("SELECT buyer_id, seller_id FROM deals WHERE chat_id = ? ORDER BY id DESC LIMIT 1");
                    $dealCheck->execute([$cId]);
                    $dealRow = $dealCheck->fetch(PDO::FETCH_ASSOC);
                    if ($dealRow) {
                        $buyerUserId = (int)$dealRow['buyer_id'];
                        $sellerUserId = (int)$dealRow['seller_id'];
                    }
                }

                $latestMsg = $latestMessagesByChat[$cId] ?? null;
                $lastMsgContent = $latestMsg ? $latestMsg['content'] : ($chat['lastMessage'] ?? null);
                $lastMsgTime = $latestMsg ? $latestMsg['createdAt'] : ($chat['lastMessageTime'] ?? null);

                $chatData = [
                    'id' => $cId,
                    'type' => $chat['type'],
                    'name' => $chat['name'],
                    'adId' => $chat['ad_id'] ? (int)$chat['ad_id'] : null,
                    'support_requested' => isset($chat['support_requested']) ? (bool)$chat['support_requested'] : false,
                    'support_requested_at' => $chat['support_requested_at'] ?? null,
                    'lastMessage' => $lastMsgContent,
                    'lastMessageTime' => $lastMsgTime,
                    'createdAt' => $chat['createdAt'],
                    'updatedAt' => $chat['updatedAt'],
                    'unread_count' => (int)($chat['unread_count'] ?? 0),
                    'buyerUserId' => $buyerUserId,
                    'sellerUserId' => $sellerUserId,
                    'participants' => array_map(function($p) {
                        return [
                            'userId' => (int)$p['userId'],
                            'role' => $p['role'],
                            'user' => [
                                'id' => (int)$p['user_id'],
                                'username' => $p['username'],
                                'email' => $p['email'],
                                'profilePicture' => $p['profilePicture'] ?? null
                            ]
                        ];
                    }, $participants),
                    'otherParticipants' => array_map(function($p) {
                        return [
                            'id' => (int)$p['user_id'],
                            'username' => $p['username'],
                            'email' => $p['email'],
                            'profilePicture' => $p['profilePicture'] ?? null
                        ];
                    }, $otherParticipants),
                    'messages' => $latestMsg ? [[
                        'content' => $latestMsg['content'],
                        'createdAt' => $latestMsg['createdAt'],
                        'sender' => [
                            'id' => (int)$latestMsg['sender_id'],
                            'username' => $latestMsg['sender_username'],
                            'profilePicture' => $latestMsg['sender_profilePicture'] ?? null
                        ]
                    ]] : [],
                    'ad' => $chat['ad_id'] ? [
                        'id' => (int)$chat['ad_id'],
                        'title' => $chat['ad_title'],
                        'price' => (float)$chat['ad_price']
                    ] : null
                ];

                if (!empty($otherParticipants)) {
                    $chatData['dealSummary'] = $this->getDealSummaryForUserPair(
                        $userId,
                        (int)$otherParticipants[0]['user_id']
                    );
                }

                $result[] = $chatData;
            }

            http_response_code(200);
            echo json_encode($result);
        } catch (Exception $e) {
            error_log('Error fetching user chats: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }


    // Get single chat by ID
    public function getChatById($chatId) {
        try {
            $user = $this->authMiddleware->authenticate();
            $userId = (int)$user['id'];

            if (!$this->ensureUserCanAccessChat($chatId, $userId, $user)) {
                http_response_code(403);
                echo json_encode(['message' => 'Access denied']);
                return;
            }

            $result = $this->buildChatResponse($chatId, $userId);

            if (!$result || empty($result['id'])) {
                http_response_code(404);
                echo json_encode(['message' => 'Chat not found']);
                return;
            }

            http_response_code(200);
            echo json_encode($result);
        } catch (Exception $e) {
            error_log('Error fetching chat by ID: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Create or get existing direct/group chat
    public function createOrGetChat() {
        try {
            $user = $this->authMiddleware->authenticate();
            $input = json_decode(file_get_contents('php://input'), true);

            $participantId = (int)($input['participantId'] ?? 0);
            $adId = isset($input['adId']) ? (int)$input['adId'] : null;
            $type = $input['type'] ?? 'direct';
            $currentUserId = (int)$user['id'];

            if (!$participantId) {
                http_response_code(400);
                echo json_encode(['message' => 'Participant ID is required']);
                return;
            }

            if ($participantId === $currentUserId) {
                http_response_code(400);
                echo json_encode(['message' => 'Cannot create chat with yourself']);
                return;
            }

            // Ban check: Banned users can ONLY start chats with Admin/Support/Manager
            if (!empty($user['isBanned'])) {
                $targetStmt = $this->db->prepare("SELECT id, email, isAdmin, role FROM users WHERE id = ?");
                $targetStmt->execute([$participantId]);
                $targetUser = $targetStmt->fetch(PDO::FETCH_ASSOC);

                $adminEmail = getenv('ADMIN_EMAIL');
                $isTargetStaff = false;
                if ($targetUser) {
                    $isTargetStaff = (!empty($adminEmail) && strtolower($targetUser['email']) === strtolower($adminEmail))
                                  || !empty($targetUser['isAdmin'])
                                  || in_array($targetUser['role'] ?? '', ['admin', 'manager', 'agent']);
                }

                if (!$isTargetStaff) {
                    http_response_code(403);
                    echo json_encode([
                        'message' => 'Your account is restricted. Banned users can only contact Support/Admin.',
                        'banned' => true,
                        'restricted' => true
                    ]);
                    return;
                }
            }

            // Reuse the pair's existing chat even if either participant was deactivated.
            if ($type === 'direct') {
                $stmt = $this->db->prepare("
                    SELECT c.*
                    FROM chats c
                    WHERE c.type IN ('direct', 'ad_inquiry')
                    AND (
                        EXISTS (SELECT 1 FROM chat_participants cp1 WHERE cp1.chatId = c.id AND cp1.userId = ?)
                        OR EXISTS (SELECT 1 FROM messages m1 WHERE m1.chatId = c.id AND m1.senderId = ?)
                    )
                    AND (
                        EXISTS (SELECT 1 FROM chat_participants cp2 WHERE cp2.chatId = c.id AND cp2.userId = ?)
                        OR EXISTS (SELECT 1 FROM messages m2 WHERE m2.chatId = c.id AND m2.senderId = ?)
                    )
                    ORDER BY c.updatedAt DESC, c.createdAt DESC
                    LIMIT 1
                ");
                $stmt->execute([$currentUserId, $currentUserId, $participantId, $participantId]);
                $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($existingChat) {
                    $this->db->prepare("
                        INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                        VALUES (?, ?, 'member', NOW(), 1), (?, ?, 'member', NOW(), 1)
                        ON DUPLICATE KEY UPDATE isActive = 1
                    ")->execute([(int)$existingChat['id'], $currentUserId, (int)$existingChat['id'], $participantId]);
                    http_response_code(200);
                    echo json_encode($this->buildChatResponse((int)$existingChat['id'], $currentUserId, $participantId));
                    return;
                }
            }

            $this->db->beginTransaction();
            $stmt = $this->db->prepare("
                INSERT INTO chats (type, adId, name, createdAt, updatedAt)
                VALUES (?, ?, ?, NOW(), NOW())
            ");

            $name = $type === 'group' ? ($input['name'] ?? null) : null;
            $stmt->execute([$type, $adId, $name]);
            $newChatId = (int)$this->db->lastInsertId();

            $stmt = $this->db->prepare("
                INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                VALUES (?, ?, 'admin', NOW(), 1), (?, ?, 'member', NOW(), 1)
                ON DUPLICATE KEY UPDATE isActive = 1
            ");
            $stmt->execute([$newChatId, $currentUserId, $newChatId, $participantId]);
            $this->db->commit();

            $result = $this->buildChatResponse($newChatId, $currentUserId, $participantId);

            http_response_code(201);
            echo json_encode($result);
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            error_log('Error creating chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }


    // Create or get chat initiated from an ad listing ("Contact Seller")
    public function createAdInquiryChat() {
        try {
            $user = $this->authMiddleware->authenticate();
            $buyerId = (int)$user['id'];
            $input = json_decode(file_get_contents('php://input'), true);

            $adId = isset($input['adId']) ? (int)$input['adId'] : null;
            $sellerId = isset($input['sellerId']) ? (int)$input['sellerId'] : 0;
            $initialMessage = trim((string)($input['message'] ?? ''));

            if ($adId) {
                $adStmt = $this->db->prepare("SELECT userId FROM ads WHERE id = ? LIMIT 1");
                $adStmt->execute([$adId]);
                $adSellerId = (int)($adStmt->fetchColumn() ?: 0);
                if (!$adSellerId) {
                    http_response_code(404);
                    echo json_encode(['message' => 'Ad not found']);
                    return;
                }
                $sellerId = $adSellerId;
            }

            if (!$sellerId) {
                http_response_code(400);
                echo json_encode(['message' => 'Seller ID is required']);
                return;
            }

            if ($buyerId === $sellerId) {
                http_response_code(400);
                echo json_encode(['message' => 'Cannot start a chat with yourself']);
                return;
            }

            // Reuse a prior thread when both users have membership or sent-message evidence.
            $stmt = $this->db->prepare("
                SELECT c.*
                FROM chats c
                WHERE c.type IN ('ad_inquiry', 'direct')
                AND (
                    EXISTS (SELECT 1 FROM chat_participants cp1 WHERE cp1.chatId = c.id AND cp1.userId = ?)
                    OR EXISTS (SELECT 1 FROM messages m1 WHERE m1.chatId = c.id AND m1.senderId = ?)
                )
                AND (
                    EXISTS (SELECT 1 FROM chat_participants cp2 WHERE cp2.chatId = c.id AND cp2.userId = ?)
                    OR EXISTS (SELECT 1 FROM messages m2 WHERE m2.chatId = c.id AND m2.senderId = ?)
                )
                ORDER BY c.updatedAt DESC, c.createdAt DESC
                LIMIT 1
            ");
            $stmt->execute([$buyerId, $buyerId, $sellerId, $sellerId]);
            $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);

            $chatId = null;
            if ($existingChat) {
                $chatId = (int)$existingChat['id'];
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    VALUES (?, ?, 'member', NOW(), 1), (?, ?, 'member', NOW(), 1)
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$chatId, $buyerId, $chatId, $sellerId]);
            } else {
                $this->db->beginTransaction();
                $stmt = $this->db->prepare("
                    INSERT INTO chats (type, adId, name, createdAt, updatedAt)
                    VALUES ('ad_inquiry', ?, NULL, NOW(), NOW())
                ");
                $stmt->execute([$adId]);
                $chatId = (int)$this->db->lastInsertId();

                $stmt = $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    VALUES (?, ?, 'member', NOW(), 1), (?, ?, 'member', NOW(), 1)
                ");
                $stmt->execute([$chatId, $buyerId, $chatId, $sellerId]);
                $this->db->commit();
            }

            if (!empty($initialMessage)) {
                $msgStmt = $this->db->prepare("
                    INSERT INTO messages (content, senderId, chatId, messageType, isRead, status, createdAt, updatedAt)
                    VALUES (?, ?, ?, 'text', 0, 'sent', NOW(), NOW())
                ");
                $msgStmt->execute([$initialMessage, $buyerId, $chatId]);

                $this->db->prepare("
                    UPDATE chats SET lastMessage = ?, lastMessageTime = NOW(), updatedAt = NOW() WHERE id = ?
                ")->execute([$initialMessage, $chatId]);

                try {
                    $sellerStmt = $this->db->prepare("SELECT id, username, email FROM users WHERE id = ? LIMIT 1");
                    $sellerStmt->execute([$sellerId]);
                    $sellerUser = $sellerStmt->fetch(PDO::FETCH_ASSOC);

                    if ($sellerUser) {
                        $senderName = $user['username'] ?? 'Someone';
                        $preview = mb_strlen($initialMessage) > 60 ? mb_substr($initialMessage, 0, 60) . '...' : $initialMessage;

                        $notifStmt = $this->db->prepare("
                            INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                            VALUES (?, 'message', ?, ?, ?, 0, NOW())
                        ");
                        $notifStmt->execute([
                            $sellerId,
                            'New inquiry from ' . $senderName,
                            $preview,
                            '/chat?chatId=' . $chatId
                        ]);

                        if (!empty($sellerUser['email'])) {
                            try {
                                $emailService = new EmailService();
                                $emailService->sendNewMessageEmail(
                                    $sellerUser['email'],
                                    $sellerUser['username'],
                                    $senderName,
                                    $preview,
                                    '/chat?chatId=' . $chatId
                                );
                            } catch (Throwable $ignore) {}
                        }
                    }
                } catch (Throwable $e) {}
            }

            $result = $this->buildChatResponse($chatId, $buyerId, $sellerId);
            http_response_code($existingChat ? 200 : 201);
            echo json_encode($result);
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            error_log('Error creating ad inquiry chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Get messages for a chat
    public function getChatMessages($chatId) {
        try {
            $user = $this->authMiddleware->authenticate();
            $userId = (int)$user['id'];
            $page = (int)($_GET['page'] ?? 1);
            $limit = (int)($_GET['limit'] ?? 50);
            $offset = ($page - 1) * $limit;

            $adminEmail = getenv('ADMIN_EMAIL');
            $isAdmin = ($adminEmail && strtolower($user['email']) === strtolower($adminEmail)) || !empty($user['isAdmin']) || in_array($user['role'] ?? '', ['admin', 'manager', 'viewer']);

            if (!$isAdmin) {
                if (!$this->ensureUserCanAccessChat($chatId, $userId, $user)) {
                    http_response_code(403);
                    echo json_encode(['message' => 'Access denied']);
                    return;
                }
            }

            $safeLimit = max(1, (int)$limit);
            $safeOffset = max(0, (int)$offset);
            try {
                $stmt = $this->db->prepare("
                    SELECT m.*,
                           sender.id as sender_id, sender.username as sender_username, sender.displayName as sender_displayName, sender.isAdmin as sender_isAdmin, sender.email as sender_email, sender.profilePicture as sender_profilePicture,
                           reply.id as reply_id, reply.content as reply_content,
                           reply_sender.id as reply_sender_id, reply_sender.username as reply_sender_username, reply_sender.profilePicture as reply_sender_profilePicture
                    FROM messages m
                    INNER JOIN users sender ON m.senderId = sender.id
                    LEFT JOIN messages reply ON m.replyToId = reply.id
                    LEFT JOIN users reply_sender ON reply.senderId = reply_sender.id
                    WHERE m.chatId = ?
                    ORDER BY m.createdAt DESC
                    LIMIT {$safeLimit} OFFSET {$safeOffset}
                ");
                $stmt->execute([(int)$chatId]);
                $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e) {
                $stmt = $this->db->prepare("
                    SELECT m.*,
                           sender.id as sender_id, sender.username as sender_username, sender.username as sender_displayName, sender.isAdmin as sender_isAdmin, sender.email as sender_email, sender.profilePicture as sender_profilePicture,
                           reply.id as reply_id, reply.content as reply_content,
                           reply_sender.id as reply_sender_id, reply_sender.username as reply_sender_username, reply_sender.profilePicture as reply_sender_profilePicture
                    FROM messages m
                    INNER JOIN users sender ON m.senderId = sender.id
                    LEFT JOIN messages reply ON m.replyToId = reply.id
                    LEFT JOIN users reply_sender ON reply.senderId = reply_sender.id
                    WHERE m.chatId = ?
                    ORDER BY m.createdAt DESC
                    LIMIT {$safeLimit} OFFSET {$safeOffset}
                ");
                $stmt->execute([(int)$chatId]);
                $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            $stmt = $this->db->prepare("
                UPDATE chat_participants SET lastSeenAt = NOW()
                WHERE chatId = ? AND userId = ?
            ");
            $stmt->execute([$chatId, $userId]);

            // Auto-mark incoming sent messages as delivered
            Message::markDelivered((int)$chatId, $userId);

            // Auto-mark incoming messages as read so viewing the conversation instantly clears unread state in DB
            Message::markChatRead((int)$chatId, $userId);

            // Also mark corresponding message notifications as read
            try {
                $notifStmt = $this->db->prepare("
                    UPDATE notifications
                    SET isRead = 1
                    WHERE userId = ? AND isRead = 0 AND (link LIKE ? OR link = ?)
                ");
                $notifStmt->execute([$userId, "%chatId={$chatId}%", '/chat?chatId=' . $chatId]);
            } catch (Exception $ne) {}

            $result = array_map(function($msg) use ($adminEmail) {
                $formatted = [
                    'id' => (int)$msg['id'],
                    'content' => $msg['content'],
                    'senderId' => (string)$msg['senderId'],
                    'chatId' => (int)$msg['chatId'],
                    'messageType' => $msg['messageType'],
                    'mediaUrl' => $msg['mediaUrl'],
                    'fileName' => $msg['fileName'],
                    'fileSize' => $msg['fileSize'] ? (int)$msg['fileSize'] : null,
                    'thumbnail' => $msg['thumbnail'],
                    'isRead' => (bool)$msg['isRead'],
                    'isStaffMessage' => !empty($msg['isStaffMessage']),
                    'staffDisplayName' => $msg['staffDisplayName'] ?? null,
                    'status' => $msg['status'] ?? ($msg['isRead'] ? 'read' : 'sent'),
                    'deliveredAt' => $msg['deliveredAt'] ?? null,
                    'readAt' => $msg['readAt'] ?? null,
                    'createdAt' => $msg['createdAt'],
                    'updatedAt' => $msg['updatedAt'],
                    'sender' => [
                        'id' => (int)$msg['sender_id'],
                        'username' => $msg['sender_username'],
                        'displayName' => $msg['sender_displayName'] ?? null,
                        'isAdmin' => (!empty($msg['sender_isAdmin']) || ($adminEmail && strtolower($msg['sender_email'] ?? '') === strtolower($adminEmail))),
                        'profilePicture' => $msg['sender_profilePicture'] ?? null
                    ]
                ];

                if ($msg['reply_id']) {
                    $formatted['replyTo'] = [
                        'id' => (int)$msg['reply_id'],
                        'content' => $msg['reply_content'],
                        'sender' => [
                            'id' => (int)$msg['reply_sender_id'],
                            'username' => $msg['reply_sender_username'],
                            'profilePicture' => $msg['reply_sender_profilePicture'] ?? null
                        ]
                    ];
                }

                return $formatted;
            }, $messages);

            $result = array_reverse($result);

            http_response_code(200);
            echo json_encode($result);
        } catch (Exception $e) {
            error_log('Error fetching messages: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Send a message
    public function sendMessage($chatId) {
        try {
            $user = $this->authMiddleware->authenticate();
            $senderId = (int)$user['id'];
            $replyToId = isset($_POST['replyToId']) ? (int)$_POST['replyToId'] : null;
            $messageType = $_POST['messageType'] ?? 'text';
            $content = '';
            $mediaUrl = null;

            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $fileTmp = $_FILES['image']['tmp_name'];
                $fileName = uniqid('chatimg_') . '_' . basename($_FILES['image']['name']);
                $publicPath = '/uploads/chat/' . $fileName;

                if (UploadHelper::saveUploadedFile($fileTmp, 'chat', $fileName)) {
                    $content = $publicPath;
                    $messageType = 'image';
                    $mediaUrl = $publicPath;
                } else {
                    http_response_code(500);
                    echo json_encode(['message' => 'Failed to upload image']);
                    return;
                }
            } elseif (isset($_FILES['video']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
                $maxSize = 50 * 1024 * 1024;

                if ($_FILES['video']['size'] > $maxSize) {
                    http_response_code(400);
                    echo json_encode(['message' => 'Video file size exceeds maximum limit of 50MB']);
                    return;
                }

                $allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
                $fileType = $_FILES['video']['type'];

                if (!in_array($fileType, $allowedVideoTypes)) {
                    http_response_code(400);
                    echo json_encode(['message' => 'Invalid video file type. Allowed: MP4, AVI, MOV, WMV, WEBM']);
                    return;
                }

                $fileTmp = $_FILES['video']['tmp_name'];
                $fileName = uniqid('chatvid_') . '_' . basename($_FILES['video']['name']);
                $publicPath = '/uploads/chat/' . $fileName;

                if (UploadHelper::saveUploadedFile($fileTmp, 'chat', $fileName)) {
                    $content = $publicPath;
                    $messageType = 'video';
                    $mediaUrl = $publicPath;
                } else {
                    http_response_code(500);
                    echo json_encode(['message' => 'Failed to upload video']);
                    return;
                }
            } else {
                $input = json_decode(file_get_contents('php://input'), true);
                $content = trim($input['content'] ?? '');
                $messageType = $input['messageType'] ?? 'text';
                $replyToId = isset($input['replyToId']) ? (int)$input['replyToId'] : null;

                if (empty($content)) {
                    http_response_code(400);
                    echo json_encode(['message' => 'Message content is required']);
                    return;
                }
            }

            $adminEmail = getenv('ADMIN_EMAIL');
            $isStaff = ($adminEmail && strtolower($user['email']) === strtolower($adminEmail)) || !empty($user['isAdmin']) || in_array($user['role'] ?? '', ['admin', 'manager', 'viewer']);

            if (!$isStaff) {
                if (!$this->ensureUserCanAccessChat($chatId, $senderId, $user)) {
                    http_response_code(403);
                    echo json_encode(['message' => 'Access denied']);
                    return;
                }
            }

            // Ban check: Banned users can ONLY send messages to Support/Admin
            if (!empty($user['isBanned'])) {
                $staffStmt = $this->db->prepare("
                    SELECT u.id, u.email, u.isAdmin, u.role
                    FROM chat_participants cp
                    INNER JOIN users u ON cp.userId = u.id
                    WHERE cp.chatId = ? AND cp.isActive = 1
                ");
                $staffStmt->execute([$chatId]);
                $allParticipants = $staffStmt->fetchAll(PDO::FETCH_ASSOC);

                $hasStaffParticipant = false;
                foreach ($allParticipants as $p) {
                    if ((int)$p['id'] === (int)$senderId) continue;
                    $isStaffP = (!empty($adminEmail) && strtolower($p['email']) === strtolower($adminEmail))
                             || !empty($p['isAdmin'])
                             || in_array($p['role'] ?? '', ['admin', 'manager', 'agent']);
                    if ($isStaffP) {
                        $hasStaffParticipant = true;
                        break;
                    }
                }

                if (!$hasStaffParticipant) {
                    http_response_code(403);
                    echo json_encode([
                        'message' => 'Your account is restricted. Banned users can only message Support/Admin.',
                        'banned' => true,
                        'restricted' => true
                    ]);
                    return;
                }
            }

            $messageId = null;
            try {
                $stmt = $this->db->prepare("
                    INSERT INTO messages (content, senderId, chatId, messageType, replyToId, isStaffMessage, staffDisplayName, status, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, 0, NULL, 'sent', NOW(), NOW())
                ");
                $stmt->execute([$content, $senderId, $chatId, $messageType, $replyToId]);
                $messageId = $this->db->lastInsertId();
            } catch (Throwable $e1) {
                try {
                    $stmt = $this->db->prepare("
                        INSERT INTO messages (content, senderId, chatId, messageType, replyToId, status, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, 'sent', NOW(), NOW())
                    ");
                    $stmt->execute([$content, $senderId, $chatId, $messageType, $replyToId]);
                    $messageId = $this->db->lastInsertId();
                } catch (Throwable $e2) {
                    $stmt = $this->db->prepare("
                        INSERT INTO messages (content, senderId, chatId, messageType, replyToId, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                    ");
                    $stmt->execute([$content, $senderId, $chatId, $messageType, $replyToId]);
                    $messageId = $this->db->lastInsertId();
                }
            }

            $stmt = $this->db->prepare("
                UPDATE chats SET lastMessage = ?, lastMessageTime = NOW(), updatedAt = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$content, $chatId]);

            // Reactivate all participants in this chat so it surfaces for everyone
            try {
                $this->db->prepare("
                    UPDATE chat_participants SET isActive = 1 WHERE chatId = ?
                ")->execute([$chatId]);
            } catch (Throwable $e) {}

            $adminEmail = getenv('ADMIN_EMAIL');
            try {
                $stmt = $this->db->prepare("
                    SELECT m.*,
                           sender.id as sender_id, sender.username as sender_username, sender.displayName as sender_displayName, sender.isAdmin as sender_isAdmin, sender.email as sender_email, sender.profilePicture as sender_profilePicture,
                           reply.id as reply_id, reply.content as reply_content,
                           reply_sender.id as reply_sender_id, reply_sender.username as reply_sender_username, reply_sender.profilePicture as reply_sender_profilePicture
                    FROM messages m
                    INNER JOIN users sender ON m.senderId = sender.id
                    LEFT JOIN messages reply ON m.replyToId = reply.id
                    LEFT JOIN users reply_sender ON reply.senderId = reply_sender.id
                    WHERE m.id = ?
                ");
                $stmt->execute([$messageId]);
                $messageData = $stmt->fetch(PDO::FETCH_ASSOC);
            } catch (Throwable $e) {
                $stmt = $this->db->prepare("
                    SELECT m.*,
                           sender.id as sender_id, sender.username as sender_username, sender.username as sender_displayName, sender.isAdmin as sender_isAdmin, sender.email as sender_email, sender.profilePicture as sender_profilePicture,
                           reply.id as reply_id, reply.content as reply_content,
                           reply_sender.id as reply_sender_id, reply_sender.username as reply_sender_username, reply_sender.profilePicture as reply_sender_profilePicture
                    FROM messages m
                    INNER JOIN users sender ON m.senderId = sender.id
                    LEFT JOIN messages reply ON m.replyToId = reply.id
                    LEFT JOIN users reply_sender ON reply.senderId = reply_sender.id
                    WHERE m.id = ?
                ");
                $stmt->execute([$messageId]);
                $messageData = $stmt->fetch(PDO::FETCH_ASSOC);
            }

            $result = [
                'id' => (int)$messageData['id'],
                'content' => $messageData['content'],
                'senderId' => (string)$messageData['senderId'],
                'chatId' => (int)$messageData['chatId'],
                'messageType' => $messageData['messageType'],
                'mediaUrl' => $mediaUrl ?: ($messageData['mediaUrl'] ?? null),
                'isRead' => (bool)$messageData['isRead'],
                'status' => $messageData['status'] ?? 'sent',
                'deliveredAt' => $messageData['deliveredAt'] ?? null,
                'readAt' => $messageData['readAt'] ?? null,
                'createdAt' => $messageData['createdAt'],
                'updatedAt' => $messageData['updatedAt'],
                'sender' => [
                    'id' => (int)$messageData['sender_id'],
                    'username' => $messageData['sender_username'],
                    'displayName' => $messageData['sender_displayName'] ?? null,
                    'isAdmin' => (!empty($messageData['sender_isAdmin']) || ($adminEmail && strtolower($messageData['sender_email'] ?? '') === strtolower($adminEmail))),
                    'profilePicture' => $messageData['sender_profilePicture'] ?? null
                ]
            ];

            if ($messageData['reply_id']) {
                $result['replyTo'] = [
                    'id' => (int)$messageData['reply_id'],
                    'content' => $messageData['reply_content'],
                    'sender' => [
                        'id' => (int)$messageData['reply_sender_id'],
                        'username' => $messageData['reply_sender_username'],
                        'profilePicture' => $messageData['reply_sender_profilePicture'] ?? null
                    ]
                ];
            }

            // Return response immediately so frontend experiences zero delay
            http_response_code(201);
            echo json_encode($result);

            // Flush response to browser immediately
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            } else {
                if (ob_get_level() > 0) {
                    ob_end_flush();
                }
                flush();
            }

            // In-app notifications & background email alerts (runs after response is already sent to user!)
            try {
                $recipientStmt = $this->db->prepare("
                    SELECT u.id, u.username, u.email, u.lastSeenAt, u.lastUnreadReminderAt,
                           cp.lastSeenAt as participantLastSeenAt
                    FROM chat_participants cp
                    INNER JOIN users u ON cp.userId = u.id
                    WHERE cp.chatId = ? AND cp.userId != ? AND cp.isActive = 1
                ");
                $recipientStmt->execute([$chatId, $senderId]);
                $recipients = $recipientStmt->fetchAll(PDO::FETCH_ASSOC);

                $senderName = $user['username'] ?? 'Someone';
                $preview = mb_strlen($content) > 60 ? mb_substr($content, 0, 60) . '...' : $content;
                if ($messageType === 'image') $preview = '📷 Sent an image';
                if ($messageType === 'video') $preview = '🎥 Sent a video';

                $notifStmt = $this->db->prepare("
                    INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                    VALUES (?, 'message', ?, ?, ?, 0, NOW())
                ");
                foreach ($recipients as $recipient) {
                    $notifStmt->execute([
                        (int)$recipient['id'],
                        'New message from ' . $senderName,
                        $preview,
                        '/chat?chatId=' . $chatId
                    ]);

                    // Send instant email notification to recipient if they are not active in this chat room
                    // Throttled: max 1 notification email every 10 minutes to avoid flooding
                    if (!empty($recipient['email'])) {
                        $lastReminder = !empty($recipient['lastUnreadReminderAt']) ? strtotime($recipient['lastUnreadReminderAt']) : 0;
                        $cooldownPassed = (time() - $lastReminder) >= 600; // 10 minutes

                        $participantLastSeen = !empty($recipient['participantLastSeenAt']) ? strtotime($recipient['participantLastSeenAt']) : 0;
                        $isInactiveInChat = (time() - $participantLastSeen) >= 120; // 2 minutes

                        if ($cooldownPassed && $isInactiveInChat) {
                            try {
                                $emailService = new EmailService();
                                $emailSent = $emailService->sendNewMessageEmail(
                                    $recipient['email'],
                                    $recipient['username'],
                                    $senderName,
                                    $preview,
                                    '/chat?chatId=' . $chatId
                                );
                                if ($emailSent) {
                                    $uStmt = $this->db->prepare("UPDATE users SET lastUnreadReminderAt = NOW() WHERE id = ?");
                                    $uStmt->execute([(int)$recipient['id']]);
                                }
                            } catch (Throwable $mailEx) {
                                error_log('Failed to send real-time message email notification: ' . $mailEx->getMessage());
                            }
                        }
                    }
                }
            } catch (Exception $ne) {
                error_log('Notification insert error: ' . $ne->getMessage());
            }
        } catch (Exception $e) {
            error_log('Error sending message: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Mark messages as read
    public function markMessagesAsRead($chatId) {
        try {
            $user = $this->authMiddleware->authenticate();
            $userId = (int)$user['id'];

            $adminEmail = getenv('ADMIN_EMAIL');
            $isAdmin = ($adminEmail && strtolower($user['email'] ?? '') === strtolower($adminEmail)) || !empty($user['isAdmin']) || in_array($user['role'] ?? '', ['admin', 'manager', 'viewer']);

            if (!$isAdmin) {
                if (!$this->ensureUserCanAccessChat($chatId, $userId, $user)) {
                    http_response_code(403);
                    echo json_encode(['message' => 'Access denied']);
                    return;
                }
            }

            $affected = Message::markChatRead((int)$chatId, $userId);

            // Also mark corresponding message notifications as read in DB
            try {
                $notifStmt = $this->db->prepare("
                    UPDATE notifications
                    SET isRead = 1
                    WHERE userId = ? AND isRead = 0 AND (link LIKE ? OR link = ?)
                ");
                $notifStmt->execute([$userId, "%chatId={$chatId}%", '/chat?chatId=' . $chatId]);
            } catch (Exception $ne) {
                // Ignore notification update error
            }

            http_response_code(200);
            echo json_encode(['success' => true, 'markedRead' => $affected, 'message' => 'Messages marked as read']);
        } catch (Exception $e) {
            error_log('Error marking messages as read: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Mark all unread messages as read for current user
    public function markAllAsRead() {
        try {
            $user = $this->authMiddleware->authenticate();
            $userId = (int)$user['id'];

            // CRITICAL FIX: Only mark INCOMING messages as read (senderId != userId).
            // Never mark the user's own outgoing messages as isRead=1 here, because
            // that would cause false double-ticks on the sender's side before recipients open them.
            $stmt = $this->db->prepare("
                UPDATE messages 
                SET isRead = 1, status = 'read', readAt = NOW(), updatedAt = NOW()
                WHERE chatId IN (
                    SELECT cp.chatId FROM chat_participants cp WHERE cp.userId = ? AND cp.isActive = 1
                ) AND senderId != ? AND (senderId IS NOT NULL AND senderId != 0) AND isRead = 0
            ");
            $stmt->execute([$userId, $userId]);
            $affected = $stmt->rowCount();

            try {
                $this->db->prepare("
                    UPDATE notifications
                    SET isRead = 1
                    WHERE userId = ? AND type = 'message' AND isRead = 0
                ")->execute([$userId]);
            } catch (Throwable $ignore) {}

            http_response_code(200);
            echo json_encode(['success' => true, 'markedRead' => $affected]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }


    // Admin find deal chat between buyer and seller
    public function adminFindDealChat() {
        try {
            error_log("adminFindDealChat method called");

            $currentUser = $this->authMiddleware->authenticate();
            error_log("Current user authenticated: " . json_encode($currentUser));

            $this->checkAdminAccess($currentUser);
            error_log("Admin access verified");

            $input = json_decode(file_get_contents('php://input'), true);
            error_log("Input received: " . json_encode($input));

            $buyerId = (int)($input['buyerId'] ?? 0);
            $sellerId = (int)($input['sellerId'] ?? 0);

            error_log("Searching for chat between buyer $buyerId and seller $sellerId");

            if (!$buyerId || !$sellerId) {
                http_response_code(400);
                echo json_encode(['message' => 'Buyer ID and Seller ID are required']);
                return;
            }

            $stmt = $this->db->prepare("
                SELECT c.id as chatId
                FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                ORDER BY c.updatedAt DESC, c.createdAt DESC
                LIMIT 1
            ");
            $stmt->execute([$buyerId, $sellerId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$chat) {
                http_response_code(404);
                echo json_encode(['message' => 'No chat found between buyer and seller']);
                return;
            }

            http_response_code(200);
            echo json_encode(['chatId' => (int)$chat['chatId']]);
        } catch (Exception $e) {
            error_log('Error finding deal chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Check if chat exists between users
    public function checkExistingChat() {
        try {
            $user = $this->authMiddleware->authenticate();
            $input = json_decode(file_get_contents('php://input'), true);

            $sellerId = (int)($input['sellerId'] ?? 0);
            $buyerId = (int)$user['id'];

            if (!$sellerId) {
                http_response_code(400);
                echo json_encode(['message' => 'Seller ID is required']);
                return;
            }

            // Requirement 17: check by buyer/seller pair only, not by ad/product.
            $stmt = $this->db->prepare("
                SELECT c.id
                FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE c.type IN ('ad_inquiry', 'direct')
                AND cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                ORDER BY c.updatedAt DESC, c.createdAt DESC
                LIMIT 1
            ");
            $stmt->execute([$buyerId, $sellerId]);
            $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);

            http_response_code(200);
            echo json_encode([
                'exists' => (bool)$existingChat,
                'chatId' => $existingChat ? (int)$existingChat['id'] : null,
                'dealSummary' => $this->getDealSummaryForUserPair($buyerId, $sellerId)
            ]);
        } catch (Exception $e) {
            error_log('Error checking existing chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Admin send message to any chat
    public function adminSendMessage($chatId) {
        try {
            $currentUser = $this->authMiddleware->authenticate();
            $this->checkManagerAccess($currentUser);

            $input = json_decode(file_get_contents('php://input'), true);
            $content = trim($input['content'] ?? '');
            $staffDisplayName = isset($input['staffDisplayName']) ? trim((string)$input['staffDisplayName']) : null;
            $sendAsStaff = isset($input['sendAsStaff']) ? (bool)$input['sendAsStaff'] : true;

            if (empty($content)) {
                http_response_code(400);
                echo json_encode(['message' => 'Message content is required']);
                return;
            }

            $stmt = $this->db->prepare("SELECT id FROM chats WHERE id = ? LIMIT 1");
            $stmt->execute([$chatId]);

            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                http_response_code(404);
                echo json_encode(['message' => 'Chat not found']);
                return;
            }

            // Fetch sender's latest displayName and username from DB
            $userStmt = $this->db->prepare("SELECT username, displayName FROM users WHERE id = ? LIMIT 1");
            $userStmt->execute([(int)$currentUser['id']]);
            $userDb = $userStmt->fetch(PDO::FETCH_ASSOC);

            $effectiveDisplayName = !empty($userDb['displayName'])
                ? $userDb['displayName']
                : (!empty($staffDisplayName) ? $staffDisplayName : ($userDb['username'] ?? 'Admin'));

            $isStaffVal = $sendAsStaff ? 1 : 0;
            $staffNameVal = $sendAsStaff ? $effectiveDisplayName : null;

            $stmt = $this->db->prepare("
                INSERT INTO messages (content, senderId, chatId, messageType, isStaffMessage, staffDisplayName, isRead, status, createdAt, updatedAt)
                VALUES (?, ?, ?, 'text', ?, ?, 0, 'sent', NOW(), NOW())
            ");
            $stmt->execute([$content, (int)$currentUser['id'], $chatId, $isStaffVal, $staffNameVal]);
            $messageId = $this->db->lastInsertId();

            $stmt = $this->db->prepare("
                UPDATE chats SET lastMessage = ?, lastMessageTime = NOW(), updatedAt = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$content, $chatId]);

            // Admin replies should restore chats hidden by inactive participant rows.
            $this->db->prepare("
                UPDATE chat_participants SET isActive = 1 WHERE chatId = ?
            ")->execute([$chatId]);

            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT DISTINCT m.chatId, m.senderId, 'member', NOW(), 1
                    FROM messages m
                    INNER JOIN users u ON u.id = m.senderId
                    WHERE m.chatId = ? AND m.senderId > 0
                      AND COALESCE(u.isAdmin, 0) = 0
                      AND COALESCE(u.role, 'user') NOT IN ('admin', 'manager', 'agent', 'viewer')
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$chatId]);
            } catch (Throwable $ignore) {}

            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT d.chat_id, d.buyer_id, 'member', NOW(), 1
                    FROM deals d
                    WHERE d.chat_id = ? AND d.buyer_id IS NOT NULL AND d.buyer_id > 0
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$chatId]);
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT d.chat_id, d.seller_id, 'member', NOW(), 1
                    FROM deals d
                    WHERE d.chat_id = ? AND d.seller_id IS NOT NULL AND d.seller_id > 0
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$chatId]);
            } catch (Throwable $ignore) {}

            try {
                $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                    SELECT c.id, a.userId, 'member', NOW(), 1
                    FROM chats c
                    INNER JOIN ads a ON c.adId = a.id
                    WHERE c.id = ? AND a.userId > 0
                    ON DUPLICATE KEY UPDATE isActive = 1
                ")->execute([$chatId]);
            } catch (Throwable $ignore) {}

            $stmt = $this->db->prepare("
                SELECT m.*, u.username as sender_username, u.displayName as sender_displayName, u.profilePicture as sender_profilePicture
                FROM messages m
                LEFT JOIN users u ON m.senderId = u.id
                WHERE m.id = ?
            ");
            $stmt->execute([$messageId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);

            $senderName = $sendAsStaff
                ? $staffNameVal
                : (!empty($message['sender_displayName']) ? $message['sender_displayName'] : $message['sender_username']);

            $result = [
                'id' => (int)$message['id'],
                'content' => $message['content'],
                'senderId' => (string)$currentUser['id'],
                'chatId' => (int)$chatId,
                'messageType' => 'text',
                'sender' => $senderName,
                'isStaffMessage' => (bool)$isStaffVal,
                'staffDisplayName' => $sendAsStaff ? $staffNameVal : null,
                'senderProfilePicture' => $message['sender_profilePicture'] ?? null,
                'profilePicture' => $message['sender_profilePicture'] ?? null,
                'status' => 'sent',
                'createdAt' => $message['createdAt'],
                'updatedAt' => $message['updatedAt'],
                'timestamp' => $message['createdAt']
            ];

            // Notify chat participants about admin message
            try {
                $recipientStmt = $this->db->prepare("
                    SELECT u.id, u.username, u.email
                    FROM chat_participants cp
                    INNER JOIN users u ON cp.userId = u.id
                    WHERE cp.chatId = ? AND cp.userId != ? AND cp.isActive = 1
                ");
                $recipientStmt->execute([$chatId, (int)$currentUser['id']]);
                $recipients = $recipientStmt->fetchAll(PDO::FETCH_ASSOC);

                $preview = mb_strlen($content) > 60 ? mb_substr($content, 0, 60) . '...' : $content;
                $notifStmt = $this->db->prepare("
                    INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                    VALUES (?, 'admin_message', ?, ?, ?, 0, NOW())
                ");
                $emailService = new EmailService();

                foreach ($recipients as $recipient) {
                    $notifStmt->execute([
                        (int)$recipient['id'],
                        'Support message from ' . $senderName,
                        $preview,
                        '/chat?chatId=' . $chatId
                    ]);

                    if (!empty($recipient['email'])) {
                        try {
                            $emailService->sendAdminMessageEmail(
                                $recipient['email'],
                                $recipient['username'],
                                $senderName,
                                $preview
                            );
                        } catch (Throwable $emEx) {
                            error_log('Failed to send admin message email: ' . $emEx->getMessage());
                        }
                    }
                }
            } catch (Throwable $ne) {
                error_log('Admin notification error: ' . $ne->getMessage());
            }

            http_response_code(201);
            echo json_encode($result);
        } catch (Exception $e) {
            error_log('Error sending admin message: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Admin delete individual message
    public function adminDeleteMessage($messageId) {
        try {
            $currentUser = $this->authMiddleware->authenticate();
            $this->checkManagerAccess($currentUser);

            // Nullify replyToId references first to avoid foreign key constraint errors
            $stmt = $this->db->prepare("UPDATE messages SET replyToId = NULL WHERE replyToId = ?");
            $stmt->execute([$messageId]);

            $stmt = $this->db->prepare("DELETE FROM messages WHERE id = ?");
            $stmt->execute([$messageId]);

            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode(['message' => 'Message deleted successfully']);
            } else {
                http_response_code(404);
                echo json_encode(['message' => 'Message not found']);
            }
        } catch (Exception $e) {
            error_log('Error deleting message: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Admin delete entire chat
    public function adminDeleteChat($chatId) {
        try {
            $currentUser = $this->authMiddleware->authenticate();
            $this->checkManagerAccess($currentUser); // Allow both admin and manager

            $this->db->beginTransaction();

            // Nullify replyToId references first to avoid self-referential foreign key constraint errors
            $stmt = $this->db->prepare("UPDATE messages SET replyToId = NULL WHERE chatId = ?");
            $stmt->execute([$chatId]);

            $stmt = $this->db->prepare("DELETE FROM messages WHERE chatId = ?");
            $stmt->execute([$chatId]);

            $stmt = $this->db->prepare("DELETE FROM chat_participants WHERE chatId = ?");
            $stmt->execute([$chatId]);

            $stmt = $this->db->prepare("DELETE FROM chats WHERE id = ?");
            $stmt->execute([$chatId]);
            $deletedRows = $stmt->rowCount();

            $this->db->commit();

            if ($deletedRows > 0) {
                http_response_code(200);
                echo json_encode(['message' => 'Chat deleted successfully']);
            } else {
                http_response_code(404);
                echo json_encode(['message' => 'Chat not found']);
            }
        } catch (Exception $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }

            error_log('Error deleting chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    // Create or get a Website Agent chat for users with no conversations
    public function createOrGetAgentChat() {
        try {
            $user = $this->authMiddleware->authenticate();
            $currentUserId = (int)$user['id'];

            $stmt = $this->db->prepare("
                SELECT id, username, profilePicture
                FROM users
                WHERE isAdmin = 1 AND id <> ?
                ORDER BY id ASC
                LIMIT 1
            ");
            $stmt->execute([$currentUserId]);
            $agent = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$agent) {
                http_response_code(404);
                echo json_encode(['message' => 'Website Agent user is not configured. Please create an admin user first.']);
                return;
            }

            $agentId = (int)$agent['id'];

            $stmt = $this->db->prepare("
                SELECT c.*
                FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE c.type = 'direct'
                AND cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                LIMIT 1
            ");
            $stmt->execute([$currentUserId, $agentId]);
            $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($existingChat) {
                http_response_code(200);
                echo json_encode([
                    'id' => (int)$existingChat['id'],
                    'type' => $existingChat['type'],
                    'name' => 'Website Agent',
                    'otherParticipants' => [[
                        'id' => (string)$agentId,
                        'username' => 'Website Agent',
                        'email' => '',
                        'profilePicture' => $agent['profilePicture'] ?? null
                    ]]
                ]);
                return;
            }

            $stmt = $this->db->prepare("
                INSERT INTO chats (type, name, createdAt, updatedAt)
                VALUES ('direct', 'Website Agent', NOW(), NOW())
            ");
            $stmt->execute();
            $chatId = (int)$this->db->lastInsertId();

            $stmt = $this->db->prepare("
                INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive)
                VALUES (?, ?, ?, NOW(), 1)
            ");
            $stmt->execute([$chatId, $currentUserId, 'member']);
            $stmt->execute([$chatId, $agentId, 'admin']);

            http_response_code(201);
            echo json_encode([
                'id' => $chatId,
                'type' => 'direct',
                'name' => 'Website Agent',
                'otherParticipants' => [[
                    'id' => (string)$agentId,
                    'username' => 'Website Agent',
                    'email' => '',
                    'profilePicture' => $agent['profilePicture'] ?? null
                ]]
            ]);
        } catch (Exception $e) {
            error_log('Error creating Website Agent chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    public function requestAgentForChat($chatId) {
        try {
            $user = $this->authMiddleware->authenticate();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['message' => 'Unauthorized']);
                return;
            }

            // Verify the chat belongs to the requesting user
            $stmt = $this->db->prepare("
                SELECT cp.chatId FROM chat_participants cp
                WHERE cp.chatId = ? AND cp.userId = ? AND cp.isActive = 1
                LIMIT 1
            ");
            $stmt->execute([$chatId, $user['id']]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['message' => 'Access denied']);
                return;
            }

            // Mark chat as support requested (add column if not exists, or skip gracefully)
            try {
                $stmt = $this->db->prepare("
                    UPDATE chats SET support_requested = 1, support_requested_at = NOW()
                    WHERE id = ?
                ");
                $stmt->execute([$chatId]);
            } catch (Exception $e) {
                // Column may not exist yet — silently ignore, still insert system message
                error_log('support_requested column not found: ' . $e->getMessage());
            }

            // Insert a system message into the chat
            $systemMsg = '⚠️ ' . ($user['username'] ?? 'User') . ' has requested admin assistance in this conversation.';
            $stmt = $this->db->prepare("
                INSERT INTO messages (chatId, senderId, content, messageType, isRead, createdAt, updatedAt)
                VALUES (?, ?, ?, 'system', 0, NOW(), NOW())
            ");
            $stmt->execute([$chatId, $user['id'], $systemMsg]);

            // Also update the chat's last message time
            $this->db->prepare("UPDATE chats SET updatedAt = NOW(), lastMessageTime = NOW() WHERE id = ?")->execute([$chatId]);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Agent request sent successfully']);
        } catch (Exception $e) {
            error_log('requestAgentForChat error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    public function resolveSupportForChat($chatId) {
        try {
            $user = $this->authMiddleware->authenticate();
            if (!$user) {
                http_response_code(401);
                echo json_encode(['message' => 'Unauthorized']);
                return;
            }

            // Require admin or manager auth
            if (!AuthMiddleware::checkRole($user, ['admin', 'manager'])) {
                http_response_code(403);
                echo json_encode(['message' => 'Access denied: Manager or Admin only']);
                return;
            }

            $stmt = $this->db->prepare("
                UPDATE chats SET support_requested = 0, support_requested_at = NULL
                WHERE id = ?
            ");
            $stmt->execute([$chatId]);

            // Add a system message stating support is resolved
            $systemMsg = 'ℹ️ Support request has been resolved by Admin.';
            $stmt = $this->db->prepare("
                INSERT INTO messages (chatId, senderId, content, messageType, isRead, createdAt, updatedAt)
                VALUES (?, ?, ?, 'system', 0, NOW(), NOW())
            ");
            $stmt->execute([$chatId, $user['id'], $systemMsg]);

            // Also update the chat's last message time
            $this->db->prepare("UPDATE chats SET updatedAt = NOW(), lastMessageTime = NOW() WHERE id = ?")->execute([$chatId]);

            http_response_code(200);
            echo json_encode(['success' => true, 'message' => 'Support request marked as resolved']);
        } catch (Exception $e) {
            error_log('resolveSupportForChat error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    private function buildChatResponse($chatId, $currentUserId, $otherUserId = null) {
        $stmt = $this->db->prepare("
            SELECT c.*, a.id as ad_id, a.title as ad_title, a.price as ad_price
            FROM chats c
            LEFT JOIN ads a ON c.adId = a.id
            WHERE c.id = ?
        ");
        $stmt->execute([$chatId]);
        $chatData = $stmt->fetch(PDO::FETCH_ASSOC);

        $stmt = $this->db->prepare("
            SELECT cp.*, u.id as user_id, u.username, u.email, u.profilePicture
            FROM chat_participants cp
            INNER JOIN users u ON cp.userId = u.id
            WHERE cp.chatId = ? AND cp.isActive = 1
        ");
        $stmt->execute([$chatId]);
        $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $otherParticipants = array_values(array_filter($participants, function($p) use ($currentUserId) {
            return (int)$p['user_id'] !== (int)$currentUserId;
        }));

        if (!$otherUserId && !empty($otherParticipants)) {
            $otherUserId = (int)$otherParticipants[0]['user_id'];
        }

        $stmt = $this->db->prepare("
            SELECT m.*, sender.id as sender_id, sender.username as sender_username, sender.profilePicture as sender_profilePicture
            FROM messages m
            INNER JOIN users sender ON m.senderId = sender.id
            WHERE m.chatId = ?
            ORDER BY m.createdAt DESC
            LIMIT 1
        ");
        $stmt->execute([$chatId]);
        $latestMessage = $stmt->fetch(PDO::FETCH_ASSOC);

        return [
            'id' => (int)$chatData['id'],
            'type' => $chatData['type'],
            'name' => $chatData['name'],
            'adId' => $chatData['ad_id'] ? (int)$chatData['ad_id'] : null,
            'support_requested' => isset($chatData['support_requested']) ? (bool)$chatData['support_requested'] : false,
            'support_requested_at' => $chatData['support_requested_at'] ?? null,
            'lastMessage' => $chatData['lastMessage'] ?? null,
            'lastMessageTime' => $chatData['lastMessageTime'] ?? null,
            'createdAt' => $chatData['createdAt'],
            'updatedAt' => $chatData['updatedAt'],
            'participants' => array_map(function($p) {
                return [
                    'userId' => (int)$p['userId'],
                    'role' => $p['role'],
                    'user' => [
                        'id' => (int)$p['user_id'],
                        'username' => $p['username'],
                        'email' => $p['email'],
                        'profilePicture' => $p['profilePicture'] ?? null
                    ]
                ];
            }, $participants),
            'otherParticipants' => array_map(function($p) {
                return [
                    'id' => (int)$p['user_id'],
                    'username' => $p['username'],
                    'email' => $p['email'],
                    'profilePicture' => $p['profilePicture'] ?? null
                ];
            }, $otherParticipants),
            'ad' => $chatData['ad_id'] ? [
                'id' => (int)$chatData['ad_id'],
                'title' => $chatData['ad_title'],
                'price' => (float)$chatData['ad_price']
            ] : null,
            'dealSummary' => $otherUserId ? $this->getDealSummaryForUserPair($currentUserId, $otherUserId) : null,
            'messages' => $latestMessage ? [[
                'id' => (int)$latestMessage['id'],
                'content' => $latestMessage['content'],
                'createdAt' => $latestMessage['createdAt'],
                'sender' => [
                    'id' => (int)$latestMessage['sender_id'],
                    'username' => $latestMessage['sender_username'],
                    'profilePicture' => $latestMessage['sender_profilePicture'] ?? null
                ]
            ]] : []
        ];
    }

    private function getDealSummaryForUserPair($currentUserId, $otherUserId) {
        $emptySummary = [
            'totalDeals' => 0,
            'channels' => [],
            'prices' => [],
            'channelsBought' => 0,
            'channelsSold' => 0,
            'deals' => []
        ];

        $cacheKey = "{$currentUserId}_{$otherUserId}";
        if (isset(self::$dealsSummaryCache[$cacheKey])) {
            return self::$dealsSummaryCache[$cacheKey];
        }

        try {
            // Check table existence once per PHP execution
            if (!self::$dealsTableChecked) {
                self::$dealsTableChecked = true;
                $tableCheck = $this->db->query("SHOW TABLES LIKE 'deals'");
                if ($tableCheck && $tableCheck->fetch(PDO::FETCH_NUM)) {
                    self::$dealsTableExists = true;
                    $columnStmt = $this->db->query("SHOW COLUMNS FROM deals");
                    $columnsRaw = $columnStmt ? $columnStmt->fetchAll(PDO::FETCH_ASSOC) : [];
                    self::$dealsColumns = array_map(function($column) {
                        return $column['Field'];
                    }, $columnsRaw);
                } else {
                    self::$dealsTableExists = false;
                }
            }

            if (!self::$dealsTableExists || empty(self::$dealsColumns)) {
                self::$dealsSummaryCache[$cacheKey] = $emptySummary;
                return $emptySummary;
            }

            $columns = self::$dealsColumns;

            $pickColumn = function($possibleColumns) use ($columns) {
                foreach ($possibleColumns as $column) {
                    if (in_array($column, $columns, true)) {
                        return $column;
                    }
                }

                return null;
            };

            $buyerCol = $pickColumn(['buyer_id', 'buyerId', 'buyer']);
            $sellerCol = $pickColumn(['seller_id', 'sellerId', 'seller']);
            $titleCol = $pickColumn(['channel_title', 'channelTitle', 'channel_name', 'channelName', 'title', 'ad_title', 'adTitle']);
            $priceCol = $pickColumn(['channel_price', 'channelPrice', 'price', 'amount', 'totalPrice']);
            $statusCol = $pickColumn(['status', 'dealStatus']);
            $createdCol = $pickColumn(['created_at', 'createdAt', 'created']);

            if (!$buyerCol || !$sellerCol) {
                self::$dealsSummaryCache[$cacheKey] = $emptySummary;
                return $emptySummary;
            }

            $idCol = $pickColumn(['id', 'deal_id', 'dealId']);
            $txnCol = $pickColumn(['transaction_id', 'transactionId', 'txnId']);

            $selectParts = [
                $idCol ? "`$idCol` AS id" : "0 AS id",
                $txnCol ? "`$txnCol` AS transaction_id" : "'' AS transaction_id",
                "`$buyerCol` AS buyer_id",
                "`$sellerCol` AS seller_id",
                $titleCol ? "`$titleCol` AS channel_title" : "'Deal' AS channel_title",
                $priceCol ? "`$priceCol` AS channel_price" : "0 AS channel_price",
                $statusCol ? "`$statusCol` AS deal_status" : "'' AS deal_status"
            ];

            $orderBy = $createdCol ? "`$createdCol` DESC" : "1 DESC";

            $stmt = $this->db->prepare("
                SELECT " . implode(', ', $selectParts) . "
                FROM deals
                WHERE (`$buyerCol` = ? AND `$sellerCol` = ?)
                   OR (`$buyerCol` = ? AND `$sellerCol` = ?)
                ORDER BY $orderBy
            ");
            $stmt->execute([$currentUserId, $otherUserId, $otherUserId, $currentUserId]);
            $deals = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $dealItems = array_values(array_map(function($deal) use ($currentUserId) {
                $isBought = (int)$deal['buyer_id'] === (int)$currentUserId;

                return [
                    'id' => (int)($deal['id'] ?? 0),
                    'deal_id' => (int)($deal['id'] ?? 0),
                    'transaction_id' => $deal['transaction_id'] ?? '',
                    'channel' => $deal['channel_title'] ?: 'Deal',
                    'price' => (float)($deal['channel_price'] ?? 0),
                    'role' => $isBought ? 'bought' : 'sold',
                    'status' => $deal['deal_status'] ?? '',
                    'buyer_id' => (int)($deal['buyer_id'] ?? 0),
                    'seller_id' => (int)($deal['seller_id'] ?? 0)
                ];
            }, $deals));

            $summary = [
                'totalDeals' => count($deals),
                'channels' => array_values(array_map(function($deal) {
                    return $deal['channel_title'] ?: 'Deal';
                }, $deals)),
                'prices' => array_values(array_map(function($deal) {
                    return (float)($deal['channel_price'] ?? 0);
                }, $deals)),
                'channelsBought' => count(array_filter($deals, function($deal) use ($currentUserId) {
                    return (int)$deal['buyer_id'] === (int)$currentUserId;
                })),
                'channelsSold' => count(array_filter($deals, function($deal) use ($currentUserId) {
                    return (int)$deal['seller_id'] === (int)$currentUserId;
                })),
                'deals' => $dealItems
            ];

            self::$dealsSummaryCache[$cacheKey] = $summary;
            return $summary;
        } catch (Exception $e) {
            error_log('Deal summary error: ' . $e->getMessage());
            return $emptySummary;
        }
    }

    private function checkAdminAccess($user) {
        if (!AuthMiddleware::checkRole($user, ['admin'])) {
            http_response_code(403);
            echo json_encode(['message' => 'Access denied. Admin privileges required.']);
            exit;
        }
    }

    private function checkManagerAccess($user) {
        if (!AuthMiddleware::checkRole($user, ['admin', 'manager'])) {
            http_response_code(403);
            echo json_encode(['message' => 'Access denied. Manager or Admin privileges required.']);
            exit;
        }
    }

    private function checkViewerAccess($user) {
        if (!AuthMiddleware::checkRole($user, ['admin', 'manager', 'viewer'])) {
            http_response_code(403);
            echo json_encode(['message' => 'Access denied. Authorized dashboard access required.']);
            exit;
        }
    }

    // Get total unread messages count for current user (Revision 7)
    public function getUnreadCount() {
        try {
            $user = $this->authMiddleware->authenticate();
            $unreadCount = Message::getUnreadCountForUser((int)$user['id']);
            http_response_code(200);
            echo json_encode(['unreadCount' => $unreadCount, 'success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    // Mark a message as viewed by website agent (Revision 14)
    public function markAgentViewed($messageId) {
        try {
            $user = $this->authMiddleware->authenticate();
            $affected = Message::markAgentViewed((int)$messageId);
            http_response_code(200);
            echo json_encode(['success' => true, 'updated' => $affected]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['message' => $e->getMessage()]);
        }
    }

    // Process unread message reminders for messages unread >= 3 hours (max 2 emails/day, i.e. 12h cooldown)
    public static function processUnreadMessageReminders() {
        try {
            $pdo = Database::getConnection();
            
            // Find users who have unread messages >= 3 hours and haven't received reminder in last 12 hours
            $stmt = $pdo->query("
                SELECT u.id, u.username, u.email, COUNT(m.id) as unreadCount, MAX(m.senderId) as lastSenderId
                FROM users u
                INNER JOIN chat_participants cp ON u.id = cp.userId AND cp.isActive = 1
                INNER JOIN messages m ON cp.chatId = m.chatId AND m.senderId != u.id AND m.isRead = 0
                WHERE u.isBanned = 0
                  AND u.isEmailVerified = 1
                  AND TIMESTAMPDIFF(HOUR, m.createdAt, NOW()) >= 3
                  AND (u.lastUnreadReminderAt IS NULL OR TIMESTAMPDIFF(HOUR, u.lastUnreadReminderAt, NOW()) >= 12)
                GROUP BY u.id, u.username, u.email
            ");
            
            $pendingUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (empty($pendingUsers)) return 0;
            
            $emailService = new EmailService();
            $sentCount = 0;
            
            foreach ($pendingUsers as $usr) {
                if (empty($usr['email'])) continue;
                
                // Get sender username for the latest unread message
                $latestSenderName = '';
                if (!empty($usr['lastSenderId'])) {
                    $sStmt = $pdo->prepare("SELECT username, displayName FROM users WHERE id = ? LIMIT 1");
                    $sStmt->execute([(int)$usr['lastSenderId']]);
                    $sender = $sStmt->fetch(PDO::FETCH_ASSOC);
                    if ($sender) {
                        $latestSenderName = $sender['displayName'] ?: $sender['username'];
                    }
                }
                
                $sent = $emailService->sendUnreadMessagesReminderEmail(
                    $usr['email'],
                    $usr['username'],
                    (int)$usr['unreadCount'],
                    $latestSenderName
                );
                
                if ($sent) {
                    $uStmt = $pdo->prepare("UPDATE users SET lastUnreadReminderAt = NOW() WHERE id = ?");
                    $uStmt->execute([(int)$usr['id']]);
                    $sentCount++;
                }
            }
            return $sentCount;
        } catch (Throwable $e) {
            error_log('Error processing unread message reminders: ' . $e->getMessage());
            return 0;
        }
    }
}