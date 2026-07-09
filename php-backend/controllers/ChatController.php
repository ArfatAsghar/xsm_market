<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/Chat.php';
require_once __DIR__ . '/../models/Message.php';
require_once __DIR__ . '/../models/ChatParticipant.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Ad.php';
require_once __DIR__ . '/../config/database.php';

class ChatController {
    private $db;
    private $authMiddleware;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->authMiddleware = new AuthMiddleware();
    }
    
    // Get all chats for a user
    public function getUserChats() {
        try {
            $user = $this->authMiddleware->authenticate();
            $userId = (int)$user['id'];
            
            // Get all chats where user is an active participant
            $stmt = $this->db->prepare("
                SELECT DISTINCT c.*, 
                       a.id as ad_id, a.title as ad_title, a.price as ad_price,
                       m.content as last_message_content, m.createdAt as last_message_time,
                       sender.id as last_sender_id, sender.username as last_sender_username
                FROM chats c
                INNER JOIN chat_participants cp ON c.id = cp.chatId
                LEFT JOIN ads a ON c.adId = a.id
                LEFT JOIN messages m ON c.id = m.chatId 
                LEFT JOIN users sender ON m.senderId = sender.id
                LEFT JOIN messages m2 ON c.id = m2.chatId AND m.createdAt < m2.createdAt
                WHERE cp.userId = ? AND cp.isActive = 1 AND m2.id IS NULL
                ORDER BY c.lastMessageTime DESC
            ");
            $stmt->execute([$userId]);
            $chats = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $result = [];
            foreach ($chats as $chat) {
                // Get all participants for this chat
                $participantStmt = $this->db->prepare("
                    SELECT cp.*, u.id as user_id, u.username, u.email
                    FROM chat_participants cp
                    INNER JOIN users u ON cp.userId = u.id
                    WHERE cp.chatId = ? AND cp.isActive = 1
                ");
                $participantStmt->execute([$chat['id']]);
                $participants = $participantStmt->fetchAll(PDO::FETCH_ASSOC);
                
                // Filter out current user from participants to get "other participants"
                $otherParticipants = array_filter($participants, function($p) use ($userId) {
                    return $p['userId'] !== $userId;
                });
                
                $chatData = [
                    'id' => (int)$chat['id'],
                    'type' => $chat['type'],
                    'name' => $chat['name'],
                    'adId' => $chat['ad_id'] ? (int)$chat['ad_id'] : null,
                    'lastMessage' => $chat['lastMessage'],
                    'lastMessageTime' => $chat['lastMessageTime'],
                    'createdAt' => $chat['createdAt'],
                    'updatedAt' => $chat['updatedAt'],
                    'participants' => array_map(function($p) {
                        return [
                            'userId' => (int)$p['userId'],
                            'role' => $p['role'],
                            'user' => [
                                'id' => (int)$p['user_id'],
                                'username' => $p['username'],
                                'email' => $p['email']
                            ]
                        ];
                    }, $participants),
                    'otherParticipants' => array_map(function($p) {
                        return [
                            'id' => (int)$p['user_id'],
                            'username' => $p['username'],
                            'email' => $p['email']
                        ];
                    }, array_values($otherParticipants)),
                    'messages' => $chat['last_message_content'] ? [[
                        'content' => $chat['last_message_content'],
                        'createdAt' => $chat['last_message_time'],
                        'sender' => [
                            'id' => (int)$chat['last_sender_id'],
                            'username' => $chat['last_sender_username']
                        ]
                    ]] : [],
                    'ad' => $chat['ad_id'] ? [
                        'id' => (int)$chat['ad_id'],
                        'title' => $chat['ad_title'],
                        'price' => (float)$chat['ad_price']
                    ] : null
                ];

                $otherParticipantValues = array_values($otherParticipants);
                if (!empty($otherParticipantValues)) {
                    $chatData['dealSummary'] = $this->getDealSummaryForUserPair(
                        $userId,
                        (int)$otherParticipantValues[0]['user_id']
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
    
    // Create or get existing chat
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
            
            // Check if direct chat already exists between these users
            if ($type === 'direct') {
                $stmt = $this->db->prepare("
                    SELECT c.* FROM chats c
                    INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                    INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                    WHERE c.type = 'direct' 
                    AND cp1.userId = ? AND cp1.isActive = 1
                    AND cp2.userId = ? AND cp2.isActive = 1
                    AND cp1.chatId = cp2.chatId
                ");
                $stmt->execute([$currentUserId, $participantId]);
                $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($existingChat) {
                    http_response_code(200);
                    echo json_encode($existingChat);
                    return;
                }
            }
            
            // Create new chat
            $stmt = $this->db->prepare("
                INSERT INTO chats (type, adId, name, createdAt, updatedAt) 
                VALUES (?, ?, ?, NOW(), NOW())
            ");
            $name = $type === 'group' ? ($input['name'] ?? null) : null;
            $stmt->execute([$type, $adId, $name]);
            $newChatId = $this->db->lastInsertId();
            
            // Add participants
            $stmt = $this->db->prepare("
                INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive) 
                VALUES (?, ?, ?, NOW(), 1)
            ");
            $stmt->execute([$newChatId, $currentUserId, 'admin']);
            $stmt->execute([$newChatId, $participantId, 'member']);
            
            // Fetch complete chat data
            $stmt = $this->db->prepare("
                SELECT c.*, a.id as ad_id, a.title as ad_title, a.price as ad_price
                FROM chats c
                LEFT JOIN ads a ON c.adId = a.id
                WHERE c.id = ?
            ");
            $stmt->execute([$newChatId]);
            $chatData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Get participants
            $stmt = $this->db->prepare("
                SELECT cp.*, u.id as user_id, u.username, u.email
                FROM chat_participants cp
                INNER JOIN users u ON cp.userId = u.id
                WHERE cp.chatId = ? AND cp.isActive = 1
            ");
            $stmt->execute([$newChatId]);
            $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $result = [
                'id' => (int)$chatData['id'],
                'type' => $chatData['type'],
                'name' => $chatData['name'],
                'adId' => $chatData['ad_id'] ? (int)$chatData['ad_id'] : null,
                'createdAt' => $chatData['createdAt'],
                'participants' => array_map(function($p) {
                    return [
                        'userId' => (int)$p['userId'],
                        'role' => $p['role'],
                        'user' => [
                            'id' => (int)$p['user_id'],
                            'username' => $p['username'],
                            'email' => $p['email']
                        ]
                    ];
                }, $participants),
                'ad' => $chatData['ad_id'] ? [
                    'id' => (int)$chatData['ad_id'],
                    'title' => $chatData['ad_title'],
                    'price' => (float)$chatData['ad_price']
                ] : null
            ];
            
            http_response_code(201);
            echo json_encode($result);
        } catch (Exception $e) {
            error_log('Error creating chat: ' . $e->getMessage());
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
            
            // Verify user is participant in this chat
            $stmt = $this->db->prepare("
                SELECT id FROM chat_participants 
                WHERE chatId = ? AND userId = ? AND isActive = 1
            ");
            $stmt->execute([$chatId, $userId]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['message' => 'Access denied']);
                return;
            }
            
            // Get messages
            $stmt = $this->db->prepare("
                SELECT m.*, 
                       sender.id as sender_id, sender.username as sender_username,
                       reply.id as reply_id, reply.content as reply_content,
                       reply_sender.id as reply_sender_id, reply_sender.username as reply_sender_username
                FROM messages m
                INNER JOIN users sender ON m.senderId = sender.id
                LEFT JOIN messages reply ON m.replyToId = reply.id
                LEFT JOIN users reply_sender ON reply.senderId = reply_sender.id
                WHERE m.chatId = ?
                ORDER BY m.createdAt DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->execute([$chatId, $limit, $offset]);
            $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Update last seen
            $stmt = $this->db->prepare("
                UPDATE chat_participants SET lastSeenAt = NOW() 
                WHERE chatId = ? AND userId = ?
            ");
            $stmt->execute([$chatId, $userId]);
            
            // Format messages
            $result = array_map(function($msg) {
                $formatted = [
                    'id' => (int)$msg['id'],
                    'content' => $msg['content'],
                    'senderId' => (int)$msg['senderId'],
                    'chatId' => (int)$msg['chatId'],
                    'messageType' => $msg['messageType'],
                    'mediaUrl' => $msg['mediaUrl'],
                    'fileName' => $msg['fileName'],
                    'fileSize' => $msg['fileSize'] ? (int)$msg['fileSize'] : null,
                    'thumbnail' => $msg['thumbnail'],
                    'isRead' => (bool)$msg['isRead'],
                    'createdAt' => $msg['createdAt'],
                    'updatedAt' => $msg['updatedAt'],
                    'sender' => [
                        'id' => (int)$msg['sender_id'],
                        'username' => $msg['sender_username']
                    ]
                ];
                
                if ($msg['reply_id']) {
                    $formatted['replyTo'] = [
                        'id' => (int)$msg['reply_id'],
                        'content' => $msg['reply_content'],
                        'sender' => [
                            'id' => (int)$msg['reply_sender_id'],
                            'username' => $msg['reply_sender_username']
                        ]
                    ];
                }
                
                return $formatted;
            }, $messages);
            
            // Reverse to get chronological order
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

            // Check if an image is uploaded
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../uploads/chat/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                $fileTmp = $_FILES['image']['tmp_name'];
                $fileName = uniqid('chatimg_') . '_' . basename($_FILES['image']['name']);
                $filePath = $uploadDir . $fileName;
                $publicPath = '/uploads/chat/' . $fileName;
                if (move_uploaded_file($fileTmp, $filePath)) {
                    $content = $publicPath;
                    $messageType = 'image';
                    $mediaUrl = $publicPath;
                } else {
                    http_response_code(500);
                    echo json_encode(['message' => 'Failed to upload image']);
                    return;
                }
            } 
            // Check if a video is uploaded
            elseif (isset($_FILES['video']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../uploads/chat/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0777, true);
                }
                
                // Validate video file size (50MB max)
                $maxSize = 50 * 1024 * 1024; // 50MB
                if ($_FILES['video']['size'] > $maxSize) {
                    http_response_code(400);
                    echo json_encode(['message' => 'Video file size exceeds maximum limit of 50MB']);
                    return;
                }
                
                // Validate video file type
                $allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'];
                $fileType = $_FILES['video']['type'];
                if (!in_array($fileType, $allowedVideoTypes)) {
                    http_response_code(400);
                    echo json_encode(['message' => 'Invalid video file type. Allowed: MP4, AVI, MOV, WMV, WEBM']);
                    return;
                }
                
                $fileTmp = $_FILES['video']['tmp_name'];
                $fileName = uniqid('chatvid_') . '_' . basename($_FILES['video']['name']);
                $filePath = $uploadDir . $fileName;
                $publicPath = '/uploads/chat/' . $fileName;
                if (move_uploaded_file($fileTmp, $filePath)) {
                    $content = $publicPath;
                    $messageType = 'video';
                    $mediaUrl = $publicPath;
                } else {
                    http_response_code(500);
                    echo json_encode(['message' => 'Failed to upload video']);
                    return;
                }
            } else {
                // Fallback to JSON/text input
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

            // Verify user is participant in this chat
            $stmt = $this->db->prepare("
                SELECT id FROM chat_participants 
                WHERE chatId = ? AND userId = ? AND isActive = 1
            ");
            $stmt->execute([$chatId, $senderId]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['message' => 'Access denied']);
                return;
            }

            // Create message
            $stmt = $this->db->prepare("
                INSERT INTO messages (content, senderId, chatId, messageType, replyToId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $stmt->execute([$content, $senderId, $chatId, $messageType, $replyToId]);
            $messageId = $this->db->lastInsertId();

            // Update chat's last message
            $stmt = $this->db->prepare("
                UPDATE chats SET lastMessage = ?, lastMessageTime = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$content, $chatId]);

            // Fetch complete message data
            $stmt = $this->db->prepare("
                SELECT m.*, 
                       sender.id as sender_id, sender.username as sender_username,
                       reply.id as reply_id, reply.content as reply_content,
                       reply_sender.id as reply_sender_id, reply_sender.username as reply_sender_username
                FROM messages m
                INNER JOIN users sender ON m.senderId = sender.id
                LEFT JOIN messages reply ON m.replyToId = reply.id
                LEFT JOIN users reply_sender ON reply.senderId = reply_sender.id
                WHERE m.id = ?
            ");
            $stmt->execute([$messageId]);
            $messageData = $stmt->fetch(PDO::FETCH_ASSOC);

            $result = [
                'id' => (int)$messageData['id'],
                'content' => $messageData['content'],
                'senderId' => (int)$messageData['senderId'],
                'chatId' => (int)$messageData['chatId'],
                'messageType' => $messageData['messageType'],
                'isRead' => (bool)$messageData['isRead'],
                'createdAt' => $messageData['createdAt'],
                'updatedAt' => $messageData['updatedAt'],
                'sender' => [
                    'id' => (int)$messageData['sender_id'],
                    'username' => $messageData['sender_username']
                ]
            ];

            if ($messageData['reply_id']) {
                $result['replyTo'] = [
                    'id' => (int)$messageData['reply_id'],
                    'content' => $messageData['reply_content'],
                    'sender' => [
                        'id' => (int)$messageData['reply_sender_id'],
                        'username' => $messageData['reply_sender_username']
                    ]
                ];
            }

            http_response_code(201);
            echo json_encode($result);
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
            
            // Verify user is participant
            $stmt = $this->db->prepare("
                SELECT id FROM chat_participants 
                WHERE chatId = ? AND userId = ? AND isActive = 1
            ");
            $stmt->execute([$chatId, $userId]);
            if (!$stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['message' => 'Access denied']);
                return;
            }
            
            // Mark all unread messages as read
            $stmt = $this->db->prepare("
                UPDATE messages SET isRead = 1
                WHERE chatId = ? AND senderId != ? AND isRead = 0
            ");
            $stmt->execute([$chatId, $userId]);
            
            http_response_code(200);
            echo json_encode(['message' => 'Messages marked as read']);
        } catch (Exception $e) {
            error_log('Error marking messages as read: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }
    
    // Create ad inquiry chat
    public function createAdInquiryChat() {
        try {
            $user = $this->authMiddleware->authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            
            $adId = (int)($input['adId'] ?? 0);
            $message = trim($input['message'] ?? '');
            $sellerId = isset($input['sellerId']) ? (int)$input['sellerId'] : null;
            $sellerName = $input['sellerName'] ?? null;
            $buyerId = (int)$user['id'];
            
           if (!$adId) {
    http_response_code(400);
    echo json_encode(['message' => 'Ad ID is required']);
    return;
}
            
            // Get ad details
            $stmt = $this->db->prepare("
                SELECT a.*, u.id as seller_id, u.username as seller_username
                FROM ads a
                INNER JOIN users u ON a.userId = u.id
                WHERE a.id = ?
            ");
            $stmt->execute([$adId]);
            $ad = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$ad) {
                http_response_code(404);
                echo json_encode(['message' => 'Ad not found']);
                return;
            }
            
            $actualSellerId = $sellerId ?: (int)$ad['userId'];
            $actualSellerName = $sellerName ?: ($ad['seller_username'] ?: 'Unknown Seller');
            
            if ($actualSellerId === $buyerId) {
                http_response_code(400);
                echo json_encode(['message' => 'Cannot create chat with yourself']);
                return;
            }
            
            // Keep only one conversation per buyer/seller pair. Do not create a new chat for every product.
            $stmt = $this->db->prepare("
                SELECT c.* FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE c.type IN ('ad_inquiry', 'direct')
                AND cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                ORDER BY c.updatedAt DESC
                LIMIT 1
            ");
            $stmt->execute([$buyerId, $actualSellerId]);
            $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existingChat) {
                $chatId = $existingChat['id'];
                error_log("Using existing chat $chatId for buyer $buyerId and seller $actualSellerId for ad $adId");
            } else {
                // Create new ad inquiry chat
                $stmt = $this->db->prepare("
                    INSERT INTO chats (type, adId, name, createdAt, updatedAt) 
                    VALUES ('ad_inquiry', ?, ?, NOW(), NOW())
                ");
                $stmt->execute([$adId, "Chat with $actualSellerName"]);
                $chatId = $this->db->lastInsertId();
                
                // Add participants
                $stmt = $this->db->prepare("
                    INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive) 
                    VALUES (?, ?, ?, NOW(), 1)
                ");
                $stmt->execute([$chatId, $actualSellerId, 'admin']);
                $stmt->execute([$chatId, $buyerId, 'member']);
                
                // Do not auto-send an inquiry message. The buyer must type and send manually.
                if (!empty($message)) {
                    $stmt = $this->db->prepare("
                        INSERT INTO messages (content, senderId, chatId, messageType, createdAt, updatedAt)
                        VALUES (?, ?, ?, 'text', NOW(), NOW())
                    ");
                    $stmt->execute([$message, $buyerId, $chatId]);
                    
                    $stmt = $this->db->prepare("
                        UPDATE chats SET lastMessage = ?, lastMessageTime = NOW()
                        WHERE id = ?
                    ");
                    $stmt->execute([$message, $chatId]);
                }
                
                error_log("Created new chat $chatId for buyer $buyerId and seller $actualSellerId for ad $adId");
            }
            
            // Return chat with details
            $stmt = $this->db->prepare("
                SELECT c.*, a.id as ad_id, a.title as ad_title, a.price as ad_price
                FROM chats c
                LEFT JOIN ads a ON c.adId = a.id
                WHERE c.id = ?
            ");
            $stmt->execute([$chatId]);
            $chatData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Get participants
            $stmt = $this->db->prepare("
                SELECT cp.*, u.id as user_id, u.username, u.email
                FROM chat_participants cp
                INNER JOIN users u ON cp.userId = u.id
                WHERE cp.chatId = ? AND cp.isActive = 1
            ");
            $stmt->execute([$chatId]);
            $participants = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Get latest message
            $stmt = $this->db->prepare("
                SELECT m.*, sender.id as sender_id, sender.username as sender_username
                FROM messages m
                INNER JOIN users sender ON m.senderId = sender.id
                WHERE m.chatId = ?
                ORDER BY m.createdAt DESC
                LIMIT 1
            ");
            $stmt->execute([$chatId]);
            $latestMessage = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $result = [
                'id' => (int)$chatData['id'],
                'type' => $chatData['type'],
                'name' => $chatData['name'],
                'adId' => $chatData['ad_id'] ? (int)$chatData['ad_id'] : null,
                'createdAt' => $chatData['createdAt'],
                'participants' => array_map(function($p) {
                    return [
                        'userId' => (int)$p['userId'],
                        'role' => $p['role'],
                        'user' => [
                            'id' => (int)$p['user_id'],
                            'username' => $p['username'],
                            'email' => $p['email']
                        ]
                    ];
                }, $participants),
                'ad' => $chatData['ad_id'] ? [
                    'id' => (int)$chatData['ad_id'],
                    'title' => $chatData['ad_title'],
                    'price' => (float)$chatData['ad_price']
                ] : null,
                'messages' => $latestMessage ? [[
                    'id' => (int)$latestMessage['id'],
                    'content' => $latestMessage['content'],
                    'createdAt' => $latestMessage['createdAt'],
                    'sender' => [
                        'id' => (int)$latestMessage['sender_id'],
                        'username' => $latestMessage['sender_username']
                    ]
                ]] : []
            ];
            
            http_response_code($existingChat ? 200 : 201);
            echo json_encode($result);
        } catch (Exception $e) {
            error_log('Error creating ad inquiry chat: ' . $e->getMessage());
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
            
            // Check if user is admin
            $this->checkAdminAccess($currentUser);
            error_log("Admin access verified");
            
            $input = json_decode(file_get_contents('php://input'), true);
            error_log("Input received: " . json_encode($input));
            
            $buyerId = (int)($input['buyerId'] ?? 0);
            $sellerId = (int)($input['sellerId'] ?? 0);
            $dealId = (int)($input['dealId'] ?? 0);
            
            error_log("Searching for chat between buyer $buyerId and seller $sellerId");
            
            if (!$buyerId || !$sellerId) {
                error_log("Missing buyer or seller ID");
                http_response_code(400);
                echo json_encode(['message' => 'Buyer ID and Seller ID are required']);
                return;
            }
            
            // Find chat between buyer and seller
            $stmt = $this->db->prepare("
                SELECT c.id as chatId FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                ORDER BY c.createdAt DESC
                LIMIT 1
            ");
            $stmt->execute([$buyerId, $sellerId]);
            $chat = $stmt->fetch(PDO::FETCH_ASSOC);
            
            error_log("Chat query result: " . json_encode($chat));
            
            if (!$chat) {
                error_log("No chat found between users $buyerId and $sellerId");
                http_response_code(404);
                echo json_encode(['message' => 'No chat found between buyer and seller']);
                return;
            }
            
            error_log("Chat found: " . $chat['chatId']);
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
            
            // Check if any active chat already exists between these two users.
            $stmt = $this->db->prepare("
                SELECT c.id FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE c.type IN ('ad_inquiry', 'direct')
                AND cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                ORDER BY c.updatedAt DESC
                LIMIT 1
            ");
            $stmt->execute([$buyerId, $sellerId]);
            $existingChat = $stmt->fetch(PDO::FETCH_ASSOC);
            
            http_response_code(200);
            echo json_encode([
                'exists' => (bool)$existingChat,
                'chatId' => $existingChat ? (int)$existingChat['id'] : null
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
            
            // Check if user is admin
            $this->checkAdminAccess($currentUser);
            
            $input = json_decode(file_get_contents('php://input'), true);
            $content = trim($input['content'] ?? '');
            
            if (empty($content)) {
                http_response_code(400);
                echo json_encode(['message' => 'Message content is required']);
                return;
            }
            
            // Insert message with admin sender
           if (!empty(trim($message))) {
    $stmt = $this->db->prepare("
        INSERT INTO messages (chatId, senderId, content, messageType, isRead, createdAt)
        VALUES (?, ?, ?, 'text', 0, NOW())
    ");
    $stmt->execute([$chatId, $buyerId, trim($message)]);

    $stmt = $this->db->prepare("
        UPDATE chats
        SET lastMessage = ?, lastMessageTime = NOW(), updatedAt = NOW()
        WHERE id = ?
    ");
    $stmt->execute([trim($message), $chatId]);
}
            $messageId = $this->db->lastInsertId();
            
            // Update chat's last message
            $stmt = $this->db->prepare("
                UPDATE chats SET lastMessage = ?, lastMessageTime = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$content, $chatId]);
            
            // Return the new message
            $stmt = $this->db->prepare("
                SELECT m.*, u.username as sender_username
                FROM messages m
                LEFT JOIN users u ON m.senderId = u.id
                WHERE m.id = ?
            ");
            $stmt->execute([$messageId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $result = [
                'id' => (int)$message['id'],
                'content' => $message['content'],
                'sender' => 'Admin',
                'timestamp' => $message['createdAt']
            ];
            
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
            
            // Check if user is admin
            $this->checkAdminAccess($currentUser);
            
            // Delete the message
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
            
            // Check if user is admin
            $this->checkAdminAccess($currentUser);
            
            $this->db->beginTransaction();
            
            // Delete all messages in the chat
            $stmt = $this->db->prepare("DELETE FROM messages WHERE chatId = ?");
            $stmt->execute([$chatId]);
            
            // Delete chat participants
            $stmt = $this->db->prepare("DELETE FROM chat_participants WHERE chatId = ?");
            $stmt->execute([$chatId]);
            
            // Delete the chat
            $stmt = $this->db->prepare("DELETE FROM chats WHERE id = ?");
            $stmt->execute([$chatId]);
            
            $this->db->commit();
            
            if ($stmt->rowCount() > 0) {
                http_response_code(200);
                echo json_encode(['message' => 'Chat deleted successfully']);
            } else {
                http_response_code(404);
                echo json_encode(['message' => 'Chat not found']);
            }
        } catch (Exception $e) {
            $this->db->rollBack();
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

            $stmt = $this->db->prepare("SELECT id, username FROM users WHERE isAdmin = 1 AND id <> ? ORDER BY id ASC LIMIT 1");
            $stmt->execute([$currentUserId]);
            $agent = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$agent) {
                http_response_code(404);
                echo json_encode(['message' => 'Website Agent user is not configured. Please create an admin user first.']);
                return;
            }

            $agentId = (int)$agent['id'];

            $stmt = $this->db->prepare("
                SELECT c.* FROM chats c
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
                        'email' => ''
                    ]]
                ]);
                return;
            }

            $stmt = $this->db->prepare("INSERT INTO chats (type, name, createdAt, updatedAt) VALUES ('direct', 'Website Agent', NOW(), NOW())");
            $stmt->execute();
            $chatId = (int)$this->db->lastInsertId();

            $stmt = $this->db->prepare("INSERT INTO chat_participants (chatId, userId, role, joinedAt, isActive) VALUES (?, ?, ?, NOW(), 1)");
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
                    'email' => ''
                ]]
            ]);
        } catch (Exception $e) {
            error_log('Error creating Website Agent chat: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['message' => 'Server error', 'error' => $e->getMessage()]);
        }
    }

    private function getDealSummaryForUserPair($currentUserId, $otherUserId) {
        try {
            $stmt = $this->db->prepare("
                SELECT channel_title, channel_price, buyer_id, seller_id
                FROM deals
                WHERE (buyer_id = ? AND seller_id = ?)
                   OR (buyer_id = ? AND seller_id = ?)
                ORDER BY created_at DESC
            ");
            $stmt->execute([$currentUserId, $otherUserId, $otherUserId, $currentUserId]);
            $deals = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return [
                'totalDeals' => count($deals),
                'channels' => array_values(array_map(function($deal) {
                    return $deal['channel_title'];
                }, $deals)),
                'prices' => array_values(array_map(function($deal) {
                    return (float)$deal['channel_price'];
                }, $deals)),
                'channelsBought' => count(array_filter($deals, function($deal) use ($currentUserId) {
                    return (int)$deal['buyer_id'] === (int)$currentUserId;
                })),
                'channelsSold' => count(array_filter($deals, function($deal) use ($currentUserId) {
                    return (int)$deal['seller_id'] === (int)$currentUserId;
                }))
            ];
        } catch (Exception $e) {
            return [
                'totalDeals' => 0,
                'channels' => [],
                'prices' => [],
                'channelsBought' => 0,
                'channelsSold' => 0
            ];
        }
    }
    
    // Helper method to check admin access
    private function checkAdminAccess($user) {
        // Check admin email and isAdmin flag
        $adminEmail = getenv('ADMIN_EMAIL');
        
        $isAdmin = false;
        
        // Check if user email matches ADMIN_EMAIL environment variable
        if ($adminEmail && strtolower($user['email']) === strtolower($adminEmail)) {
            $isAdmin = true;
        }
        
        // Also check the isAdmin flag from database
        if (isset($user['isAdmin']) && $user['isAdmin']) {
            $isAdmin = true;
        }
        
        if (!$isAdmin) {
            http_response_code(403);
            echo json_encode(['message' => 'Access denied. Admin privileges required.']);
            exit;
        }
    }
}