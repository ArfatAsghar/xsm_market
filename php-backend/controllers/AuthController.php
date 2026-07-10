<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/EmailService.php';
require_once __DIR__ . '/../utils/jwt.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validation.php';
require_once __DIR__ . '/../utils/RecaptchaService.php';

class AuthController {
    private $db;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }
    

    
    // Helper function to generate unique username
    private function generateUniqueUsername($baseName) {
        if (!$baseName) {
            $baseName = 'user';
        }
        
        // Clean the base name - remove special characters and spaces
        $cleanBaseName = preg_replace('/[^a-z0-9]/', '', strtolower($baseName));
        $cleanBaseName = substr($cleanBaseName, 0, 20); // Limit length
        
        if (empty($cleanBaseName)) {
            $cleanBaseName = 'user';
        }
        
        // First try the clean base name
        $username = $cleanBaseName;
        $stmt = $this->db->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        
        if (!$stmt->fetch()) {
            return $username;
        }
        
        // If exists, try with random numbers
        $attempts = 0;
        $maxAttempts = 10;
        
        while ($attempts < $maxAttempts) {
            $randomNum = rand(1, 9999);
            $username = $cleanBaseName . $randomNum;
            $stmt = $this->db->prepare("SELECT id FROM users WHERE username = ?");
            $stmt->execute([$username]);
            
            if (!$stmt->fetch()) {
                return $username;
            }
            $attempts++;
        }
        
        // If still not unique after attempts, use timestamp
        $username = $cleanBaseName . time();
        return $username;
    }
    
    // Register new user (send OTP for verification)
    public function register() {
        $input = json_decode(file_get_contents('php://input'), true);
        $username = trim($input['username'] ?? '');
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $recaptchaToken = $input['recaptchaToken'] ?? '';
        
        // Log registration attempt (filter out password)
        error_log('Registration attempt: ' . json_encode(['username' => $username, 'email' => $email]));
        
        // Validation
        if (!$username || !$email || !$password) {
            Response::error('Please provide username, email and password', 400);
            return;
        }
        
        // Verify reCAPTCHA
        try {
            $recaptcha = new RecaptchaService();
            if ($recaptcha->shouldEnforce()) {
                $recaptchaResult = $recaptcha->verifyToken($recaptchaToken, $_SERVER['REMOTE_ADDR'] ?? null);
                
                if (!$recaptchaResult['success']) {
                    Response::error($recaptchaResult['message'], 400, [
                        'recaptcha_error' => true,
                        'error_codes' => $recaptchaResult['error-codes']
                    ]);
                    return;
                }
            }
        } catch (Exception $e) {
            error_log('reCAPTCHA verification error: ' . $e->getMessage());
            Response::error('reCAPTCHA verification failed', 400);
            return;
        }
        
        if (strlen($password) < 6) {
            Response::error('Password must be at least 6 characters long', 400);
            return;
        }
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Please provide a valid email address', 400);
            return;
        }
        
        if (strlen($username) < 3 || strlen($username) > 50 || !preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            Response::error('Username must be 3-50 characters long and contain only letters, numbers, and underscores', 400);
            return;
        }
        
        try {
            // Begin transaction to ensure data consistency
            $this->db->beginTransaction();
            
            // Check if user already exists and is verified
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $existingUserByEmail = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $stmt = $this->db->prepare("SELECT * FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $existingUserByUsername = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existingUserByEmail && $existingUserByEmail['isEmailVerified']) {
                $this->db->rollback();
                Response::error('Email address is already registered and verified. Please use a different email or try logging in.', 400);
                return;
            }
            
            if ($existingUserByUsername && $existingUserByUsername['isEmailVerified']) {
                $this->db->rollback();
                Response::error('Username is already taken. Please choose a different username.', 400);
                return;
            }
            
            // Check if there's a different user with the same username (edge case)
            if ($existingUserByUsername && $existingUserByEmail && 
                $existingUserByUsername['id'] !== $existingUserByEmail['id']) {
                $this->db->rollback();
                Response::error('Username is already taken. Please choose a different username.', 400);
                return;
            }
            
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            // Generate OTP - exact match to Node.js logic: Math.floor(100000 + Math.random() * 900000)
            $otp = sprintf('%06d', mt_rand(100000, 999999));
            $otpExpires = date('Y-m-d H:i:s', time() + 600); // 10 minutes from now
            
            // If user exists but not verified, update their details
            if ($existingUserByEmail && !$existingUserByEmail['isEmailVerified']) {
                $stmt = $this->db->prepare("
                    UPDATE users SET 
                    username = ?, password = ?, emailOTP = ?, otpExpires = ?, updatedAt = NOW()
                    WHERE email = ? AND isEmailVerified = 0
                ");
                $result = $stmt->execute([$username, $hashedPassword, $otp, $otpExpires, $email]);
                if (!$result) {
                    $this->db->rollback();
                    Response::error('Failed to update user information. Please try again.', 500);
                    return;
                }
                $userId = $existingUserByEmail['id'];
            } else {
                // Create new user
                $stmt = $this->db->prepare("
                    INSERT INTO users (username, email, password, emailOTP, otpExpires, isEmailVerified, authProvider, createdAt, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, 0, 'email', NOW(), NOW())
                ");
                $result = $stmt->execute([$username, $email, $hashedPassword, $otp, $otpExpires]);
                if (!$result) {
                    $this->db->rollback();
                    Response::error('Failed to create user account. Please try again.', 500);
                    return;
                }
                $userId = $this->db->lastInsertId();
            }
            
            // Commit the transaction first
            $this->db->commit();
            
            error_log('Registration database operations completed for: ' . $email);
            
            // Send response immediately to prevent timeout issues
            // Then send email asynchronously
            try {
                // Send OTP email
                $emailService = new EmailService();
                $emailResult = $emailService->sendOTPEmail($email, $otp, $username);
                
                if ($emailResult) {
                    error_log('Registration email sent successfully for: ' . $email);
                } else {
                    error_log('Registration email failed for: ' . $email . ' but user account was created');
                }
                
            } catch (Exception $emailException) {
                error_log('Email sending exception for: ' . $email . ' - ' . $emailException->getMessage());
                // Don't fail the registration if email fails - user account is already created
            }
            
            // Always send success response since user account was created successfully
            Response::success([
                'message' => 'Registration initiated. Please check your email for verification OTP',
                'email' => $email,
                'requiresVerification' => true
            ]);
            return;
            
        } catch (PDOException $e) {
            error_log('Database error during registration: ' . $e->getMessage());
            
            // Handle specific database constraint violations
            if ($e->getCode() == 23000) {
                $errorMessage = $e->getMessage();
                
                if (strpos($errorMessage, 'unique_username') !== false) {
                    Response::error('Username is already taken. Please choose a different username.', 400);
                    return;
                } elseif (strpos($errorMessage, 'unique_email') !== false || strpos($errorMessage, 'email') !== false) {
                    Response::error('Email address is already registered. Please use a different email or try logging in.', 400);
                    return;
                } else {
                    Response::error('This username or email is already taken. Please try different values.', 400);
                    return;
                }
            }
            
            Response::error('Database error during registration. Please try again.', 500);
            return;
        } catch (Exception $e) {
            error_log('Registration error: ' . $e->getMessage());
            
            // Check if the error message contains duplicate entry information
            $errorMessage = $e->getMessage();
            if (strpos($errorMessage, 'Duplicate entry') !== false) {
                if (strpos($errorMessage, 'unique_username') !== false) {
                    Response::error('Username is already taken. Please choose a different username.', 400);
                    return;
                } elseif (strpos($errorMessage, 'unique_email') !== false || strpos($errorMessage, 'email') !== false) {
                    Response::error('Email address is already registered. Please use a different email or try logging in.', 400);
                    return;
                } else {
                    Response::error('This username or email is already taken. Please try different values.', 400);
                    return;
                }
            }
            
            Response::error('Server error during registration. Please try again later.', 500);
        }
    }
    
    // Login user - exact match to Node.js response format
    public function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        $recaptchaToken = $input['recaptchaToken'] ?? '';
        
        error_log('Login attempt: ' . $email);
        
        // Validation
        if (!$email || !$password) {
            Response::error('Please provide email and password', 400);
            return;
        }
        
        // Verify reCAPTCHA
        try {
            $recaptcha = new RecaptchaService();
            if ($recaptcha->shouldEnforce()) {
                $recaptchaResult = $recaptcha->verifyToken($recaptchaToken, $_SERVER['REMOTE_ADDR'] ?? null);
                
                if (!$recaptchaResult['success']) {
                    Response::error($recaptchaResult['message'], 400, [
                        'recaptcha_error' => true,
                        'error_codes' => $recaptchaResult['error-codes']
                    ]);
                    return;
                }
            }
        } catch (Exception $e) {
            error_log('reCAPTCHA verification error: ' . $e->getMessage());
            Response::error('reCAPTCHA verification failed', 400);
            return;
        }
        
        try {
            // Find user
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            error_log('User found: ' . ($user ? 'yes' : 'no'));
            if ($user) {
                error_log('User details: id=' . $user['id'] . ', authProvider=' . $user['authProvider'] . ', hasPassword=' . (!empty($user['password']) ? 'yes' : 'no'));
            }
            
            if (!$user) {
                Response::error('Invalid credentials', 401);
                return;
            }
            
            // Check if email is verified (only for email auth users)
            if ($user['authProvider'] === 'email' && !$user['isEmailVerified']) {
                // Generate new OTP and send it
                try {
                    $otp = sprintf('%06d', mt_rand(100000, 999999));
                    $otpExpires = date('Y-m-d H:i:s', time() + 600); // 10 minutes from now
                    
                    // Update user with new OTP
                    $stmt = $this->db->prepare("UPDATE users SET emailOTP = ?, otpExpires = ?, updatedAt = NOW() WHERE id = ?");
                    $stmt->execute([$otp, $otpExpires, $user['id']]);
                    
                    // Send new OTP email
                    $emailService = new EmailService();
                    $emailResult = $emailService->sendOTPEmail($user['email'], $otp, $user['username']);
                    
                    if ($emailResult) {
                        error_log('New OTP sent to unverified user: ' . $user['email']);
                        Response::error('Please verify your email before logging in. A new OTP has been sent to your email.', 403, [
                            'requiresVerification' => true,
                            'email' => $user['email'],
                            'needsOtpVerification' => true,
                            'message' => 'A new verification code has been sent to your email'
                        ]);
                    } else {
                        error_log('Failed to send new OTP to unverified user: ' . $user['email']);
                        Response::error('Please verify your email before logging in. If you did not receive the verification code, please try registering again.', 403, [
                            'requiresVerification' => true,
                            'email' => $user['email'],
                            'needsOtpVerification' => true,
                            'message' => 'Email verification required'
                        ]);
                    }
                } catch (Exception $e) {
                    error_log('Error generating new OTP for unverified user: ' . $e->getMessage());
                    Response::error('Please verify your email before logging in. If you need a new verification code, please try registering again.', 403, [
                        'requiresVerification' => true,
                        'email' => $user['email'],
                        'needsOtpVerification' => true,
                        'message' => 'Email verification required'
                    ]);
                }
                return;
            }
            
            // Check if this is a Google OAuth account trying to login with password
            if ($user['authProvider'] === 'google' && empty($user['password'])) {
                Response::error('This account was created with Google OAuth. Please use "Sign in with Google" instead.', 400, [
                    'authProvider' => 'google'
                ]);
                return;
            }
            
            // Check password for all users who have one set
            if (!empty($user['password'])) {
                if (!password_verify($password, $user['password'])) {
                    Response::error('Invalid credentials', 401);
                    return;
                }
            } else {
                // This should not happen if we reach here, but just in case
                Response::error('Invalid credentials', 401);
                return;
            }
            
            // Generate tokens - exact match to Node.js
            $tokens = JWT::generateTokens($user['id']);
            
            error_log('Login successful for user: ' . $user['id'] . ', authProvider: ' . $user['authProvider']);
            
            Response::success([
                'token' => $tokens['accessToken'],
                'refreshToken' => $tokens['refreshToken'],
                'expiresIn' => 3600, // 1 hour in seconds
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'fullName' => $user['fullName'],
                    'profilePicture' => $user['profilePicture'],
                    'isEmailVerified' => (bool)$user['isEmailVerified'],
                    'isAdmin' => (bool)$user['isAdmin'],
                    'authProvider' => $user['authProvider']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Login error: ' . $e->getMessage());
            Response::error('Server error during login: ' . $e->getMessage(), 500);
        }
    }
    
    // Verify OTP and complete registration - exact match to Node.js
    public function verifyOTP() {
        $input = json_decode(file_get_contents('php://input'), true);
        $email = trim($input['email'] ?? '');
        $otp = trim($input['otp'] ?? '');
        
        error_log('OTP verification attempt: ' . $email);
        
        // Validation
        if (!$email || !$otp) {
            Response::error('Please provide email and OTP', 400);
            return;
        }
        
        try {
            // Find user
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                Response::error('User not found', 404);
                return;
            }
            
            // Check if already verified
            if ($user['isEmailVerified']) {
                Response::error('Email is already verified', 400);
                return;
            }
            
            // Verify OTP - exact match to Node.js logic
            if (!$user['emailOTP'] || !$user['otpExpires']) {
                Response::error('Invalid or expired OTP', 400);
                return;
            }
            
            $now = new DateTime();
            $expires = new DateTime($user['otpExpires']);
            
            if ($now > $expires || $user['emailOTP'] !== $otp) {
                Response::error('Invalid or expired OTP', 400);
                return;
            }
            
            // Verify user
            $stmt = $this->db->prepare("
                UPDATE users SET 
                isEmailVerified = 1, emailOTP = NULL, otpExpires = NULL, updatedAt = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            
            // Generate tokens - exact match to Node.js
            $tokens = JWT::generateTokens($user['id']);
            
            // Send welcome email
            $emailService = new EmailService();
            $emailService->sendWelcomeEmail($user['email'], $user['username']);
            
            error_log('User verification successful: ' . $user['id']);
            
            Response::success([
                'message' => 'Email verified successfully! Welcome to XSM Market',
                'token' => $tokens['accessToken'],
                'refreshToken' => $tokens['refreshToken'],
                'expiresIn' => 3600, // 1 hour in seconds
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'fullName' => $user['fullName'],
                    'profilePicture' => $user['profilePicture'],
                    'isEmailVerified' => true,
                    'isAdmin' => (bool)$user['isAdmin'],
                    'authProvider' => $user['authProvider']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('OTP verification error: ' . $e->getMessage());
            Response::error('Server error during verification: ' . $e->getMessage(), 500);
        }
    }
    
    // Google OAuth - exact match to Node.js googleSignIn
    public function googleSignIn() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $token = $input['token'] ?? '';
            
            error_log('Google OAuth attempt');
            
            if (!$token) {
                Response::error('Google token is required', 400);
                return;
            }
            
            // For testing, if GOOGLE_CLIENT_ID is not set, use a test mode
            $googleClientId = getenv('GOOGLE_CLIENT_ID');
            if (!$googleClientId) {
                error_log('Google OAuth not configured - using test mode');
                Response::error('Google OAuth not configured on server', 500);
                return;
            }
            
            // Use cURL instead of file_get_contents for better error handling
            $url = 'https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=' . urlencode($token);
            
            error_log('Google token verification attempt: ' . substr($token, 0, 20) . '...');
            error_log('Google API URL: ' . $url);
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 15); // Increased timeout
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
            curl_setopt($ch, CURLOPT_CAINFO, __DIR__ . '/../cacert.pem'); // Use local CA bundle
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_USERAGENT, 'XSM-Market-Backend/1.0');
            curl_setopt($ch, CURLOPT_VERBOSE, false); // Set to true for more debugging
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            $curlInfo = curl_getinfo($ch);
            curl_close($ch);
            
            error_log('Google API response code: ' . $httpCode);
            error_log('Google API response: ' . substr($response, 0, 200) . '...');
            
            if ($curlError) {
                error_log('cURL error: ' . $curlError);
                error_log('cURL info: ' . json_encode($curlInfo));
                Response::error('Failed to verify Google token: Network error - ' . $curlError, 500);
                return;
            }
            
            if ($httpCode !== 200) {
                error_log('Google API returned HTTP ' . $httpCode . ': ' . $response);
                Response::error('Failed to verify Google token: Invalid token', 400);
                return;
            }
            
            $payload = json_decode($response, true);
            
            if (!$payload) {
                error_log('Invalid JSON response from Google API');
                Response::error('Failed to verify Google token: Invalid response', 400);
                return;
            }
            
            // Check if Google returned an error
            if (isset($payload['error'])) {
                error_log('Google API error: ' . json_encode($payload));
                Response::error('Invalid Google token: ' . ($payload['error_description'] ?? 'Token verification failed'), 400);
                return;
            }
            
            // Verify the token is for our application
            if (!isset($payload['aud']) || $payload['aud'] !== $googleClientId) {
                error_log('Token audience mismatch. Expected: ' . $googleClientId . ', Got: ' . ($payload['aud'] ?? 'none'));
                Response::error('Invalid Google token audience', 400);
                return;
            }
            
            if (!isset($payload['email_verified']) || $payload['email_verified'] !== 'true') {
                Response::error('Google email not verified', 400);
                return;
            }
            
            $googleId = $payload['sub'];
            $email = $payload['email'];
            $name = $payload['name'] ?? '';
            $picture = $payload['picture'] ?? '';
            
            error_log('Google user verified: ' . json_encode(['email' => $email, 'name' => $name]));
            
            // Check if user exists
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ? OR googleId = ?");
            $stmt->execute([$email, $googleId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                // Update Google ID if not set
                if (!$user['googleId']) {
                    $stmt = $this->db->prepare("
                        UPDATE users SET 
                        googleId = ?, authProvider = 'google', isEmailVerified = 1,
                        profilePicture = COALESCE(NULLIF(profilePicture, ''), ?), updatedAt = NOW()
                        WHERE id = ?
                    ");
                    $stmt->execute([$googleId, $picture, $user['id']]);
                }
                
                // Refresh user data
                $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
                $stmt->execute([$user['id']]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
            } else {
                // Generate unique username for new Google user
                $baseName = $name ?: explode('@', $email)[0];
                $uniqueUsername = $this->generateUniqueUsername($baseName);
                
                // Create new user
                $randomPassword = bin2hex(random_bytes(16)); // Random password for Google users
                $hashedPassword = password_hash($randomPassword, PASSWORD_DEFAULT);
                
                $stmt = $this->db->prepare("
                    INSERT INTO users (username, email, password, googleId, profilePicture, authProvider, isEmailVerified, createdAt, updatedAt) 
                    VALUES (?, ?, ?, ?, ?, 'google', 1, NOW(), NOW())
                ");
                $stmt->execute([$uniqueUsername, $email, $hashedPassword, $googleId, $picture]);
                
                $userId = $this->db->lastInsertId();
                
                // Fetch the created user
                $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
                $stmt->execute([$userId]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
                
                error_log('New Google user created: ' . json_encode(['id' => $userId, 'username' => $uniqueUsername]));
            }
            
            // Generate token - exact match to Node.js response
            $jwtToken = JWT::generateToken($user['id']);
            
            Response::success([
                'token' => $jwtToken,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'fullName' => $user['fullName'],
                    'profilePicture' => $user['profilePicture'],
                    'isEmailVerified' => (bool)$user['isEmailVerified'],
                    'isAdmin' => (bool)$user['isAdmin'],
                    'authProvider' => $user['authProvider']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Google OAuth error: ' . $e->getMessage());
            error_log('Google OAuth stack trace: ' . $e->getTraceAsString());
            Response::error('Google authentication failed: ' . $e->getMessage(), 500);
        } catch (Error $e) {
            error_log('Google OAuth fatal error: ' . $e->getMessage());
            error_log('Google OAuth error trace: ' . $e->getTraceAsString());
            Response::error('Google authentication failed due to server error', 500);
        }
    }
    
    // Refresh token endpoint - exact match to Node.js
    public function refreshToken() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $refreshToken = $input['refreshToken'] ?? '';
            
            if (!$refreshToken) {
                Response::error('Refresh token is required', 400);
                return;
            }
            
            // Verify refresh token
            $payload = JWT::verify($refreshToken, 'refresh');
            
            if (!$payload || $payload['type'] !== 'refresh') {
                Response::error('Invalid refresh token', 401);
                return;
            }
            
            $userId = $payload['userId'];
            
            // Check if user still exists
            $stmt = $this->db->prepare("SELECT id FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            if (!$stmt->fetch()) {
                Response::error('User not found', 404);
                return;
            }
            
            // Generate new tokens
            $tokens = JWT::generateTokens($userId);
            
            Response::success([
                'token' => $tokens['accessToken'],
                'refreshToken' => $tokens['refreshToken'],
                'expiresIn' => 3600 // 1 hour in seconds
            ]);
            
        } catch (Exception $e) {
            error_log('Refresh token error: ' . $e->getMessage());
            Response::error('Invalid refresh token', 401);
        }
    }
    
    // Resend OTP method
    public function resendOTP() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $email = trim($input['email'] ?? '');
            
            if (!$email) {
                Response::error('Please provide email', 400);
                return;
            }
            
            // Find user
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                Response::error('User not found', 404);
                return;
            }
            
            if ($user['isEmailVerified']) {
                Response::error('Email already verified', 400);
                return;
            }
            
            // Generate new OTP - exact match to Node.js logic: Math.floor(100000 + Math.random() * 900000)
            $otp = sprintf('%06d', mt_rand(100000, 999999));
            $otpExpires = date('Y-m-d H:i:s', time() + 600); // 10 minutes from now
            
            // Update user with new OTP
            $stmt = $this->db->prepare("UPDATE users SET emailOTP = ?, otpExpires = ?, updatedAt = NOW() WHERE id = ?");
            $stmt->execute([$otp, $otpExpires, $user['id']]);
            
            // Send OTP email
            $emailService = new EmailService();
            $emailResult = $emailService->sendOTPEmail($email, $otp, $user['username']);
            
            if (!$emailResult) {
                Response::error('Failed to send verification email', 500);
                return;
            }
            
            Response::success([
                'message' => 'New OTP sent to your email'
            ]);
            
        } catch (Exception $e) {
            error_log('Resend OTP error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Helper method to generate random password
    private function generateRandomPassword() {
        $length = 10;
        $charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
        $password = "";
        for ($i = 0; $i < $length; $i++) {
            $password .= $charset[random_int(0, strlen($charset) - 1)];
        }
        return $password;
    }
    
    // Forgot password method - matches Node.js implementation
    public function forgotPassword() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $email = trim(strtolower($input['email'] ?? ''));
            
            error_log("Forgot password request for: $email");
            
            if (!$email) {
                Response::error('Please provide your email address', 400);
                return;
            }
            
            // Find user by email
            $stmt = $this->db->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                // For security, don't reveal if email exists or not
                Response::success([
                    'message' => 'If an account with that email exists, you will receive a password reset email shortly.'
                ]);
                return;
            }
            
            // Generate new random password
            $newPassword = $this->generateRandomPassword();
            
            // Update user with new password (hash it)
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $this->db->prepare("UPDATE users SET password = ?, updatedAt = NOW() WHERE id = ?");
            $stmt->execute([$hashedPassword, $user['id']]);
            
            // Send email with new temporary password
            $emailService = new EmailService();
            $emailResult = $emailService->sendTemporaryPasswordEmail($email, $newPassword, $user['username']);
            
            if (!$emailResult) {
                error_log("Failed to send temporary password email to: $email");
                // Still return success for security reasons (don't reveal if email exists)
                Response::success([
                    'message' => 'If an account with that email exists, you will receive a password reset email shortly.'
                ]);
                return;
            }
            
            error_log("Temporary password generated and sent successfully for user: {$user['id']}");
            
            Response::success([
                'message' => 'A new temporary password has been sent to your email address. Please check your inbox and login with the new password.'
            ]);
            
        } catch (Exception $e) {
            error_log('Forgot password error: ' . $e->getMessage());
            Response::error('Server error during password reset', 500, $e->getMessage());
        }
    }
    
    // Reset password method (using token - alternative method, keeping for future use)
    public function resetPassword() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            $token = $input['token'] ?? '';
            $newPassword = $input['newPassword'] ?? '';
            
            error_log('Reset password request with token');
            
            if (!$token || !$newPassword) {
                Response::error('Please provide reset token and new password', 400);
                return;
            }
            
            if (strlen($newPassword) < 6) {
                Response::error('New password must be at least 6 characters long', 400);
                return;
            }
            
            // Find user by reset token
            $stmt = $this->db->prepare("SELECT * FROM users WHERE passwordResetToken = ? AND passwordResetExpires > NOW()");
            $stmt->execute([$token]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                Response::error('Invalid or expired reset token', 400);
                return;
            }
            
            // Update password and clear reset token
            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $this->db->prepare("
                UPDATE users SET 
                password = ?, passwordResetToken = NULL, passwordResetExpires = NULL, updatedAt = NOW() 
                WHERE id = ?
            ");
            $stmt->execute([$hashedPassword, $user['id']]);
            
            error_log("Password reset successfully for user: {$user['id']}");
            
            Response::success([
                'message' => 'Password has been reset successfully. You can now login with your new password.'
            ]);
            
        } catch (Exception $e) {
            error_log('Reset password error: ' . $e->getMessage());
            Response::error('Server error during password reset', 500, $e->getMessage());
        }
    }
    
    // Verify token method
    public function verifyToken() {
        try {
            $headers = getallheaders();
            $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
            
            if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                Response::error('Authorization token required', 401);
                return;
            }
            
            $token = $matches[1];
            $payload = JWT::verify($token);
            
            if (!$payload) {
                Response::error('Invalid token', 401);
                return;
            }
            
            // Get user data
            $stmt = $this->db->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$payload['userId']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user) {
                Response::error('User not found', 404);
                return;
            }
            
            Response::success([
                'valid' => true,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'email' => $user['email'],
                    'profilePicture' => $user['profilePicture'],
                    'isEmailVerified' => (bool)$user['isEmailVerified'],
                    'authProvider' => $user['authProvider']
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Verify token error: ' . $e->getMessage());
            Response::error('Invalid token', 401);
        }
    }
}
?>
