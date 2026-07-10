<?php
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../models/User.php';

class AuthMiddleware {
    public static function protect() {
        $token = null;
        
        // Check for token in Authorization header
        $headers = getallheaders();
        
        // Check for Authorization header (case-insensitive)
        $authHeader = null;
        foreach ($headers as $key => $value) {
            if (strtolower($key) === 'authorization') {
                $authHeader = $value;
                break;
            }
        }
        
        if ($authHeader && strpos($authHeader, 'Bearer ') === 0) {
            $token = substr($authHeader, 7);
        }
        
        // Also check $_SERVER for authorization header (nginx/apache compatibility)
        if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
            if (strpos($authHeader, 'Bearer ') === 0) {
                $token = substr($authHeader, 7);
            }
        }
        
        if (!$token) {
            Response::error('You are not logged in. Please log in to get access.', 401);
        }
        
        try {
            // Verify token
            $decoded = JWT::decode($token, 'access');
            
            if (!isset($decoded['userId'])) {
                Response::error('Invalid token format', 401);
            }
            
            // Check if user still exists
            $user = new User();
            $currentUser = $user->findById($decoded['userId']);
            
            if (!$currentUser) {
                Response::error('The user belonging to this token no longer exists.', 401);
            }
            
            // Update user's last seen timestamp
            User::updateLastSeen($currentUser['id']);
            
            return $currentUser;
            
        } catch (Exception $e) {
            $message = $e->getMessage();
            
            if (strpos($message, 'expired') !== false) {
                Response::error('Your token has expired. Please log in again.', 401);
            }
            if (strpos($message, 'signature') !== false || strpos($message, 'format') !== false) {
                Response::error('Invalid token. Please log in again.', 401);
            }
            
            error_log('Auth middleware error: ' . $e->getMessage());
            Response::error('Error checking authentication', 500);
        }
    }
    
    // For backward compatibility
    public static function authenticate() {
        return self::protect();
    }
    
    public static function optionalAuth() {
        $headers = getallheaders();
        $token = null;
        
        // Check Authorization header
        if (isset($headers['Authorization'])) {
            $authHeader = $headers['Authorization'];
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }
        
        // Check authorization header (lowercase)
        if (!$token && isset($headers['authorization'])) {
            $authHeader = $headers['authorization'];
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }
        
        if (!$token) {
            return null;
        }
        
        try {
            $payload = JWT::decode($token, 'access');
            
            if (!isset($payload['userId'])) {
                return null;
            }
            
            // Get user from database
            $user = User::findById($payload['userId']);
            if (!$user || $user['isBanned']) {
                return null;
            }
            
            return $user;
        } catch (Exception $e) {
            return null;
        }
    }
    
    public static function requireAdmin() {
        $user = self::authenticate();
        
        // Get admin email from environment
        $adminEmail = getenv('ADMIN_EMAIL');
        
        // Debug logging
        error_log('Admin check debug:');
        error_log('User email: ' . ($user['email'] ?? 'null'));
        error_log('Admin email from env: ' . ($adminEmail ?? 'null'));
        error_log('User isAdmin flag: ' . ($user['isAdmin'] ?? 'null'));
        error_log('User isAdmin type: ' . gettype($user['isAdmin'] ?? null));
        
        // Check if user is admin by email or isAdmin flag
        $isAdminByEmail = $adminEmail && strtolower($user['email']) === strtolower($adminEmail);
        $isAdminByFlag = !empty($user['isAdmin']);
        
        error_log('Is admin by email: ' . ($isAdminByEmail ? 'true' : 'false'));
        error_log('Is admin by flag: ' . ($isAdminByFlag ? 'true' : 'false'));
        
        if (!$isAdminByEmail && !$isAdminByFlag) {
            Response::error('Admin access required. Only authorized admin users can access this resource.', 403);
        }
        
        return $user;
    }
}
?>
