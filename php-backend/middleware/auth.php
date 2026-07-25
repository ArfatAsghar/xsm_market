<?php
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../models/User.php';

class AuthMiddleware {

    /**
     * Central ban checker:
     * - If user is not banned: returns the user as-is.
     * - If user is permanently banned: returns null (or sends error based on $hard).
     * - If user has a time-limited ban that has already EXPIRED: auto-unbans and returns fresh user.
     * - If user has a time-limited ban still active: returns null (or sends error based on $hard).
     *
     * @param array $user  The user row from the database.
     * @param bool  $hard  If true, immediately send an HTTP error response; if false, return null silently.
     * @return array|null  The (possibly refreshed) user, or null if still banned.
     */
    private static function resolveBanStatus(array $user, bool $hard = false) {
        if (!$user['isBanned']) {
            return $user;
        }

        if (!empty($user['banExpires'])) {
            $expires = strtotime($user['banExpires']);
            if ($expires > 0 && $expires <= time()) {
                // Ban has expired — auto-unban and allow access
                User::update($user['id'], [
                    'isBanned'   => 0,
                    'banReason'  => null,
                    'bannedAt'   => null,
                    'bannedBy'   => null,
                    'banExpires' => null,
                    'unbannedAt' => date('Y-m-d H:i:s'),
                    'unbannedBy' => null
                ]);
                return User::findById($user['id']);
            }
        }

        // Banned user remains authenticated so they can create listings and access support chat.
        // Specific endpoints (e.g. direct messaging) enforce ban restrictions individually.
        return $user;
    }

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
            $currentUser = User::findById($decoded['userId']);
            
            if (!$currentUser) {
                Response::error('The user belonging to this token no longer exists.', 401);
            }

            // Check ban status — send hard 403 if banned
            $currentUser = self::resolveBanStatus($currentUser, true);
            // resolveBanStatus will have already called Response::error() if banned;
            // reaching here means the user is allowed.

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
            if (!$user) {
                return null;
            }

            // Resolve ban (auto-unban if expired, return null if still banned)
            return self::resolveBanStatus($user, false);
        } catch (Exception $e) {
            return null;
        }
    }
    
    public static function checkRole($user, $allowedRoles) {
        $role = $user['role'] ?? 'user';
        
        // Fallback for admins
        if ($role === 'user') {
            $adminEmail = getenv('ADMIN_EMAIL');
            $isAdminByEmail = $adminEmail && strtolower($user['email']) === strtolower($adminEmail);
            $isAdminByFlag = !empty($user['isAdmin']);
            if ($isAdminByEmail || $isAdminByFlag) {
                $role = 'admin';
            }
        }
        
        return in_array($role, $allowedRoles);
    }

    public static function requireAdmin() {
        $user = self::authenticate();
        if (!self::checkRole($user, ['admin'])) {
            Response::error('Admin access required. Only authorized admin users can access this resource.', 403);
        }
        return $user;
    }
    
    public static function requireManager() {
        $user = self::authenticate();
        if (!self::checkRole($user, ['admin', 'manager'])) {
            Response::error('Access denied: Manager or Admin access required.', 403);
        }
        return $user;
    }
    
    public static function requireViewer() {
        $user = self::authenticate();
        if (!self::checkRole($user, ['admin', 'manager', 'viewer'])) {
            Response::error('Access denied: Authorized viewer access required.', 403);
        }
        return $user;
    }
}
?>
