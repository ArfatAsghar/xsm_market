<?php
// AuthMiddleware - Converted from Node.js to maintain 100% identical functionality
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../config/database.php';

class AuthMiddleware {
    private $db;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }
    
    // Authenticate method for instance use
    public function authenticate() {
        try {
            // 1) Check if token exists
            $headers = $this->getAllHeaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
            
            $token = null;
            if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = $matches[1];
            }
            
            if (!$token) {
                http_response_code(401);
                echo json_encode(['message' => 'You are not logged in. Please log in to get access.']);
                exit;
            }
            
            // 2) Verify token
            $decoded = JWT::verify($token);
            if (!$decoded) {
                http_response_code(401);
                echo json_encode(['message' => 'Invalid token. Please log in again.']);
                exit;
            }
            
            // 3) Check if user still exists
            $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$decoded['userId']]);
            $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$currentUser) {
                http_response_code(401);
                echo json_encode(['message' => 'The user belonging to this token no longer exists.']);
                exit;
            }
            
            // 4) Return user data for use in controllers
            return $currentUser;
            
        } catch (Exception $error) {
            if (strpos($error->getMessage(), 'expired') !== false) {
                http_response_code(401);
                echo json_encode(['message' => 'Your token has expired. Please log in again.']);
            } else if (strpos($error->getMessage(), 'signature') !== false || strpos($error->getMessage(), 'Invalid') !== false) {
                http_response_code(401);
                echo json_encode(['message' => 'Invalid token. Please log in again.']);
            } else {
                error_log('Auth middleware error: ' . $error->getMessage());
                http_response_code(500);
                echo json_encode(['message' => 'Error checking authentication', 'error' => $error->getMessage()]);
            }
            exit;
        }
    }
    
    // Require admin privileges
    public function requireAdmin() {
        $user = $this->authenticate();
        
        // Check if user has admin privileges (using same logic as Node.js)
        if (!$user['username'] || strpos($user['username'], 'admin') === false) {
            http_response_code(403);
            echo json_encode(['message' => 'Access denied. Admin privileges required.']);
            exit;
        }
        
        return $user;
    }
    
    // Optional authentication - don't exit if no token
    public function optionalAuth() {
        try {
            $headers = $this->getAllHeaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
            
            $token = null;
            if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = $matches[1];
            }
            
            if (!$token) {
                return null;
            }
            
            $decoded = JWT::verify($token);
            if (!$decoded) {
                return null;
            }
            
            $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$decoded['userId']]);
            $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return $currentUser ?: null;
            
        } catch (Exception $error) {
            error_log('Optional auth error: ' . $error->getMessage());
            return null;
        }
    }
    
    // Helper method to get headers (works with PHP built-in server)
    private function getAllHeaders() {
        if (function_exists('getallheaders')) {
            return getallheaders();
        }
        
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $headerName = str_replace('_', '-', substr($key, 5));
                $headerName = ucwords(strtolower($headerName), '-');
                $headers[$headerName] = $value;
            }
        }
        return $headers;
    }
    
    // Static protect method for backward compatibility
    public static function protect() {
        $middleware = new self();
        return $middleware->authenticate();
    }
    
    // Static authenticateToken method for backward compatibility
    public static function authenticateToken() {
        $middleware = new self();
        return $middleware->authenticate();
    }
}
