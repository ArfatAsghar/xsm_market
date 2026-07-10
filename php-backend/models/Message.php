<?php
require_once __DIR__ . '/../config/database.php';

class Message {
    private static $table = 'messages';
    
    public static function create($data) {
        $pdo = Database::getConnection();
        
        // Add timestamp fields
        $data['createdAt'] = date('Y-m-d H:i:s');
        $data['updatedAt'] = date('Y-m-d H:i:s');
        
        $fields = ['content', 'senderId', 'chatId', 'messageType', 'replyToId', 'isRead', 'createdAt', 'updatedAt'];
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
        
        // Set defaults
        if (!isset($data['messageType'])) {
            $insertFields[] = 'messageType';
            $insertValues[] = ':messageType';
            $params[':messageType'] = 'text';
        }
        
        if (!isset($data['isRead'])) {
            $insertFields[] = 'isRead';
            $insertValues[] = ':isRead';
            $params[':isRead'] = 0;
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
            SELECT m.*,
                   u.id as sender_id, u.username as sender_username,
                   rm.id as reply_id, rm.content as reply_content,
                   ru.id as reply_sender_id, ru.username as reply_sender_username
            FROM " . self::$table . " m
            INNER JOIN users u ON m.senderId = u.id
            LEFT JOIN " . self::$table . " rm ON m.replyToId = rm.id
            LEFT JOIN users ru ON rm.senderId = ru.id
            WHERE m.id = :id
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $message = $stmt->fetch();
        
        if ($message) {
            // Format sender
            $message['sender'] = [
                'id' => $message['sender_id'],
                'username' => $message['sender_username']
            ];
            
            // Format reply if exists
            if ($message['reply_id']) {
                $message['replyTo'] = [
                    'id' => $message['reply_id'],
                    'content' => $message['reply_content'],
                    'sender' => [
                        'id' => $message['reply_sender_id'],
                        'username' => $message['reply_sender_username']
                    ]
                ];
            }
            
            // Clean up
            unset($message['sender_id'], $message['sender_username']);
            unset($message['reply_id'], $message['reply_content']);
            unset($message['reply_sender_id'], $message['reply_sender_username']);
        }
        
        return $message;
    }
    
    public static function getChatMessages($chatId, $page = 1, $limit = 50) {
        $pdo = Database::getConnection();
        $offset = ($page - 1) * $limit;
        
        $sql = "
            SELECT m.*,
                   u.id as sender_id, u.username as sender_username,
                   rm.id as reply_id, rm.content as reply_content,
                   ru.id as reply_sender_id, ru.username as reply_sender_username
            FROM " . self::$table . " m
            INNER JOIN users u ON m.senderId = u.id
            LEFT JOIN " . self::$table . " rm ON m.replyToId = rm.id
            LEFT JOIN users ru ON rm.senderId = ru.id
            WHERE m.chatId = :chatId
            ORDER BY m.createdAt DESC
            LIMIT :limit OFFSET :offset
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':chatId', $chatId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $messages = $stmt->fetchAll();
        
        foreach ($messages as &$message) {
            // Format sender
            $message['sender'] = [
                'id' => $message['sender_id'],
                'username' => $message['sender_username']
            ];
            
            // Format reply if exists
            if ($message['reply_id']) {
                $message['replyTo'] = [
                    'id' => $message['reply_id'],
                    'content' => $message['reply_content'],
                    'sender' => [
                        'id' => $message['reply_sender_id'],
                        'username' => $message['reply_sender_username']
                    ]
                ];
            }
            
            // Clean up
            unset($message['sender_id'], $message['sender_username']);
            unset($message['reply_id'], $message['reply_content']);
            unset($message['reply_sender_id'], $message['reply_sender_username']);
        }
        
        return $messages;
    }
    
    public static function markAsRead($chatId, $userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE " . self::$table . " SET isRead = 1 WHERE chatId = :chatId AND senderId != :userId AND isRead = 0");
        return $stmt->execute([':chatId' => $chatId, ':userId' => $userId]);
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
    
    public static function deleteByChat($chatId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM " . self::$table . " WHERE chatId = :chatId");
        return $stmt->execute([':chatId' => $chatId]);
    }
    
    // Get new messages since a specific message ID (for real-time polling)
    public static function getNewMessagesSince($chatId, $sinceId = 0) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT m.*,
                   u.id as sender_id, u.username as sender_username,
                   rm.id as reply_id, rm.content as reply_content,
                   ru.id as reply_sender_id, ru.username as reply_sender_username
            FROM " . self::$table . " m
            INNER JOIN users u ON m.senderId = u.id
            LEFT JOIN " . self::$table . " rm ON m.replyToId = rm.id
            LEFT JOIN users ru ON rm.senderId = ru.id
            WHERE m.chatId = :chatId AND m.id > :sinceId
            ORDER BY m.createdAt ASC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':chatId', $chatId, PDO::PARAM_INT);
        $stmt->bindValue(':sinceId', (int)$sinceId, PDO::PARAM_INT);
        $stmt->execute();
        
        $messages = $stmt->fetchAll();
        
        foreach ($messages as &$message) {
            // Format sender
            $message['sender'] = [
                'id' => $message['sender_id'],
                'username' => $message['sender_username']
            ];
            
            // Format reply if exists
            if ($message['reply_id']) {
                $message['replyTo'] = [
                    'id' => $message['reply_id'],
                    'content' => $message['reply_content'],
                    'sender' => [
                        'id' => $message['reply_sender_id'],
                        'username' => $message['reply_sender_username']
                    ]
                ];
            }
            
            // Clean up
            unset($message['sender_id'], $message['sender_username']);
            unset($message['reply_id'], $message['reply_content']);
            unset($message['reply_sender_id'], $message['reply_sender_username']);
        }
        
        return $messages;
    }
}
?>
