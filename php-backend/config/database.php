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
                
                error_log('✅ Database connection established successfully');
            } catch (PDOException $e) {
                error_log('❌ Database connection failed: ' . $e->getMessage());
                throw new Exception('Database connection failed');
            }
        }
        
        return self::$connection;
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
