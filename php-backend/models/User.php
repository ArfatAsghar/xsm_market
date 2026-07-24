<?php
require_once __DIR__ . '/../config/database.php';

class User {
    private static $table = 'users';
    
    public static function create($data) {
        $pdo = Database::getConnection();
        
        // Hash password if provided
        if (!empty($data['password'])) {
            $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }
        
        $fields = ['username', 'email', 'password', 'profilePicture', 'googleId', 'authProvider', 'isEmailVerified', 'emailOTP', 'otpExpires', 'passwordResetToken', 'passwordResetExpires', 'fullName', 'phone', 'location', 'bio', 'isAdmin', 'isBanned', 'banExpires', 'banReason', 'bannedAt', 'bannedBy', 'unbannedAt', 'unbannedBy', 'role'];
        
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
        if (!isset($data['authProvider'])) {
            $insertFields[] = 'authProvider';
            $insertValues[] = ':authProvider';
            $params[':authProvider'] = 'email';
        }
        
        if (!isset($data['isEmailVerified'])) {
            $insertFields[] = 'isEmailVerified';
            $insertValues[] = ':isEmailVerified';
            $params[':isEmailVerified'] = 0;
        }
        
        if (!isset($data['isAdmin'])) {
            $insertFields[] = 'isAdmin';
            $insertValues[] = ':isAdmin';
            $params[':isAdmin'] = 0;
        }
        
        if (!isset($data['isBanned'])) {
            $insertFields[] = 'isBanned';
            $insertValues[] = ':isBanned';
            $params[':isBanned'] = 0;
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
    
    public static function findByEmail($email) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE email = :email");
        $stmt->execute([':email' => strtolower(trim($email))]);
        return $stmt->fetch();
    }
    
    public static function findByUsername($username) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE username = :username");
        $stmt->execute([':username' => $username]);
        return $stmt->fetch();
    }
    
    public static function findByGoogleId($googleId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE googleId = :googleId");
        $stmt->execute([':googleId' => $googleId]);
        return $stmt->fetch();
    }
    
    public static function update($id, $data) {
        $pdo = Database::getConnection();
        
        // Hash password if provided
        if (!empty($data['password'])) {
            $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }
        
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
    
    public static function verifyPassword($plainPassword, $hashedPassword) {
        return password_verify($plainPassword, $hashedPassword);
    }
    
    public static function generateOTP() {
        return str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }
    
    public static function generateResetToken() {
        return bin2hex(random_bytes(32));
    }
    
    public static function generateUniqueUsername($baseName = 'user') {
        if (!$baseName) {
            $baseName = 'user';
        }
        
        // Clean the base name
        $cleanBaseName = strtolower(preg_replace('/[^a-z0-9]/', '', $baseName));
        $cleanBaseName = substr($cleanBaseName, 0, 20);
        
        if (!$cleanBaseName) {
            $cleanBaseName = 'user';
        }
        
        // First try the clean base name
        $username = $cleanBaseName;
        if (!self::findByUsername($username)) {
            return $username;
        }
        
        // Try with random numbers
        for ($i = 0; $i < 10; $i++) {
            $randomNum = rand(1, 9999);
            $username = $cleanBaseName . $randomNum;
            if (!self::findByUsername($username)) {
                return $username;
            }
        }
        
        // Use timestamp as last resort
        return $cleanBaseName . time();
    }
    
    public static function isUsernameAvailable($username, $currentUserId = null) {
        $pdo = Database::getConnection();
        $sql = "SELECT id FROM " . self::$table . " WHERE username = :username";
        $params = [':username' => $username];
        
        if ($currentUserId) {
            $sql .= " AND id != :currentUserId";
            $params[':currentUserId'] = $currentUserId;
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return !$stmt->fetch();
    }
    
    public static function getAll($limit = 50, $offset = 0) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " ORDER BY createdAt DESC LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    public static function count() {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM " . self::$table);
        $result = $stmt->fetch();
        return $result['count'];
    }
    
    public static function search($searchTerm, $limit = 50) {
        $pdo = Database::getConnection();
        $searchTerm = "%$searchTerm%";
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE username LIKE :search OR email LIKE :search OR fullName LIKE :search ORDER BY createdAt DESC LIMIT :limit");
        $stmt->bindValue(':search', $searchTerm, PDO::PARAM_STR);
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    public static function updateLastSeen($userId) {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE " . self::$table . " SET lastSeenAt = NOW() WHERE id = :userId");
            $stmt->execute([':userId' => $userId]);
            return true;
        } catch (Exception $e) {
            error_log('Error updating lastSeenAt: ' . $e->getMessage());
            return false;
        }
    }
}
?>
