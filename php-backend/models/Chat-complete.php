<?php
// Chat Model - Converted from Node.js Sequelize to maintain 100% identical functionality
require_once __DIR__ . '/../config/database.php';

class Chat {
    private static $table = 'chats';
    
    // Create chat - identical to Sequelize Chat.create()
    public static function create($data) {
        $pdo = Database::getConnection();
        
        // Set default values (matching Sequelize defaults)
        $data['type'] = $data['type'] ?? 'direct';
        $data['isActive'] = $data['isActive'] ?? true;
        
        $fields = ['type', 'name', 'adId', 'lastMessage', 'lastMessageTime', 'isActive'];
        
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
        
        $insertFields[] = 'createdAt';
        $insertFields[] = 'updatedAt';
        $insertValues[] = 'NOW()';
        $insertValues[] = 'NOW()';
        
        $sql = "INSERT INTO " . self::$table . " (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertValues) . ")";
        
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return $pdo->lastInsertId();
        } catch (PDOException $e) {
            error_log('Chat creation error: ' . $e->getMessage());
            throw new Exception('Failed to create chat: ' . $e->getMessage());
        }
    }
    
    // Find chat by ID - identical to Sequelize Chat.findByPk()
    public static function findById($id) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $chat = $stmt->fetch();
        
        if ($chat) {
            $chat = self::formatChatData($chat);
        }
        
        return $chat;
    }
    
    // Find chat by participants - for direct chats
    public static function findDirectChatByParticipants($userId1, $userId2) {
        $pdo = Database::getConnection();
        
        $sql = "SELECT c.* FROM " . self::$table . " c
                JOIN chat_participants cp1 ON c.id = cp1.chatId AND cp1.userId = :userId1
                JOIN chat_participants cp2 ON c.id = cp2.chatId AND cp2.userId = :userId2
                WHERE c.type = 'direct' AND c.isActive = 1
                LIMIT 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':userId1' => $userId1, ':userId2' => $userId2]);
        $chat = $stmt->fetch();
        
        if ($chat) {
            $chat = self::formatChatData($chat);
        }
        
        return $chat;
    }
    
    // Find chat by ad inquiry
    public static function findAdInquiryChat($adId, $buyerId, $sellerId) {
        $pdo = Database::getConnection();
        
        $sql = "SELECT c.* FROM " . self::$table . " c
                JOIN chat_participants cp1 ON c.id = cp1.chatId AND cp1.userId = :buyerId
                JOIN chat_participants cp2 ON c.id = cp2.chatId AND cp2.userId = :sellerId
                WHERE c.type = 'ad_inquiry' AND c.adId = :adId AND c.isActive = 1
                LIMIT 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':adId' => $adId, ':buyerId' => $buyerId, ':sellerId' => $sellerId]);
        $chat = $stmt->fetch();
        
        if ($chat) {
            $chat = self::formatChatData($chat);
        }
        
        return $chat;
    }
    
    // Get user's chats with participants and last message info
    public static function getUserChats($userId, $options = []) {
        $pdo = Database::getConnection();
        
        $limit = $options['limit'] ?? 50;
        $offset = $options['offset'] ?? 0;
        
        $sql = "SELECT c.*, 
                       GROUP_CONCAT(DISTINCT CONCAT(u.id, ':', u.username, ':', COALESCE(u.profilePicture, ''), ':', COALESCE(u.fullName, '')) SEPARATOR '|') as participants,
                       m.content as lastMessageContent,
                       m.senderId as lastMessageSenderId,
                       m.createdAt as lastMessageTime,
                       sender.username as lastMessageSenderName
                FROM " . self::$table . " c
                JOIN chat_participants cp ON c.id = cp.chatId AND cp.userId = :userId AND cp.isActive = 1
                LEFT JOIN chat_participants cp_all ON c.id = cp_all.chatId AND cp_all.isActive = 1
                LEFT JOIN users u ON cp_all.userId = u.id
                LEFT JOIN messages m ON c.id = m.chatId AND m.id = (
                    SELECT MAX(id) FROM messages WHERE chatId = c.id
                )
                LEFT JOIN users sender ON m.senderId = sender.id
                WHERE c.isActive = 1
                GROUP BY c.id
                ORDER BY COALESCE(m.createdAt, c.updatedAt) DESC
                LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':userId', $userId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $chats = [];
        while ($row = $stmt->fetch()) {
            $chat = self::formatChatData($row);
            
            // Parse participants
            $chat['participants'] = [];
            if ($row['participants']) {
                $participantData = explode('|', $row['participants']);
                foreach ($participantData as $participant) {
                    $parts = explode(':', $participant);
                    if (count($parts) >= 4) {
                        $chat['participants'][] = [
                            'id' => (int)$parts[0],
                            'username' => $parts[1],
                            'profilePicture' => $parts[2] ?: null,
                            'fullName' => $parts[3] ?: null
                        ];
                    }
                }
            }
            
            // Last message info
            if ($row['lastMessageContent']) {
                $chat['lastMessage'] = [
                    'content' => $row['lastMessageContent'],
                    'senderId' => (int)$row['lastMessageSenderId'],
                    'senderName' => $row['lastMessageSenderName'],
                    'createdAt' => $row['lastMessageTime']
                ];
            }
            
            $chats[] = $chat;
        }
        
        return $chats;
    }
    
    // Update chat - identical to Sequelize chat.update()
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
        
        $fields[] = "updatedAt = NOW()";
        
        $sql = "UPDATE " . self::$table . " SET " . implode(', ', $fields) . " WHERE id = :id";
        
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return self::findById($id);
        } catch (PDOException $e) {
            error_log('Chat update error: ' . $e->getMessage());
            throw new Exception('Failed to update chat: ' . $e->getMessage());
        }
    }
    
    // Update last message info
    public static function updateLastMessage($chatId, $messageContent, $messageTime = null) {
        $messageTime = $messageTime ?: date('Y-m-d H:i:s');
        
        return self::update($chatId, [
            'lastMessage' => $messageContent,
            'lastMessageTime' => $messageTime
        ]);
    }
    
    // Delete chat - identical to Sequelize chat.destroy()
    public static function delete($id) {
        $pdo = Database::getConnection();
        
        // Soft delete by setting isActive to false
        $stmt = $pdo->prepare("UPDATE " . self::$table . " SET isActive = 0, updatedAt = NOW() WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
    
    // Count user's chats
    public static function countUserChats($userId) {
        $pdo = Database::getConnection();
        
        $sql = "SELECT COUNT(*) as count FROM " . self::$table . " c
                JOIN chat_participants cp ON c.id = cp.chatId 
                WHERE cp.userId = :userId AND c.isActive = 1 AND cp.isActive = 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':userId' => $userId]);
        
        return $stmt->fetch()['count'];
    }
    
    // Format chat data - converts boolean and numeric fields
    private static function formatChatData($chat) {
        if (!$chat) return null;
        
        // Convert boolean fields
        $chat['isActive'] = (bool)$chat['isActive'];
        
        // Convert numeric fields
        $chat['id'] = (int)$chat['id'];
        if ($chat['adId']) {
            $chat['adId'] = (int)$chat['adId'];
        }
        
        return $chat;
    }
}
