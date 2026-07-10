<?php
require_once __DIR__ . '/../config/database.php';

class Chat {
    private static $table = 'chats';
    
    public static function create($data) {
        $pdo = Database::getConnection();
        
        // Add timestamp fields
        $data['createdAt'] = date('Y-m-d H:i:s');
        $data['updatedAt'] = date('Y-m-d H:i:s');
        
        $fields = ['type', 'adId', 'name', 'lastMessage', 'lastMessageTime', 'createdAt', 'updatedAt'];
        $insertFields = [];
        $insertValues = [];
        $params = [];
        
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $insertFields[] = $field;
                $insertValues[] = ':' . $field;
                $params[':' . $field] = $data[$field];
            }
        }
        
        $sql = "INSERT INTO " . self::$table . " (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertValues) . ")";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        return $pdo->lastInsertId();
    }
    
    public static function findById($id) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE id = :id");
        $stmt->execute([':id' => $id]);
        return $stmt->fetch();
    }
    
    public static function findByIdWithDetails($id) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT c.*, 
                   a.id as ad_id, a.title as ad_title, a.price as ad_price
            FROM " . self::$table . " c
            LEFT JOIN ads a ON c.adId = a.id
            WHERE c.id = :id
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $chat = $stmt->fetch();
        
        if ($chat) {
            // Get participants
            $participants = self::getChatParticipants($id);
            $chat['participants'] = $participants;
            
            // Get latest message
            $latestMessage = self::getLatestMessage($id);
            $chat['messages'] = $latestMessage ? [$latestMessage] : [];
            
            // Format ad data
            if ($chat['ad_id']) {
                $chat['ad'] = [
                    'id' => $chat['ad_id'],
                    'title' => $chat['ad_title'],
                    'price' => $chat['ad_price']
                ];
            }
            
            // Clean up
            unset($chat['ad_id'], $chat['ad_title'], $chat['ad_price']);
        }
        
        return $chat;
    }
    
    public static function findByIdWithFullDetails($id) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT c.*, 
                   a.id as ad_id, a.title as ad_title, a.price as ad_price
            FROM " . self::$table . " c
            LEFT JOIN ads a ON c.adId = a.id
            WHERE c.id = :id
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $chat = $stmt->fetch();
        
        if ($chat) {
            // Get participants with user details
            $participants = self::getChatParticipantsWithUsers($id);
            $chat['participants'] = $participants;
            
            // Get latest message with sender details
            $latestMessage = self::getLatestMessageWithSender($id);
            $chat['messages'] = $latestMessage ? [$latestMessage] : [];
            
            // Format ad data
            if ($chat['ad_id']) {
                $chat['ad'] = [
                    'id' => $chat['ad_id'],
                    'title' => $chat['ad_title'],
                    'price' => $chat['ad_price']
                ];
            }
            
            // Clean up
            unset($chat['ad_id'], $chat['ad_title'], $chat['ad_price']);
        }
        
        return $chat;
    }
    
    public static function getUserChats($userId) {
        $pdo = Database::getConnection();
        
        error_log("Fetching chats for user ID: $userId");
        
        $sql = "
            SELECT DISTINCT c.*,
                   a.id as ad_id, a.title as ad_title, a.price as ad_price
            FROM " . self::$table . " c
            INNER JOIN chat_participants cp ON c.id = cp.chatId
            LEFT JOIN ads a ON c.adId = a.id
            WHERE cp.userId = :userId AND cp.isActive = 1
            ORDER BY c.lastMessageTime DESC, c.createdAt DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        $chats = $stmt->fetchAll();
        
        error_log("Found " . count($chats) . " raw chats from database");
        
        $chatsWithParticipants = [];
        foreach ($chats as $chat) {
            error_log("Processing chat ID: " . $chat['id']);
            
            // Get other participants
            try {
                $allParticipants = self::getChatParticipantsWithUsers($chat['id']);
                error_log("Found " . count($allParticipants) . " participants for chat " . $chat['id']);
                
                $otherParticipants = array_filter($allParticipants, function($p) use ($userId) {
                    return $p['userId'] != $userId;
                });
                
                $chat['participants'] = $allParticipants;
                $chat['otherParticipants'] = array_map(function($p) {
                    return $p['user'];
                }, $otherParticipants);
                
                // Get latest message
                $latestMessage = self::getLatestMessageWithSender($chat['id']);
                $chat['messages'] = $latestMessage ? [$latestMessage] : [];
                
                // Format ad data
                if ($chat['ad_id']) {
                    $chat['ad'] = [
                        'id' => $chat['ad_id'],
                        'title' => $chat['ad_title'],
                        'price' => $chat['ad_price']
                    ];
                }
                
                // Clean up
                unset($chat['ad_id'], $chat['ad_title'], $chat['ad_price']);
                
                $chatsWithParticipants[] = $chat;
                
            } catch (Exception $e) {
                error_log("Error processing chat " . $chat['id'] . ": " . $e->getMessage());
                // Continue with other chats instead of failing completely
                continue;
            }
        }
        
        return $chatsWithParticipants;
    }
    
    public static function findDirectChatBetweenUsers($userId1, $userId2) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT c.* 
            FROM " . self::$table . " c
            INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
            INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
            WHERE c.type = 'direct'
            AND cp1.userId = :userId1 AND cp1.isActive = 1
            AND cp2.userId = :userId2 AND cp2.isActive = 1
            LIMIT 1
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':userId1' => $userId1, ':userId2' => $userId2]);
        return $stmt->fetch();
    }
    
    public static function findAdInquiryChatBetweenUsers($adId, $buyerId, $sellerId) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT c.* 
            FROM " . self::$table . " c
            INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
            INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
            WHERE c.type = 'ad_inquiry' AND c.adId = :adId
            AND cp1.userId = :buyerId AND cp1.isActive = 1
            AND cp2.userId = :sellerId AND cp2.isActive = 1
            LIMIT 1
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':adId' => $adId, ':buyerId' => $buyerId, ':sellerId' => $sellerId]);
        return $stmt->fetch();
    }
    
    public static function updateLastMessage($chatId, $message) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE " . self::$table . " SET lastMessage = :message, lastMessageTime = NOW() WHERE id = :id");
        return $stmt->execute([':message' => $message, ':id' => $chatId]);
    }
    
    private static function getChatParticipants($chatId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM chat_participants WHERE chatId = :chatId AND isActive = 1");
        $stmt->execute([':chatId' => $chatId]);
        return $stmt->fetchAll();
    }
    
    private static function getChatParticipantsWithUsers($chatId) {
        $pdo = Database::getConnection();
        $sql = "
            SELECT cp.*, 
                   u.id as user_id, u.username as user_username, u.email as user_email
            FROM chat_participants cp
            INNER JOIN users u ON cp.userId = u.id
            WHERE cp.chatId = :chatId AND cp.isActive = 1
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':chatId' => $chatId]);
        $participants = $stmt->fetchAll();
        
        foreach ($participants as &$participant) {
            $participant['user'] = [
                'id' => $participant['user_id'],
                'username' => $participant['user_username'],
                'email' => $participant['user_email'],
                'fullName' => $participant['user_username'] // Add fullName for frontend compatibility
            ];
            unset($participant['user_id'], $participant['user_username'], $participant['user_email']);
        }
        
        return $participants;
    }
    
    private static function getLatestMessage($chatId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM messages WHERE chatId = :chatId ORDER BY createdAt DESC LIMIT 1");
        $stmt->execute([':chatId' => $chatId]);
        return $stmt->fetch();
    }
    
    private static function getLatestMessageWithSender($chatId) {
        $pdo = Database::getConnection();
        $sql = "
            SELECT m.*, 
                   u.id as sender_id, u.username as sender_username
            FROM messages m
            INNER JOIN users u ON m.senderId = u.id
            WHERE m.chatId = :chatId
            ORDER BY m.createdAt DESC
            LIMIT 1
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':chatId' => $chatId]);
        $message = $stmt->fetch();
        
        if ($message) {
            $message['sender'] = [
                'id' => $message['sender_id'],
                'username' => $message['sender_username']
            ];
            unset($message['sender_id'], $message['sender_username']);
        }
        
        return $message;
    }
    
    public static function update($id, $data) {
        $pdo = Database::getConnection();
        
        $fields = [];
        $params = [':id' => $id];
        
        foreach ($data as $key => $value) {
            if ($key !== 'id') {
                $fields[] = "$key = :$key";
                $params[":$key"] = $value;
            }
        }
        
        if (empty($fields)) {
            return false;
        }
        
        $sql = "UPDATE " . self::$table . " SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        return $stmt->execute($params);
    }
    
    public static function delete($id) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM " . self::$table . " WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}
?>
