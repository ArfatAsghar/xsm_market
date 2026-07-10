<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../models/User.php';

class UserController {
    private $db;
    private $user;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->user = new User($this->db);
    }

    public function getProfile() {
        $userId = requireAuth();
        
        $user = $this->user->findById($userId);
        
        if (!$user) {
            errorResponse('User not found', 404);
        }

        // Remove sensitive information
        unset($user['password'], $user['otp'], $user['otpExpiry'], $user['resetPasswordToken'], $user['resetPasswordExpiry']);

        successResponse($user);
    }

    public function updateProfile() {
        $userId = requireAuth();
        $input = getJsonInput();
        
        if (!$input) {
            errorResponse('Invalid JSON input');
        }

        $updateData = [];
        $allowedFields = ['username', 'profilePicture'];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $input)) {
                $updateData[$field] = trim($input[$field]);
            }
        }

        if (empty($updateData)) {
            errorResponse('No valid fields to update');
        }

        // Check username availability if updating username
        if (isset($updateData['username'])) {
            if (!$this->user->isUsernameAvailable($updateData['username'], $userId)) {
                errorResponse('Username is already taken');
            }
        }

        if (!$this->user->update($userId, $updateData)) {
            errorResponse('Failed to update profile');
        }

        $updatedUser = $this->user->findById($userId);
        unset($updatedUser['password'], $updatedUser['otp'], $updatedUser['otpExpiry'], $updatedUser['resetPasswordToken'], $updatedUser['resetPasswordExpiry']);

        successResponse($updatedUser, 'Profile updated successfully');
    }

    public function changePassword() {
        $userId = requireAuth();
        $input = getJsonInput();
        
        if (!$input) {
            errorResponse('Invalid JSON input');
        }

        $currentPassword = $input['currentPassword'] ?? '';
        $newPassword = $input['newPassword'] ?? '';

        if (!$newPassword) {
            errorResponse('Please provide new password');
        }

        if (strlen($newPassword) < 6) {
            errorResponse('New password must be at least 6 characters long');
        }

        $user = $this->user->findById($userId);
        
        if (!$user) {
            errorResponse('User not found', 404);
        }

        // Check if user is Google user
        $isGoogleUser = $user['authProvider'] === 'google';
        
        if (!$isGoogleUser) {
            // For email users, current password is required
            if (!$currentPassword) {
                errorResponse('Please provide current password');
            }
            
            // Verify current password
            if (!$this->user->verifyPassword($currentPassword, $user['password'])) {
                errorResponse('Current password is incorrect');
            }
        }
        // For Google users, we don't need to verify current password as they may not have one

        // Update password
        if (!$this->user->update($userId, ['password' => $newPassword])) {
            errorResponse('Failed to update password');
        }

        successResponse(null, 'Password changed successfully');
    }

    public function getUserByUsername() {
        $pathParts = explode('/', $_SERVER['PATH_INFO'] ?? '');
        $username = end($pathParts);

        if (!$username) {
            errorResponse('Username required');
        }

        // Remove @ prefix if present (for /@username format)
        if (strpos($username, '@') === 0) {
            $username = substr($username, 1);
        }

        $user = $this->user->findByUsername($username);
        
        if (!$user) {
            errorResponse('User not found', 404);
        }

        // Get ad count for this user
        $adCount = 0;
        try {
            $stmt = $this->db->prepare("SELECT COUNT(*) as count FROM ads WHERE userId = ? AND status = 1");
            $stmt->execute([$user['id']]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $adCount = (int)$result['count'];
        } catch (Exception $e) {
            error_log('Error counting user ads: ' . $e->getMessage());
        }

        // Return public information with additional fields
        $publicUser = [
            'id' => $user['id'],
            'username' => $user['username'],
            'fullName' => $user['fullName'] ?? null,
            'profilePicture' => $user['profilePicture'] ?? null,
            'description' => $user['description'] ?? null,
            'createdAt' => $user['createdAt'],
            'isEmailVerified' => (bool)$user['isEmailVerified'],
            'adCount' => $adCount
        ];

        successResponse($publicUser);
    }

    public function checkUsernameAvailability() {
        $userId = optionalAuth(); // Optional auth for logged-in users
        $username = $_GET['username'] ?? '';
        
        if (!$username) {
            errorResponse('Username parameter required');
        }

        $isAvailable = $this->user->isUsernameAvailable($username, $userId);

        successResponse([
            'username' => $username,
            'available' => $isAvailable
        ]);
    }

    public function deleteAccount() {
        $userId = requireAuth();
        $input = getJsonInput();
        
        if (!$input) {
            errorResponse('Invalid JSON input');
        }

        $password = $input['password'] ?? '';

        if (!$password) {
            errorResponse('Password required to delete account');
        }

        $user = $this->user->findById($userId);
        
        if (!$user) {
            errorResponse('User not found', 404);
        }

        // Verify password
        if (!$this->user->verifyPassword($password, $user['password'])) {
            errorResponse('Incorrect password');
        }

        // Soft delete by updating status (you might want to implement this)
        // For now, we'll update the user to be inactive
        if (!$this->user->update($userId, ['isVerified' => false, 'deletedAt' => date('Y-m-d H:i:s')])) {
            errorResponse('Failed to delete account');
        }

        successResponse(null, 'Account deleted successfully');
    }
}

// Handle the request
setCorsHeaders();

$controller = new UserController();
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['PATH_INFO'] ?? '';

switch ($method) {
    case 'GET':
        if (strpos($path, '/profile') !== false) {
            $controller->getProfile();
        } elseif (strpos($path, '/check-username') !== false) {
            $controller->checkUsernameAvailability();
        } elseif (preg_match('/\/(@[^\/]+)$/', $path, $matches)) {
            // Handle /@username format
            $controller->getUserByUsername();
        } elseif (preg_match('/\/[^\/]+$/', $path)) {
            $controller->getUserByUsername();
        } else {
            errorResponse('Route not found', 404);
        }
        break;
        
    case 'PUT':
        if (strpos($path, '/profile') !== false) {
            $controller->updateProfile();
        } elseif (strpos($path, '/change-password') !== false) {
            $controller->changePassword();
        } else {
            errorResponse('Route not found', 404);
        }
        break;
        
    case 'DELETE':
        if (strpos($path, '/account') !== false) {
            $controller->deleteAccount();
        } else {
            errorResponse('Route not found', 404);
        }
        break;
        
    default:
        errorResponse('Method not allowed', 405);
}
?>
