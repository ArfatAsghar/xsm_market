<?php
// Load environment variables
require_once __DIR__ . '/env.php';

// Load .env file
loadEnv();

class Database {
    private static $connection = null;
    private static $host;
    private static $dbname;
    private static $username;
    private static $password;
    
    public static function init() {
        self::$host = getenv('DB_HOST');
        self::$dbname = getenv('DB_NAME');
        self::$username = getenv('DB_USER');
        self::$password = getenv('DB_PASSWORD');
        
        // Validate required environment variables
        if (!self::$host || !self::$dbname || !self::$username) {
            error_log('❌ Missing required database environment variables');
            error_log('DB_HOST: ' . (self::$host ?: 'NOT SET'));
            error_log('DB_NAME: ' . (self::$dbname ?: 'NOT SET'));
            error_log('DB_USER: ' . (self::$username ?: 'NOT SET'));
            error_log('DB_PASSWORD: ' . (self::$password ? 'SET' : 'NOT SET'));
            throw new Exception('Database configuration incomplete. Please set DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD environment variables.');
        }
    }
    
    public static function getConnection() {
        if (self::$connection === null) {
            self::init();
            
            try {
                $dsn = "mysql:host=" . self::$host . ";dbname=" . self::$dbname . ";charset=utf8mb4";
                self::$connection = new PDO($dsn, self::$username, self::$password, [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false
                ]);
                
                // Set charset and timezone
                self::$connection->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
                self::$connection->exec("SET time_zone = '+00:00'");
                
                // Run auto-migrations / schema updates
                self::runSchemaUpdates(self::$connection);
                
                error_log('✅ Database connection established successfully');
            } catch (PDOException $e) {
                error_log('❌ Database connection failed: ' . $e->getMessage());
                throw new Exception('Database connection failed: ' . $e->getMessage());
            }
        }
        
        return self::$connection;
    }
    
    private static function runSchemaUpdates($pdo) {
        try {
            // Check & add support_requested, support_requested_at to chats table
            $chatsColumns = $pdo->query("SHOW COLUMNS FROM chats")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('support_requested', $chatsColumns)) {
                $pdo->exec("ALTER TABLE chats ADD COLUMN support_requested TINYINT(1) DEFAULT 0");
                error_log("Added 'support_requested' column to chats table");
            }
            if (!in_array('support_requested_at', $chatsColumns)) {
                $pdo->exec("ALTER TABLE chats ADD COLUMN support_requested_at DATETIME NULL");
                error_log("Added 'support_requested_at' column to chats table");
            }

            // Check & add transaction_id to deals table
            $dealsColumns = $pdo->query("SHOW COLUMNS FROM deals")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('transaction_id', $dealsColumns)) {
                $pdo->exec("ALTER TABLE deals ADD COLUMN transaction_id VARCHAR(50) NULL");
                error_log("Added 'transaction_id' column to deals table");
            }

            // Check & add preferredPaymentMethods to ads table
            if (!in_array('preferredPaymentMethods', $dealsColumns)) {
                $adsColumns = $pdo->query("SHOW COLUMNS FROM ads")->fetchAll(PDO::FETCH_COLUMN);
                if (!in_array('preferredPaymentMethods', $adsColumns)) {
                    $pdo->exec("ALTER TABLE ads ADD COLUMN preferredPaymentMethods TEXT NULL");
                    error_log("Added 'preferredPaymentMethods' column to ads table");
                }
            }

            // Backfill & normalize any deals missing or using legacy prefixes to TXN0001 format
            $pdo->exec("
                UPDATE deals 
                SET transaction_id = CONCAT('TXN', LPAD(CAST(REPLACE(REPLACE(REPLACE(transaction_id, 'TXN-', ''), 'TXN', ''), 'XSM', '') AS UNSIGNED), 4, '0'))
                WHERE transaction_id IS NOT NULL AND transaction_id != '' AND transaction_id NOT LIKE 'TXN%';

                UPDATE deals 
                SET transaction_id = CONCAT('TXN', LPAD(id, 4, '0')) 
                WHERE transaction_id IS NULL OR transaction_id = '' OR transaction_id = '0';
            ");

            // Check & add banExpires to users table
            $usersColumns = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('banExpires', $usersColumns)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN banExpires DATETIME NULL DEFAULT NULL");
                error_log("Added 'banExpires' column to users table");
            }

            // Check & add role to users table
            if (!in_array('role', $usersColumns)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
                error_log("Added 'role' column to users table");
                // Update existing admins to have admin role
                $pdo->exec("UPDATE users SET role = 'admin' WHERE isAdmin = 1");
            }

            // Check & add lastSeenAt and isOnline to users table
            if (!in_array('lastSeenAt', $usersColumns)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN lastSeenAt DATETIME NULL DEFAULT NULL");
                error_log("Added 'lastSeenAt' column to users table");
            }
            if (!in_array('isOnline', $usersColumns)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN isOnline TINYINT(1) DEFAULT 0");
                error_log("Added 'isOnline' column to users table");
            }

            // Check & add vipUntil column to users table
            if (!in_array('vipUntil', $usersColumns)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN vipUntil DATETIME NULL DEFAULT NULL");
                error_log("Added 'vipUntil' column to users table");
            }

            // Check & add displayName column to users table (for admin display name system)
            if (!in_array('displayName', $usersColumns)) {
                $pdo->exec("ALTER TABLE users ADD COLUMN displayName VARCHAR(100) NULL DEFAULT NULL");
                error_log("Added 'displayName' column to users table");
            }

            // Check & add listing ban columns to ads table
            $adsColumns = $pdo->query("SHOW COLUMNS FROM ads")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('isBanned', $adsColumns)) {
                $pdo->exec("ALTER TABLE ads ADD COLUMN isBanned TINYINT(1) DEFAULT 0");
                error_log("Added 'isBanned' column to ads table");
            }
            if (!in_array('banReason', $adsColumns)) {
                $pdo->exec("ALTER TABLE ads ADD COLUMN banReason VARCHAR(500) NULL DEFAULT NULL");
                error_log("Added 'banReason' column to ads table");
            }
            if (!in_array('bannedAt', $adsColumns)) {
                $pdo->exec("ALTER TABLE ads ADD COLUMN bannedAt DATETIME NULL DEFAULT NULL");
                error_log("Added 'bannedAt' column to ads table");
            }
            if (!in_array('bannedBy', $adsColumns)) {
                $pdo->exec("ALTER TABLE ads ADD COLUMN bannedBy INT NULL DEFAULT NULL");
                error_log("Added 'bannedBy' column to ads table");
            }
            if (!in_array('verificationCode', $adsColumns)) {
                $pdo->exec("ALTER TABLE ads ADD COLUMN verificationCode VARCHAR(50) NULL DEFAULT NULL");
                error_log("Added 'verificationCode' column to ads table");
            }

            // Check & add message status column for tick system (Revision 14)
            $messagesColumns = $pdo->query("SHOW COLUMNS FROM messages")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('status', $messagesColumns)) {
                $pdo->exec("ALTER TABLE messages ADD COLUMN status ENUM('sent','delivered','read','agent_viewed') NOT NULL DEFAULT 'sent'");
                error_log("Added 'status' column to messages table");
            }
            if (!in_array('readAt', $messagesColumns)) {
                $pdo->exec("ALTER TABLE messages ADD COLUMN readAt DATETIME NULL DEFAULT NULL");
                error_log("Added 'readAt' column to messages table");
            }

            // Check & add unread_count tracking to chats (Revision 7)
            $chatsColumns = $pdo->query("SHOW COLUMNS FROM chats")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('unread_count', $chatsColumns)) {
                $pdo->exec("ALTER TABLE chats ADD COLUMN unread_count INT DEFAULT 0");
                error_log("Added 'unread_count' column to chats table");
            }

            // Create vip_purchases table if missing
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS vip_purchases (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    months INT NOT NULL DEFAULT 1,
                    amount DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");

            // Create website_updates table if missing
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS website_updates (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ");
        } catch (Throwable $e) {
            error_log('Schema update failed: ' . $e->getMessage());
        }
    }
    
    public static function testConnection() {
        try {
            $pdo = self::getConnection();
            $stmt = $pdo->query('SELECT 1');
            return true;
        } catch (Exception $e) {
            error_log('Database test failed: ' . $e->getMessage());
            return false;
        }
    }
    
    public static function beginTransaction() {
        return self::getConnection()->beginTransaction();
    }
    
    public static function commit() {
        return self::getConnection()->commit();
    }
    
    public static function rollback() {
        return self::getConnection()->rollback();
    }
    
    public static function lastInsertId() {
        return self::getConnection()->lastInsertId();
    }
}
?>
