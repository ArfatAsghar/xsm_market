<?php
require_once __DIR__ . '/../config/database.php';

class ChatParticipant {
    private static $table = 'chat_participants';
    
    public static function create($data) {
        $pdo = Database::getConnection();
        
        // Add timestamp fields
        $data['createdAt'] = date('Y-m-d H:i:s');
        $data['updatedAt'] = date('Y-m-d H:i:s');
        
        $fields = ['chatId', 'userId', 'role', 'isActive', 'joinedAt', 'lastSeenAt', 'createdAt', 'updatedAt'];
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
        if (!isset($data['role'])) {
            $insertFields[] = 'role';
            $insertValues[] = ':role';
            $params[':role'] = 'member';
        }
        
        if (!isset($data['isActive'])) {
            $insertFields[] = 'isActive';
            $insertValues[] = ':isActive';
            $params[':isActive'] = 1;
        }
        
        if (!isset($data['joinedAt'])) {
            $insertFields[] = 'joinedAt';
            $insertValues[] = ':joinedAt';
            $params[':joinedAt'] = date('Y-m-d H:i:s');
        }
        
        $sql = "INSERT INTO " . self::$table . " (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertValues) . ")";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        return $pdo->lastInsertId();
    }
    
    public static function bulkCreate($participants) {
        $pdo = Database::getConnection();
        
        foreach ($participants as $participant) {
            self::create($participant);
        }
        
        return true;
    }
    
    public static function findOne($chatId, $userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE chatId = :chatId AND userId = :userId");
        $stmt->execute([':chatId' => $chatId, ':userId' => $userId]);
        return $stmt->fetch();
    }
    
    public static function findByChatId($chatId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE chatId = :chatId");
        $stmt->execute([':chatId' => $chatId]);
        return $stmt->fetchAll();
    }
    
    public static function findByUserId($userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE userId = :userId AND isActive = 1");
        $stmt->execute([':userId' => $userId]);
        return $stmt->fetchAll();
    }
    
    public static function updateLastSeen($chatId, $userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE " . self::$table . " SET lastSeenAt = NOW() WHERE chatId = :chatId AND userId = :userId");
        return $stmt->execute([':chatId' => $chatId, ':userId' => $userId]);
    }
    
    public static function update($chatId, $userId, $data) {
        $pdo = Database::getConnection();
        
        $fields = [];
        $params = [':chatId' => $chatId, ':userId' => $userId];
        
        foreach ($data as $key => $value) {
            if (!in_array($key, ['chatId', 'userId'])) {
                $fields[] = "$key = :$key";
                $params[":$key"] = $value;
            }
        }
        
        if (empty($fields)) {
            return false;
        }
        
        $sql = "UPDATE " . self::$table . " SET " . implode(', ', $fields) . " WHERE chatId = :chatId AND userId = :userId";
        $stmt = $pdo->prepare($sql);
        return $stmt->execute($params);
    }
    
    public static function deactivate($chatId, $userId) {
        return self::update($chatId, $userId, ['isActive' => 0]);
    }
    
    public static function activate($chatId, $userId) {
        return self::update($chatId, $userId, ['isActive' => 1]);
    }
    
    public static function delete($chatId, $userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM " . self::$table . " WHERE chatId = :chatId AND userId = :userId");
        return $stmt->execute([':chatId' => $chatId, ':userId' => $userId]);
    }
    
    public static function deleteByChat($chatId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM " . self::$table . " WHERE chatId = :chatId");
        return $stmt->execute([':chatId' => $chatId]);
    }
}
?>
