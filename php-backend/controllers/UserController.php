<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/Response.php';

class UserController {
    
    // Helper function to check if username is available
    private static function isUsernameAvailable($username, $currentUserId = null) {
        $pdo = Database::getConnection();
        $sql = "SELECT id FROM users WHERE username = ?";
        $params = [$username];
        
        if ($currentUserId) {
            $sql .= " AND id != ?";
            $params[] = $currentUserId;
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->rowCount() === 0;
    }
    
    // Get user profile
    public function getProfile() {
        try {
            $user = AuthMiddleware::authenticate();
            
            $stmt = Database::getConnection()->prepare("
                SELECT id, username, email, profilePicture, description, isEmailVerified, authProvider, role, createdAt, vipUntil
                FROM users WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$userData) {
                Response::error('User not found', 404);
                return;
            }

            $vipUntil = $userData['vipUntil'];
            $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();
            
            Response::json([
                'user' => [
                    'id' => (int)$userData['id'],
                    'username' => $userData['username'],
                    'email' => $userData['email'],
                    'profilePicture' => $userData['profilePicture'],
                    'description' => $userData['description'],
                    'isEmailVerified' => (bool)$userData['isEmailVerified'],
                    'authProvider' => $userData['authProvider'],
                    'role' => $userData['role'] ?? 'user',
                    'createdAt' => $userData['createdAt'],
                    'vipUntil' => $vipUntil,
                    'isVip' => $isVip
                ]
            ]);
        } catch (Exception $e) {
            error_log('Get profile error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Update username
    public function updateUsername() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            $username = $input['username'] ?? null;
            
            // Validation
            if (!$username) {
                Response::error('Username is required', 400);
                return;
            }
            
            if (strlen($username) < 3 || strlen($username) > 50) {
                Response::error('Username must be between 3 and 50 characters', 400);
                return;
            }
            
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
                Response::error('Username can only contain letters, numbers, and underscores', 400);
                return;
            }
            
            // Check if username is available
            if (!self::isUsernameAvailable($username, $user['id'])) {
                Response::error('Username is already taken', 400);
                return;
            }
            
            $pdo = Database::getConnection();
            
            // Update username
            $stmt = $pdo->prepare("UPDATE users SET username = ? WHERE id = ?");
            $stmt->execute([$username, $user['id']]);
            
            // Get updated user data
            $stmt = $pdo->prepare("
                SELECT id, username, email, profilePicture, description, isEmailVerified, authProvider, role, vipUntil 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            $vipUntil = $userData['vipUntil'] ?? null;
            $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();
            
            error_log("Username updated for user {$user['id']}: -> $username");
            
            Response::success([
                'message' => 'Username updated successfully',
                'user' => [
                    'id' => (int)$userData['id'],
                    'username' => $userData['username'],
                    'email' => $userData['email'],
                    'profilePicture' => $userData['profilePicture'],
                    'description' => $userData['description'],
                    'isEmailVerified' => (bool)$userData['isEmailVerified'],
                    'authProvider' => $userData['authProvider'],
                    'role' => $userData['role'] ?? 'user',
                    'vipUntil' => $vipUntil,
                    'isVip' => $isVip
                ]
            ]);
        } catch (Exception $e) {
            error_log('Update username error: ' . $e->getMessage());
            if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                Response::error('Username is already taken', 400);
            } else {
                Response::error('Server error: ' . $e->getMessage(), 500);
            }
        }
    }
    
    // Update profile picture
    public function updateProfilePicture() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            $profilePicture = $input['profilePicture'] ?? '';
            
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE users SET profilePicture = ? WHERE id = ?");
            $stmt->execute([$profilePicture, $user['id']]);
            
            // Get updated user data
            $stmt = $pdo->prepare("
                SELECT id, username, email, profilePicture, description, isEmailVerified, authProvider, role, vipUntil 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            $vipUntil = $userData['vipUntil'] ?? null;
            $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();
            
            error_log("Profile picture updated for user {$user['id']}");
            
            Response::success([
                'message' => 'Profile picture updated successfully',
                'user' => [
                    'id' => (int)$userData['id'],
                    'username' => $userData['username'],
                    'email' => $userData['email'],
                    'profilePicture' => $userData['profilePicture'],
                    'description' => $userData['description'],
                    'isEmailVerified' => (bool)$userData['isEmailVerified'],
                    'authProvider' => $userData['authProvider'],
                    'role' => $userData['role'] ?? 'user',
                    'vipUntil' => $vipUntil,
                    'isVip' => $isVip
                ]
            ]);
        } catch (Exception $e) {
            error_log('Update profile picture error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Update full profile (username and profile picture)
    public function updateProfile() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            
            $username = $input['username'] ?? null;
            $profilePicture = $input['profilePicture'] ?? null;
            $description = $input['description'] ?? null;
            
            $updates = [];
            $params = [];
            $changes = [];
            
            $pdo = Database::getConnection();
            
            // Get current user data
            $stmt = $pdo->prepare("SELECT username, profilePicture, description FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Update username if provided and different
            if ($username !== null && $username !== $currentUser['username']) {
                // Validation
                if (strlen($username) < 3 || strlen($username) > 50) {
                    Response::error('Username must be between 3 and 50 characters', 400);
                    return;
                }
                
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
                    Response::error('Username can only contain letters, numbers, and underscores', 400);
                    return;
                }
                
                // Check if username is available
                if (!self::isUsernameAvailable($username, $user['id'])) {
                    Response::error('Username is already taken', 400);
                    return;
                }
                
                $updates[] = "username = ?";
                $params[] = $username;
                $changes[] = "username: {$currentUser['username']} -> $username";
            }
            
            // Update profile picture if provided and different
            if ($profilePicture !== null && $profilePicture !== $currentUser['profilePicture']) {
                $updates[] = "profilePicture = ?";
                $params[] = $profilePicture;
                $changes[] = 'profile picture updated';
            }

            // Update description if provided and different
            if ($description !== null && $description !== $currentUser['description']) {
                $updates[] = "description = ?";
                $params[] = $description;
                $changes[] = 'description updated';
            }
            
            // Apply updates if any
            if (!empty($updates)) {
                $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
                $params[] = $user['id'];
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                
                error_log("Profile updated for user {$user['id']}: " . implode(', ', $changes));
            }
            
            // Get updated user data
            $stmt = $pdo->prepare("
                SELECT id, username, email, profilePicture, description, isEmailVerified, authProvider, role, vipUntil 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            $vipUntil = $userData['vipUntil'] ?? null;
            $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();
            
            Response::success([
                'message' => 'Profile updated successfully',
                'user' => [
                    'id' => (int)$userData['id'],
                    'username' => $userData['username'],
                    'email' => $userData['email'],
                    'profilePicture' => $userData['profilePicture'],
                    'description' => $userData['description'],
                    'isEmailVerified' => (bool)$userData['isEmailVerified'],
                    'authProvider' => $userData['authProvider'],
                    'role' => $userData['role'] ?? 'user',
                    'vipUntil' => $vipUntil,
                    'isVip' => $isVip
                ]
            ]);
        } catch (Exception $e) {
            error_log('Update profile error: ' . $e->getMessage());
            if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                Response::error('Username is already taken', 400);
            } else {
                Response::error('Server error: ' . $e->getMessage(), 500);
            }
        }
    }
    
    // Check username availability
    public function checkUsernameAvailability() {
        try {
            $user = AuthMiddleware::authenticate();
            $username = $_GET['username'] ?? null;
            
            if (!$username) {
                Response::error('Username is required', 400);
                return;
            }
            
            if (strlen($username) < 3 || strlen($username) > 50) {
                Response::json([
                    'available' => false,
                    'message' => 'Username must be between 3 and 50 characters'
                ], 400);
                return;
            }
            
            if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
                Response::json([
                    'available' => false,
                    'message' => 'Username can only contain letters, numbers, and underscores'
                ], 400);
                return;
            }
            
            $isAvailable = self::isUsernameAvailable($username, $user['id']);
            
            Response::json([
                'available' => $isAvailable,
                'message' => $isAvailable ? 'Username is available' : 'Username is already taken'
            ]);
        } catch (Exception $e) {
            error_log('Check username availability error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Change password
    public function changePassword() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            
            $currentPassword = $input['currentPassword'] ?? null;
            $newPassword = $input['newPassword'] ?? null;
            
            // Validation
            if (!$newPassword) {
                Response::error('New password is required', 400);
                return;
            }
            
            if (strlen($newPassword) < 6) {
                Response::error('New password must be at least 6 characters long', 400);
                return;
            }
            
            $pdo = Database::getConnection();
            
            // Get current user data
            $stmt = $pdo->prepare("SELECT password, authProvider FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$userData) {
                Response::error('User not found', 404);
                return;
            }
            
            // Handle Google users (they can set password without providing current password)
            if ($userData['authProvider'] === 'google') {
                if ($currentPassword) {
                    Response::error('This account was created with Google OAuth. Please use "Sign in with Google" instead. To set a password for email login, leave the current password field empty.', 400, [
                        'authProvider' => 'google'
                    ]);
                    return;
                }
                
                // Set password for Google user (keep authProvider as 'google' but now they have password)
                $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
                $stmt->execute([$hashedPassword, $user['id']]);
                
                error_log("Password set for Google user {$user['id']}, can now login with email/password too");
                
                Response::json([
                    'message' => 'Password set successfully! You can now login with email/password in addition to Google.'
                ]);
                return;
            }
            
            // Handle email users (existing password required)
            if ($userData['authProvider'] === 'email') {
                if (!$currentPassword) {
                    Response::error('Current password is required', 400);
                    return;
                }
                
                // Verify current password
                if (!password_verify($currentPassword, $userData['password'])) {
                    Response::error('Current password is incorrect', 400);
                    return;
                }
            }
            
            // Update password
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password = ? WHERE id = ?");
            $stmt->execute([$hashedPassword, $user['id']]);
            
            error_log("Password changed for user {$user['id']}");
            
            Response::json(['message' => 'Password changed successfully']);
        } catch (Exception $e) {
            error_log('Change password error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Change email - Step 1: Request email change and send verification
    public function requestEmailChange() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            
            $newEmail = $input['newEmail'] ?? null;
            
            if (!$newEmail) {
                Response::error('New email is required', 400);
                return;
            }

            $newEmail = filter_var(trim($newEmail), FILTER_VALIDATE_EMAIL);
            if (!$newEmail) {
                Response::error('Invalid email format', 400);
                return;
            }

            $pdo = Database::getConnection();

            // Check if new email is already in use
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
            $stmt->execute([$newEmail, $user['id']]);
            if ($stmt->fetch()) {
                Response::error('Email is already in use', 400);
                return;
            }

            // Get current user info and check cooldown
            $stmt = $pdo->prepare("SELECT username, email, lastEmailChange FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$userData) {
                Response::error('User not found', 404);
                return;
            }

            // Check 15-day cooldown period
            if ($userData['lastEmailChange']) {
                $lastChange = new DateTime($userData['lastEmailChange']);
                $now = new DateTime();
                $daysSinceLastChange = $now->diff($lastChange)->days;
                
                if ($daysSinceLastChange < 15) {
                    $daysRemaining = 15 - $daysSinceLastChange;
                    $nextAllowed = clone $lastChange;
                    $nextAllowed->add(new DateInterval('P15D'));
                    
                    Response::error("Email change is on cooldown. You can change your email again in {$daysRemaining} days (after {$nextAllowed->format('Y-m-d H:i:s')})", 429, [
                        'cooldownActive' => true,
                        'daysRemaining' => $daysRemaining,
                        'nextAllowedDate' => $nextAllowed->format('c'),
                        'lastEmailChange' => $lastChange->format('c')
                    ]);
                    return;
                }
            }

            // Generate verification token and current email OTP (Step 1)
            $verificationToken = bin2hex(random_bytes(32));
            $currentEmailOTP = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $currentEmailOTPExpires = date('Y-m-d H:i:s', strtotime('+15 minutes'));

            // Store email change request (Step 1: verify current email)
            $stmt = $pdo->prepare("
                UPDATE users 
                SET pendingEmail = ?, emailChangeToken = ?, 
                    currentEmailOTP = ?, currentEmailOTPExpires = ?,
                    currentEmailVerified = 0, emailChangeRequestedAt = NOW(),
                    newEmailOTP = NULL, newEmailOTPExpires = NULL
                WHERE id = ?
            ");
            $stmt->execute([$newEmail, $verificationToken, $currentEmailOTP, $currentEmailOTPExpires, $user['id']]);

            // Send verification email to CURRENT email address first
            require_once __DIR__ . '/../utils/EmailService.php';
            $emailService = new EmailService();
            $emailSent = $emailService->sendCurrentEmailVerification($userData['email'], $currentEmailOTP, $userData['username'], $newEmail);

            if ($emailSent) {
                Response::json([
                    'message' => 'Verification email sent to your current email address. Please check your inbox.',
                    'step' => 'verify_current_email',
                    'currentEmail' => $userData['email'],
                    'pendingEmail' => $newEmail,
                    'verificationToken' => $verificationToken
                ]);
            } else {
                Response::error('Failed to send verification email', 500);
            }

        } catch (Exception $e) {
            error_log('Request email change error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Verify current email - Step 1 of email change
    public function verifyCurrentEmail() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $otp = $input['otp'] ?? null;

            if (!$otp) {
                Response::error('OTP is required', 400);
                return;
            }

            $pdo = Database::getConnection();

            // Find user with matching current email OTP - no auth required, just check OTP
            $stmt = $pdo->prepare("
                SELECT id, username, email, pendingEmail, currentEmailOTP, currentEmailOTPExpires, emailChangeToken
                FROM users 
                WHERE currentEmailOTP = ? AND currentEmailOTPExpires > NOW()
            ");
            $stmt->execute([$otp]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$userData) {
                // Check if there's an expired verification for this OTP
                $expiredStmt = $pdo->prepare("
                    SELECT id, currentEmailOTPExpires 
                    FROM users 
                    WHERE currentEmailOTP = ?
                ");
                $expiredStmt->execute([$otp]);
                $expiredData = $expiredStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($expiredData) {
                    // Clean up expired verification data
                    $cleanupStmt = $pdo->prepare("
                        UPDATE users 
                        SET pendingEmail = NULL, emailChangeToken = NULL, 
                            currentEmailOTP = NULL, currentEmailOTPExpires = NULL,
                            currentEmailVerified = 0, emailChangeRequestedAt = NULL,
                            newEmailOTP = NULL, newEmailOTPExpires = NULL
                        WHERE id = ?
                    ");
                    $cleanupStmt->execute([$expiredData['id']]);
                    
                    Response::error('Your verification code has expired. Please request a new email change to get a fresh verification code.', 400, [
                        'expired' => true,
                        'needNewRequest' => true
                    ]);
                } else {
                    Response::error('Invalid verification code. Please check the code and try again.', 400);
                }
                return;
            }

            // Generate OTP for new email (Step 2)
            $newEmailOTP = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $newEmailOTPExpires = date('Y-m-d H:i:s', strtotime('+15 minutes'));

            // Mark current email as verified and generate new email OTP
            $stmt = $pdo->prepare("
                UPDATE users 
                SET currentEmailVerified = 1, currentEmailOTP = NULL, currentEmailOTPExpires = NULL,
                    newEmailOTP = ?, newEmailOTPExpires = ?
                WHERE id = ?
            ");
            $stmt->execute([$newEmailOTP, $newEmailOTPExpires, $userData['id']]);

            // Send verification email to NEW email address
            require_once __DIR__ . '/../utils/EmailService.php';
            $emailService = new EmailService();
            $emailSent = $emailService->sendNewEmailVerification($userData['pendingEmail'], $newEmailOTP, $userData['username']);

            if ($emailSent) {
                Response::json([
                    'message' => 'Current email verified! Now check your new email for the final verification code.',
                    'step' => 'verify_new_email',
                    'newEmail' => $userData['pendingEmail'],
                    'verificationToken' => $userData['emailChangeToken']
                ]);
            } else {
                Response::error('Current email verified but failed to send verification email to new address', 500);
            }

        } catch (Exception $e) {
            error_log('Current email verification error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Verify new email - Step 2 of email change (final step)
    public function verifyNewEmail() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $otp = $input['otp'] ?? null;

            if (!$otp) {
                Response::error('OTP is required', 400);
                return;
            }

            $pdo = Database::getConnection();

            // Find user with matching new email OTP and current email already verified
            $stmt = $pdo->prepare("
                SELECT id, username, email, pendingEmail, newEmailOTP, newEmailOTPExpires, currentEmailVerified
                FROM users 
                WHERE newEmailOTP = ? AND newEmailOTPExpires > NOW() 
                AND currentEmailVerified = 1
            ");
            $stmt->execute([$otp]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$userData) {
                // Check if there's a user with this OTP but current email not verified
                $currentCheckStmt = $pdo->prepare("
                    SELECT currentEmailVerified 
                    FROM users 
                    WHERE newEmailOTP = ?
                ");
                $currentCheckStmt->execute([$otp]);
                $currentCheck = $currentCheckStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($currentCheck && !$currentCheck['currentEmailVerified']) {
                    Response::error('You must verify your current email first before verifying the new email', 400);
                    return;
                }
                
                Response::error('Invalid or expired verification code', 400);
                return;
            }

            $oldEmail = $userData['email'];
            $newEmail = $userData['pendingEmail'];

            // Complete email change: update email and clear all pending data
            $stmt = $pdo->prepare("
                UPDATE users 
                SET email = ?, pendingEmail = NULL, emailChangeToken = NULL, 
                    currentEmailOTP = NULL, currentEmailOTPExpires = NULL,
                    newEmailOTP = NULL, newEmailOTPExpires = NULL,
                    currentEmailVerified = 0, emailChangeRequestedAt = NULL,
                    isEmailVerified = 1, lastEmailChange = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$newEmail, $userData['id']]);

            // Send confirmation emails to both old and new addresses
            require_once __DIR__ . '/../utils/EmailService.php';
            $emailService = new EmailService();
            $emailService->sendEmailChangeNotification($oldEmail, $newEmail, $userData['username']);
            $emailService->sendEmailChangeConfirmation($newEmail, $userData['username']);

            Response::json([
                'message' => 'Email address successfully changed! You can now use your new email to log in.',
                'oldEmail' => $oldEmail,
                'newEmail' => $newEmail
            ]);

        } catch (Exception $e) {
            error_log('New email verification error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Legacy method for backward compatibility - now redirects to dual verification
    public function verifyEmailChange() {
        Response::error('This endpoint has been updated. Please use the new dual verification system: /verify-current-email followed by /verify-new-email', 410);
    }

    // Secure password change - Step 1: Request password change and send verification
    public function requestPasswordChange() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            
            $currentPassword = $input['currentPassword'] ?? null;
            $newPassword = $input['newPassword'] ?? null;
            
            // Validation
            if (!$newPassword) {
                Response::error('New password is required', 400);
                return;
            }
            
            if (strlen($newPassword) < 6) {
                Response::error('New password must be at least 6 characters long', 400);
                return;
            }

            $pdo = Database::getConnection();

            // Get current user data and check cooldown
            $stmt = $pdo->prepare("SELECT username, email, password, authProvider, lastPasswordChange FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$userData) {
                Response::error('User not found', 404);
                return;
            }

            // Check 48-hour cooldown period
            if ($userData['lastPasswordChange']) {
                $lastChange = new DateTime($userData['lastPasswordChange']);
                $now = new DateTime();
                $hoursSinceLastChange = $now->diff($lastChange)->h + ($now->diff($lastChange)->days * 24);
                
                if ($hoursSinceLastChange < 48) {
                    $hoursRemaining = 48 - $hoursSinceLastChange;
                    $nextAllowed = clone $lastChange;
                    $nextAllowed->add(new DateInterval('PT48H'));
                    
                    Response::error("Password change is on cooldown. You can change your password again in {$hoursRemaining} hours (after {$nextAllowed->format('Y-m-d H:i:s')})", 429, [
                        'cooldownActive' => true,
                        'hoursRemaining' => $hoursRemaining,
                        'nextAllowedDate' => $nextAllowed->format('c'),
                        'lastPasswordChange' => $lastChange->format('c')
                    ]);
                    return;
                }
            }

            // Handle Google users vs Email users
            $isGoogleUser = $userData['authProvider'] === 'google';
            
            if (!$isGoogleUser) {
                // For email users, verify current password
                if (!$currentPassword) {
                    Response::error('Current password is required', 400);
                    return;
                }
                
                if (!password_verify($currentPassword, $userData['password'])) {
                    Response::error('Current password is incorrect', 400);
                    return;
                }
            } else {
                // For Google users setting password for first time, current password not needed
                if ($currentPassword) {
                    Response::error('This account was created with Google OAuth. Leave current password empty to set a new password.', 400);
                    return;
                }
            }

            // Generate verification token and OTP
            $verificationToken = bin2hex(random_bytes(32));
            $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $otpExpires = date('Y-m-d H:i:s', strtotime('+15 minutes'));

            // Hash the new password and store it temporarily
            $hashedNewPassword = password_hash($newPassword, PASSWORD_DEFAULT);

            // Store password change request
            $stmt = $pdo->prepare("
                UPDATE users 
                SET pendingPassword = ?, passwordChangeToken = ?, emailOTP = ?, otpExpires = ? 
                WHERE id = ?
            ");
            $stmt->execute([$hashedNewPassword, $verificationToken, $otp, $otpExpires, $user['id']]);

            // Send verification email to user's current email
            require_once __DIR__ . '/../utils/EmailService.php';
            $emailService = new EmailService();
            $emailSent = $emailService->sendPasswordChangeVerification($userData['email'], $otp, $userData['username'], $verificationToken, $isGoogleUser);

            if ($emailSent) {
                Response::json([
                    'message' => 'Password change verification email sent',
                    'email' => $userData['email'],
                    'verificationToken' => $verificationToken,
                    'isGoogleUser' => $isGoogleUser
                ]);
            } else {
                Response::error('Failed to send verification email', 500);
            }

        } catch (Exception $e) {
            error_log('Request password change error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Secure password change - Step 2: Verify and complete password change
    public function verifyPasswordChange() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $token = $input['token'] ?? null;
            $otp = $input['otp'] ?? null;

            if (!$token || !$otp) {
                Response::error('Token and OTP are required', 400);
                return;
            }

            $pdo = Database::getConnection();

            // Find user with matching token and OTP
            $stmt = $pdo->prepare("
                SELECT id, username, email, pendingPassword, emailOTP, otpExpires, authProvider 
                FROM users 
                WHERE passwordChangeToken = ? AND emailOTP = ? AND otpExpires > NOW()
            ");
            $stmt->execute([$token, $otp]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$userData) {
                Response::error('Invalid or expired verification code', 400);
                return;
            }

            $newHashedPassword = $userData['pendingPassword'];
            $isGoogleUser = $userData['authProvider'] === 'google';

            // Update password and clear pending change data, set cooldown timestamp
            $stmt = $pdo->prepare("
                UPDATE users 
                SET password = ?, pendingPassword = NULL, passwordChangeToken = NULL, 
                    emailOTP = NULL, otpExpires = NULL, lastPasswordChange = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$newHashedPassword, $userData['id']]);

            // Send confirmation email
            require_once __DIR__ . '/../utils/EmailService.php';
            $emailService = new EmailService();
            $emailService->sendPasswordChangeNotification($userData['email'], $userData['username'], $isGoogleUser);

            Response::json([
                'message' => $isGoogleUser ? 'Password set successfully! You can now login with email/password.' : 'Password changed successfully!',
                'isGoogleUser' => $isGoogleUser
            ]);

        } catch (Exception $e) {
            error_log('Verify password change error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    public function getEmailChangeCooldown() {
        try {
            $user = AuthMiddleware::authenticate();
            $pdo = Database::getConnection();

            // Get user's last email change
            $stmt = $pdo->prepare("SELECT lastEmailChange FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$userData || !$userData['lastEmailChange']) {
                Response::success([
                    'cooldownActive' => false,
                    'canChangeEmail' => true
                ]);
                return;
            }

            $lastChange = new DateTime($userData['lastEmailChange']);
            $now = new DateTime();
            $daysSinceLastChange = $now->diff($lastChange)->days;
            $hoursSinceLastChange = $now->diff($lastChange)->h + ($daysSinceLastChange * 24);
            $minutesSinceLastChange = $now->diff($lastChange)->i + ($hoursSinceLastChange * 60);
            $secondsSinceLastChange = $now->diff($lastChange)->s + ($minutesSinceLastChange * 60);

            if ($daysSinceLastChange < 15) {
                $daysRemaining = 15 - $daysSinceLastChange;
                $nextAllowed = clone $lastChange;
                $nextAllowed->add(new DateInterval('P15D'));
                
                // Calculate precise time remaining
                $timeRemaining = $now->diff($nextAllowed);
                
                Response::success([
                    'cooldownActive' => true,
                    'canChangeEmail' => false,
                    'daysRemaining' => $daysRemaining,
                    'timeRemaining' => [
                        'days' => $timeRemaining->days,
                        'hours' => $timeRemaining->h,
                        'minutes' => $timeRemaining->i,
                        'seconds' => $timeRemaining->s,
                        'totalSeconds' => $secondsSinceLastChange
                    ],
                    'nextAllowedDate' => $nextAllowed->format('c'),
                    'lastEmailChange' => $lastChange->format('c')
                ]);
            } else {
                Response::success([
                    'cooldownActive' => false,
                    'canChangeEmail' => true
                ]);
            }

        } catch (Exception $e) {
            error_log('Get email change cooldown error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    public function getPasswordChangeCooldown() {
        try {
            $user = AuthMiddleware::authenticate();
            $pdo = Database::getConnection();

            // Get user's last password change
            $stmt = $pdo->prepare("SELECT lastPasswordChange FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$userData || !$userData['lastPasswordChange']) {
                Response::success([
                    'cooldownActive' => false,
                    'canChangePassword' => true
                ]);
                return;
            }

            $lastChange = new DateTime($userData['lastPasswordChange']);
            $now = new DateTime();
            $hoursSinceLastChange = $now->diff($lastChange)->h + ($now->diff($lastChange)->days * 24);
            $minutesSinceLastChange = $now->diff($lastChange)->i + ($hoursSinceLastChange * 60);
            $secondsSinceLastChange = $now->diff($lastChange)->s + ($minutesSinceLastChange * 60);

            if ($hoursSinceLastChange < 48) {
                $hoursRemaining = 48 - $hoursSinceLastChange;
                $nextAllowed = clone $lastChange;
                $nextAllowed->add(new DateInterval('PT48H'));
                
                // Calculate precise time remaining
                $timeRemaining = $now->diff($nextAllowed);
                
                Response::success([
                    'cooldownActive' => true,
                    'canChangePassword' => false,
                    'hoursRemaining' => $hoursRemaining,
                    'timeRemaining' => [
                        'days' => $timeRemaining->days,
                        'hours' => $timeRemaining->h,
                        'minutes' => $timeRemaining->i,
                        'seconds' => $timeRemaining->s,
                        'totalSeconds' => $secondsSinceLastChange
                    ],
                    'nextAllowedDate' => $nextAllowed->format('c'),
                    'lastPasswordChange' => $lastChange->format('c')
                ]);
            } else {
                Response::success([
                    'cooldownActive' => false,
                    'canChangePassword' => true
                ]);
            }

        } catch (Exception $e) {
            error_log('Get password change cooldown error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Get public user profile by username
public function getUserByUsername($username) {
    try {
        if (!$username) {
            Response::error('Username required', 400);
            return;
        }

        $username = urldecode(trim($username));
        $pdo = Database::getConnection();

        // Find user by username.
        // Do not block seller profile only because local/test account is not email verified.
        $stmt = $pdo->prepare("
            SELECT id, username, fullName, profilePicture, description, isEmailVerified, createdAt, vipUntil
            FROM users
            WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))
            LIMIT 1
        ");
        $stmt->execute([$username]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$userData) {
            Response::error('User not found', 404);
            return;
        }

        // Compute VIP status
        $vipUntil = $userData['vipUntil'] ?? null;
        $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();

        // Get active listing count for this user
        $adCount = 0;
        try {
            $stmt = $pdo->prepare("
                SELECT COUNT(*) as count
                FROM ads
                WHERE userId = ?
                AND (
                    status = 1
                    OR status = '1'
                    OR status = 'active'
                    OR status IS NULL
                )
            ");
            $stmt->execute([$userData['id']]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            $adCount = (int)($result['count'] ?? 0);
        } catch (Exception $e) {
            error_log('Error counting user ads: ' . $e->getMessage());
        }

        // Return public information
        $publicUser = [
            'id' => (int)$userData['id'],
            'username' => $userData['username'],
            'fullName' => $userData['fullName'] ?? null,
            'profilePicture' => $userData['profilePicture'] ?? null,
            'description' => $userData['description'] ?? null,
            'createdAt' => $userData['createdAt'],
            'isEmailVerified' => (bool)$userData['isEmailVerified'],
            'adCount' => $adCount,
            'vipUntil' => $vipUntil,
            'isVip' => $isVip
        ];

        Response::json([
            'success' => true,
            'data' => $publicUser
        ]);
    } catch (Exception $e) {
        error_log('Error getting user by username: ' . $e->getMessage());
        Response::error('Server error', 500);
    }
    }

    // ── VIP: Buy VIP Subscription ─────────────────────────────────────────────
    public function buyVip() {
        try {
            $user = AuthMiddleware::authenticate();
            $input = json_decode(file_get_contents('php://input'), true);
            $months = (int)($input['months'] ?? 1);

            // Validate months
            if (!in_array($months, [1, 2, 3])) {
                Response::error('Invalid subscription duration. Choose 1, 2, or 3 months.', 400);
                return;
            }

            // Pricing
            $prices = [1 => 10.00, 2 => 18.00, 3 => 25.00];
            $price = $prices[$months];

            $pdo = Database::getConnection();

            // Fetch current vipUntil
            $stmt = $pdo->prepare("SELECT vipUntil FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            // Calculate new vipUntil (extend if still active, else start from now)
            $currentVipUntil = $row['vipUntil'] ?? null;
            if (!empty($currentVipUntil) && strtotime($currentVipUntil) > time()) {
                $base = new DateTime($currentVipUntil);
            } else {
                $base = new DateTime();
            }
            $base->modify("+{$months} months");
            $newVipUntil = $base->format('Y-m-d H:i:s');

            // Update user
            $update = $pdo->prepare("UPDATE users SET vipUntil = ? WHERE id = ?");
            $update->execute([$newVipUntil, $user['id']]);

            Response::json([
                'success' => true,
                'message' => "VIP activated for {$months} month(s)!",
                'vipUntil' => $newVipUntil,
                'isVip' => true,
                'price' => $price,
                'months' => $months
            ]);
        } catch (Exception $e) {
            error_log('Buy VIP error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // ── VIP: Get Buyer Stats (VIP status + repeat buyer) ─────────────────────
    public function getBuyerStats() {
        try {
            $user = AuthMiddleware::authenticate();
            $pdo = Database::getConnection();

            // Get vipUntil
            $stmt = $pdo->prepare("SELECT vipUntil FROM users WHERE id = ?");
            $stmt->execute([$user['id']]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $vipUntil = $row['vipUntil'] ?? null;
            $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();

            // Count completed deals where this user is buyer
            $dealStmt = $pdo->prepare("
                SELECT COUNT(*) as cnt FROM deals
                WHERE buyer_id = ? AND deal_status IN ('completed', 'payment_confirmed')
            ");
            $dealStmt->execute([$user['id']]);
            $dealRow = $dealStmt->fetch(PDO::FETCH_ASSOC);
            $completedDeals = (int)($dealRow['cnt'] ?? 0);
            $isRepeatBuyer = $completedDeals >= 3;

            // Determine discount tier label
            if ($isVip && $isRepeatBuyer) {
                $tier = 'vip_repeat';
            } elseif ($isVip) {
                $tier = 'vip';
            } elseif ($isRepeatBuyer) {
                $tier = 'repeat';
            } else {
                $tier = 'standard';
            }

            Response::json([
                'success' => true,
                'isVip' => $isVip,
                'vipUntil' => $vipUntil,
                'completedDeals' => $completedDeals,
                'isRepeatBuyer' => $isRepeatBuyer,
                'tier' => $tier
            ]);
        } catch (Exception $e) {
            error_log('Get buyer stats error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
}
