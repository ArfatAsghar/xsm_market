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
                
                // Run auto-migrations — wrapped so schema errors never crash the API
                try {
                    self::runSchemaUpdates(self::$connection);
                } catch (Throwable $schemaErr) {
                    error_log('⚠️ Schema update warning (non-fatal, API continues): ' . $schemaErr->getMessage());
                }
                
                error_log('✅ Database connection established successfully');
            } catch (Throwable $e) {
                error_log('❌ Database connection failed: ' . $e->getMessage());
                throw new Exception('Database connection failed: ' . $e->getMessage());
            }
        }
        
        return self::$connection;
    }
    
    // Helper: safely check if a table exists
    private static function tableExists($pdo, $table) {
        try {
            $r = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table));
            return $r && $r->rowCount() > 0;
        } catch (Throwable $e) {
            return false;
        }
    }

    // Helper: safely get columns for a table
    private static function getColumns($pdo, $table) {
        try {
            return $pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(PDO::FETCH_COLUMN);
        } catch (Throwable $e) {
            error_log("getColumns($table) failed: " . $e->getMessage());
            return [];
        }
    }

    // Helper: safely add a column if it doesn't exist
    private static function addColumnIfMissing($pdo, $table, $column, $definition) {
        try {
            $cols = self::getColumns($pdo, $table);
            if (!in_array($column, $cols)) {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN $column $definition");
                error_log("Added '$column' column to $table table");
            }
        } catch (Throwable $e) {
            error_log("addColumnIfMissing($table, $column) failed: " . $e->getMessage());
        }
    }

    private static function runSchemaUpdates($pdo) {
        // Each block is independently wrapped — one failure never stops the rest

        // ── chats table ──────────────────────────────────────────────────────────
        if (self::tableExists($pdo, 'chats')) {
            self::addColumnIfMissing($pdo, 'chats', 'support_requested', 'TINYINT(1) DEFAULT 0');
            self::addColumnIfMissing($pdo, 'chats', 'support_requested_at', 'DATETIME NULL');
            self::addColumnIfMissing($pdo, 'chats', 'unread_count', 'INT DEFAULT 0');
        }

        // ── deals table ──────────────────────────────────────────────────────────
        if (self::tableExists($pdo, 'deals')) {
            self::addColumnIfMissing($pdo, 'deals', 'transaction_id', 'VARCHAR(50) NULL');

            // Backfill TXN IDs — two separate exec() calls (PDO doesn't support multi-statement)
            try {
                $pdo->exec("UPDATE deals SET transaction_id = CONCAT('TXN', LPAD(CAST(REPLACE(REPLACE(REPLACE(transaction_id, 'TXN-', ''), 'TXN', ''), 'XSM', '') AS UNSIGNED), 4, '0')) WHERE transaction_id IS NOT NULL AND transaction_id != '' AND transaction_id NOT LIKE 'TXN%'");
                $pdo->exec("UPDATE deals SET transaction_id = CONCAT('TXN', LPAD(id, 4, '0')) WHERE transaction_id IS NULL OR transaction_id = '' OR transaction_id = '0'");
            } catch (Throwable $e) {
                error_log('TXN backfill warning: ' . $e->getMessage());
            }
        }

        // ── ads table ────────────────────────────────────────────────────────────
        if (self::tableExists($pdo, 'ads')) {
            self::addColumnIfMissing($pdo, 'ads', 'preferredPaymentMethods', 'TEXT NULL');
            self::addColumnIfMissing($pdo, 'ads', 'isBanned', 'TINYINT(1) DEFAULT 0');
            self::addColumnIfMissing($pdo, 'ads', 'banReason', 'VARCHAR(500) NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'ads', 'bannedAt', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'ads', 'bannedBy', 'INT NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'ads', 'verificationCode', 'VARCHAR(50) NULL DEFAULT NULL');
        }

        // ── users table ──────────────────────────────────────────────────────────
        if (self::tableExists($pdo, 'users')) {
            self::addColumnIfMissing($pdo, 'users', 'isBanned', 'TINYINT(1) DEFAULT 0');
            self::addColumnIfMissing($pdo, 'users', 'banReason', 'VARCHAR(500) NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'bannedAt', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'bannedBy', 'INT NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'banExpires', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'role', "VARCHAR(20) DEFAULT 'user'");
            self::addColumnIfMissing($pdo, 'users', 'lastSeenAt', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'isOnline', 'TINYINT(1) DEFAULT 0');
            self::addColumnIfMissing($pdo, 'users', 'lastSeen', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'vipUntil', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'displayName', 'VARCHAR(100) NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'users', 'lastUnreadReminderAt', 'DATETIME NULL DEFAULT NULL');

            // Set admin role for existing admins
            try {
                $pdo->exec("UPDATE users SET role = 'admin' WHERE isAdmin = 1 AND (role IS NULL OR role = 'user')");
            } catch (Throwable $e) {
                error_log('Admin role backfill warning: ' . $e->getMessage());
            }
        }

        // ── messages table ───────────────────────────────────────────────────────
        if (self::tableExists($pdo, 'messages')) {
            self::addColumnIfMissing($pdo, 'messages', 'status', "ENUM('sent','delivered','read','agent_viewed') NOT NULL DEFAULT 'sent'");
            self::addColumnIfMissing($pdo, 'messages', 'readAt', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'messages', 'deliveredAt', 'DATETIME NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'messages', 'staffDisplayName', 'VARCHAR(100) NULL DEFAULT NULL');
            self::addColumnIfMissing($pdo, 'messages', 'isStaffMessage', 'TINYINT(1) NOT NULL DEFAULT 0');
        }

        // ── vip_purchases table ──────────────────────────────────────────────────
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS vip_purchases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                months INT NOT NULL DEFAULT 1,
                amount DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");
        } catch (Throwable $e) {
            error_log('vip_purchases create warning: ' . $e->getMessage());
        }

        // ── website_updates table ────────────────────────────────────────────────
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS website_updates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");
            // Seed defaults if empty
            $count = $pdo->query("SELECT COUNT(*) FROM website_updates")->fetchColumn();
            if ($count == 0) {
                $pdo->exec("INSERT INTO website_updates (title, description) VALUES
                    ('🚀 Welcome to XSM Market', 'Experience secure social media account trading with 100% verified escrow protection.'),
                    ('⚡ Real-Time Notifications Active', 'Receive instant deal stage updates, in-app audio alerts, and direct message notifications.')");
            }
        } catch (Throwable $e) {
            error_log('website_updates create/seed warning: ' . $e->getMessage());
        }

        // ── notifications table ──────────────────────────────────────────────────
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                userId INT NOT NULL,
                type VARCHAR(50) NOT NULL DEFAULT 'system',
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                link VARCHAR(500) NULL DEFAULT NULL,
                isRead TINYINT(1) NOT NULL DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_userId (userId),
                INDEX idx_isRead (isRead),
                INDEX idx_createdAt (createdAt)
            )");
            $pdo->exec("ALTER TABLE notifications MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'system'");
        } catch (Throwable $e) {
            error_log('notifications create warning: ' . $e->getMessage());
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
