<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Auto-detect and configure environment
require_once __DIR__ . '/config/auto-env.php';

// Serve uploaded files from php-backend/uploads
$requestPathForUpload = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

// Support both /uploads/... and /api/uploads/...
if (strpos($requestPathForUpload, '/api/uploads/') === 0) {
    $requestPathForUpload = substr($requestPathForUpload, 4); // converts /api/uploads/... to /uploads/...
}

if (strpos($requestPathForUpload, '/uploads/') === 0) {
    $uploadRoot = realpath(__DIR__ . '/uploads');
    $requestedFile = realpath(__DIR__ . $requestPathForUpload);

    if (
        $uploadRoot &&
        $requestedFile &&
        strpos($requestedFile, $uploadRoot) === 0 &&
        is_file($requestedFile)
    ) {
        $mimeType = mime_content_type($requestedFile) ?: 'application/octet-stream';

        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($requestedFile));
        header('Cache-Control: public, max-age=86400');

        readfile($requestedFile);
        exit;
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Uploaded file not found',
        'path' => $requestPathForUpload
    ]);
    exit;
}

// Load environment variables
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/cors.php';

// Load utilities
require_once __DIR__ . '/utils/Response.php';
require_once __DIR__ . '/utils/jwt.php';
require_once __DIR__ . '/utils/Validation.php';

// Load middleware
require_once __DIR__ . '/middleware/auth.php';

// Load models
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/models/Ad.php';
require_once __DIR__ . '/models/Chat.php';
require_once __DIR__ . '/models/Message.php';
require_once __DIR__ . '/models/ChatParticipant.php';

// Load controllers
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/UserController.php';
require_once __DIR__ . '/controllers/AdController.php';
require_once __DIR__ . '/controllers/ChatController.php';
require_once __DIR__ . '/controllers/ChatUploadController.php';
require_once __DIR__ . '/controllers/AdUploadController.php';
require_once __DIR__ . '/controllers/AdminController.php';

// Error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('log_errors', 1);


// Parse the request
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Remove base path if needed (adjust for your hosting setup)
$path = str_replace('/api', '', $path);

// Debug logging
error_log("Received request: $method $request_uri");
error_log("Parsed path: $path");
error_log("Chat check: " . (strpos($path, '/chat') === 0 ? 'MATCHES' : 'NO_MATCH'));
error_log("Delete-ad check: " . (preg_match('/^\/delete-ad\/(\d+)$/', $path) ? 'MATCHES' : 'NO_MATCH'));

// Output debug info to browser for testing
if (strpos($path, '/upload') !== false) {
    error_log("UPLOAD REQUEST DETECTED: Method=$method, Path=$path, URI=$request_uri");
error_log("UPLOAD REQUEST DETECTED: Method=" . ($_SERVER['REQUEST_METHOD'] ?? '') . ", URI=" . ($_SERVER['REQUEST_URI'] ?? ''));
    }

// Route handling
try {
    // Simple delete ad endpoint (no authentication) - placed early to ensure it gets matched
    if (preg_match('/^\/delete-ad\/(\d+)$/', $path, $matches) && $method === 'DELETE') {
        error_log("DELETE AD ROUTE MATCHED: Path=$path, Method=$method, AdId={$matches[1]}");
        try {
            $adId = $matches[1];
            error_log("Attempting to delete ad with ID: $adId");
            $result = Ad::delete($adId);
            error_log("Delete result: " . ($result ? 'SUCCESS' : 'FAILED'));
            
            if ($result) {
                Response::json(['message' => 'Ad deleted successfully', 'success' => true]);
            } else {
                Response::error('Failed to delete ad', 500);
            }
        } catch (Exception $e) {
            error_log('Simple delete ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
        exit(); // Ensure we exit after handling this route
    }
    
    // Authentication routes
    if (strpos($path, '/auth/') === 0) {
        $authController = new AuthController();
        handleAuthRoutes($authController, $path, $method);
    }
    // User routes
    elseif (strpos($path, '/user') === 0) {
        $userController = new UserController();
        handleUserRoutes($userController, $path, $method);
    }
    // Ad routes
    elseif (strpos($path, '/ads') === 0) {
        $adController = new AdController();
        handleAdRoutes($adController, $path, $method);
    }
    // Chat routes
    elseif (strpos($path, '/chat') === 0) {
        $chatController = new ChatController();
        handleChatRoutes($chatController, $path, $method);
    }
    // Deals routes
    elseif (strpos($path, '/deals') === 0) {
        handleDealsRoutes($path, $method);
    }
    // Crypto payments routes
    elseif (strpos($path, '/crypto-payments') === 0) {
        handleCryptoPaymentsRoutes($path, $method);
    }
    // Webhook routes
    elseif (strpos($path, '/webhooks/nowpayments') === 0) {
        require_once __DIR__ . '/webhooks/nowpayments.php';
        exit(); // Exit after handling webhook to prevent further processing
    }
    // Admin routes
    elseif (strpos($path, '/admin') === 0) {
        $adminController = new AdminController();
        handleAdminRoutes($adminController, $path, $method);
    }
    // Health check
    elseif ($path === '/health') {
        Response::success(['status' => 'ok']);
    }
    // Test NOWPayments integration
    elseif ($path === '/test-nowpayments') {
        handleTestNOWPayments();
    }
    // Contact routes
    elseif (strpos($path, '/contact') === 0) {
        handleContactRoutes($path, $method);
    }
    // Social media routes
    elseif (strpos($path, '/social-media') === 0) {
        handleSocialMediaRoutes($path, $method);
    }
    // Debug routes
    elseif (strpos($path, '/debug') === 0) {
        handleDebugRoutes($path, $method);
    }
    // Auth debug route
    elseif ($path === '/auth-debug') {
        try {
            $user = AuthMiddleware::authenticate();
            
            Response::json([
                'message' => 'User authenticated successfully',
                'user' => $user,
                'isAdmin' => $user['isAdmin'] ?? null,
                'isAdminType' => gettype($user['isAdmin'] ?? null),
                'adminEmail' => getenv('ADMIN_EMAIL'),
                'adminEmailCheck' => getenv('ADMIN_EMAIL') && strtolower($user['email']) === strtolower(getenv('ADMIN_EMAIL'))
            ]);
        } catch (Exception $e) {
            Response::error('Debug failed: ' . $e->getMessage(), 500);
        }
    }
    else {
        Response::error('Route not found', 404);
    }
} catch (Exception $e) {
    error_log('API Error: ' . $e->getMessage());
    Response::error('Internal server error: ' . $e->getMessage(), 500);
}

// Route handlers
function handleAuthRoutes($controller, $path, $method) {
    switch (true) {
        case $path === '/auth/register' && $method === 'POST':
            $controller->register();
            break;
        case $path === '/auth/verify-otp' && $method === 'POST':
            $controller->verifyOTP();
            break;
        case $path === '/auth/login' && $method === 'POST':
            $controller->login();
            break;
        case $path === '/auth/google' && $method === 'POST':
            $controller->googleSignIn();
            break;
        case $path === '/auth/google-signin' && $method === 'POST':
            $controller->googleSignIn();
            break;
        case $path === '/auth/refresh-token' && $method === 'POST':
            $controller->refreshToken();
            break;
        case $path === '/auth/logout' && $method === 'POST':
            $controller->logout();
            break;
        case $path === '/auth/forgot-password' && $method === 'POST':
            $controller->forgotPassword();
            break;
        case $path === '/auth/reset-password' && $method === 'POST':
            $controller->resetPassword();
            break;
        case $path === '/auth/verify-reset-token' && $method === 'POST':
            $controller->verifyResetToken();
            break;
        default:
            Response::error('Auth route not found', 404);
    }
}

function handleUserRoutes($controller, $path, $method) {
    switch (true) {
        case $path === '/user/profile' && $method === 'GET':
            $controller->getProfile();
            break;
        case $path === '/user/profile' && $method === 'PUT':
            $controller->updateProfile();
            break;
        case $path === '/user/check-username' && $method === 'POST':
            $controller->checkUsername();
            break;
        case $path === '/user/password' && $method === 'PUT':
            $controller->changePassword();
            break;
        case $path === '/user/email/change-request' && $method === 'POST':
            $controller->requestEmailChange();
            break;
        case $path === '/user/email/verify-current' && $method === 'POST':
            $controller->verifyCurrentEmail();
            break;
        case $path === '/user/email/verify-new' && $method === 'POST':
            $controller->verifyNewEmail();
            break;
        case $path === '/user/email/verify-change' && $method === 'POST':
            $controller->verifyEmailChange();
            break;
        case $path === '/user/email/cooldown-status' && $method === 'GET':
            $controller->getEmailChangeCooldown();
            break;
        case $path === '/user/password/change-request' && $method === 'POST':
            $controller->requestPasswordChange();
            break;
        case $path === '/user/password/verify-change' && $method === 'POST':
            $controller->verifyPasswordChange();
            break;
        case $path === '/user/password/cooldown-status' && $method === 'GET':
            $controller->getPasswordChangeCooldown();
            break;
        // VIP routes
        case $path === '/user/buy-vip' && $method === 'POST':
            $controller->buyVip();
            break;
        case $path === '/user/buyer-stats' && $method === 'GET':
            $controller->getBuyerStats();
            break;
        case preg_match('/^\/user\/u\/([^\/]+)$/', $path, $matches) && $method === 'GET':
    $controller->getUserByUsername(urldecode($matches[1]));
    break;
case preg_match('/^\/user\/(\d+)$/', $path, $matches) && $method === 'GET':
    $controller->getUserById($matches[1]);
    break;
case preg_match('/^\/user\/@(.+)$/', $path, $matches) && $method === 'GET':
    $controller->getUserByUsername(urldecode($matches[1]));
    break;
default:
    Response::error('User route not found', 404);}
}

function handleAdRoutes($controller, $path, $method) {
    error_log("Handling ad route: $method $path");
    switch (true) {
        case $path === '/ads' && $method === 'GET':
            $controller->getAllAds();
            break;
        case $path === '/ads' && $method === 'POST':
            $controller->createAd();
            break;
        case preg_match('/^\/ads\/(\d+)$/', $path, $matches) && $method === 'GET':
            $controller->getAdById($matches[1]);
            break;
        case preg_match('/^\/ads\/(\d+)$/', $path, $matches) && $method === 'PUT':
            $controller->updateAd($matches[1]);
            break;
        case preg_match('/^\/ads\/(\d+)$/', $path, $matches) && $method === 'DELETE':
            $controller->deleteAd($matches[1]);
            break;
        case preg_match('/^\/ads\/(\d+)\/mark-sold$/', $path, $matches) && $method === 'PUT':
            $controller->markAsSold($matches[1]);
            break;
        case preg_match('/^\/ads\/(\d+)\/pin$/', $path, $matches) && $method === 'PUT':
            error_log("Matched pin route for ad ID: " . $matches[1]);
            $controller->togglePin($matches[1]);
            break;
        case $path === '/ads/my-ads' && $method === 'GET':
            error_log("Matched /ads/my-ads route");
            $controller->getMyAds();
            break;
        case $path === '/ads/user/my-ads' && $method === 'GET':
    error_log("Matched /ads/user/my-ads route");
    $controller->getMyAds();
    break;
    case preg_match('/^\/ads\/user\/(\d+)\/activity$/', $path, $matches) && $method === 'GET':
    error_log("Matched public user activity route for user ID: " . $matches[1]);

    try {
        $userId = (int)$matches[1];

        $database = new Database();
        $pdo = $database->getConnection();

        $stmt = $pdo->prepare("
            SELECT 
                id,
                title,
                platform,
                price,
                status,
                subscribers,
                isMonetized,
                thumbnail,
                createdAt
            FROM ads
            WHERE userId = ?
            ORDER BY createdAt DESC
        ");
        $stmt->execute([$userId]);

        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalListings = count($ads);
        $activeListings = 0;
        $previousListings = 0;
        $soldListings = 0;
        $lastListedAt = null;
        $previousItems = [];

        foreach ($ads as $ad) {
            $statusRaw = isset($ad['status']) ? trim((string)$ad['status']) : '';
            $status = strtolower($statusRaw);

            $isActive = (
                $status === '' ||
                $status === '1' ||
                $status === 'active' ||
                $status === 'approved'
            );

            $isSold = (
                $status === 'sold' ||
                $status === 'completed' ||
                $status === 'closed'
            );

            if (!$lastListedAt && !empty($ad['createdAt'])) {
                $lastListedAt = $ad['createdAt'];
            }

            if ($isActive) {
                $activeListings++;
            } else {
                $previousListings++;

                if ($isSold) {
                    $soldListings++;
                }

                if (count($previousItems) < 8) {
                    $previousItems[] = [
                        'id' => isset($ad['id']) ? (int)$ad['id'] : 0,
                        'title' => $ad['title'] ?? 'Untitled listing',
                        'platform' => $ad['platform'] ?? '',
                        'price' => isset($ad['price']) ? (float)$ad['price'] : 0,
                        'status' => $statusRaw ?: 'previous',
                        'subscribers' => isset($ad['subscribers']) ? (int)$ad['subscribers'] : 0,
                        'isMonetized' => isset($ad['isMonetized']) ? (bool)$ad['isMonetized'] : false,
                        'thumbnail' => $ad['thumbnail'] ?? null,
                        'createdAt' => $ad['createdAt'] ?? null
                    ];
                }
            }
        }

        Response::json([
            'success' => true,
            'data' => [
                'totalListings' => $totalListings,
                'activeListings' => $activeListings,
                'previousListings' => $previousListings,
                'soldListings' => $soldListings,
                'lastListedAt' => $lastListedAt,
                'previousItems' => $previousItems
            ]
        ]);
    } catch (Exception $e) {
        error_log('Public user activity route error: ' . $e->getMessage());
        Response::error('Failed to load seller activity: ' . $e->getMessage(), 500);
    }

    break;
case preg_match('/^\/ads\/user\/(\d+)$/', $path, $matches) && $method === 'GET':
    error_log("Matched public user ads route for user ID: " . $matches[1]);

    try {
        $userId = (int)$matches[1];

        $database = new Database();
        $pdo = $database->getConnection();

        $stmt = $pdo->prepare("
            SELECT *
            FROM ads
            WHERE userId = ?
            ORDER BY createdAt DESC
        ");
        $stmt->execute([$userId]);

        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($ads as &$ad) {
            $ad['id'] = isset($ad['id']) ? (int)$ad['id'] : 0;
            $ad['price'] = isset($ad['price']) ? (float)$ad['price'] : 0;
            $ad['subscribers'] = isset($ad['subscribers']) ? (int)$ad['subscribers'] : 0;
            $ad['monthlyIncome'] = isset($ad['monthlyIncome']) ? (float)$ad['monthlyIncome'] : 0;
            $ad['isMonetized'] = isset($ad['isMonetized']) ? (bool)$ad['isMonetized'] : false;

            $screenshotRaw = $ad['screenshots'] ?? null;
            if ($screenshotRaw && $screenshotRaw !== '0' && $screenshotRaw !== 'null' && $screenshotRaw !== 'NULL') {
                $decodedScreenshots = json_decode($screenshotRaw, true);
                $ad['screenshots'] = is_array($decodedScreenshots) ? $decodedScreenshots : [];
            } else {
                $ad['screenshots'] = [];
            }
            
            // Sanitize thumbnail: don't allow '0', empty or 'null' string
            if (isset($ad['thumbnail']) && ($ad['thumbnail'] === '0' || $ad['thumbnail'] === 'null' || $ad['thumbnail'] === 'NULL' || trim($ad['thumbnail']) === '')) {
                $ad['thumbnail'] = null;
            }
        }

        Response::json([
            'success' => true,
            'data' => $ads
        ]);
    } catch (Exception $e) {
        error_log('Public user ads route error: ' . $e->getMessage());
        Response::error('Failed to load listings: ' . $e->getMessage(), 500);
    }

    break;
case $path === '/ads/search' && $method === 'GET':
    $controller->searchAds();
    break;
        case $path === '/ads/upload/screenshots' && $method === 'POST':
            error_log("Matched ad screenshot upload route");
            $uploadController = new AdUploadController();
            $uploadController->uploadScreenshots();
            break;
        case $path === '/ads/upload/thumbnail' && $method === 'POST':
            error_log("Matched ad thumbnail upload route");
            $uploadController = new AdUploadController();
            $uploadController->uploadThumbnail();
            break;
        case $path === '/ads/upload/test' && $method === 'GET':
            error_log("Test upload route hit");
            http_response_code(200);
            echo json_encode(['message' => 'Upload route working', 'timestamp' => date('Y-m-d H:i:s'), 'path' => $path, 'method' => $method]);
            break;
        case $path === '/test' && $method === 'GET':
            error_log("Simple test route hit");
            http_response_code(200);
            echo json_encode(['message' => 'Backend is working', 'timestamp' => date('Y-m-d H:i:s')]);
            break;
        default:
            error_log("No matching ad route found for: $method $path");
            Response::error('Ad route not found', 404);
    }
}

function handleChatRoutes($controller, $path, $method) {
    error_log("CHAT ROUTES: Processing $method $path");
    switch (true) {
        case $path === '/chat' && $method === 'GET':
            error_log("CHAT ROUTES: Matched /chat GET");
            $controller->getUserChats();
            break;
        case $path === '/chat/chats' && $method === 'GET':
            $controller->getUserChats();
            break;
        case $path === '/chat' && $method === 'POST':
            $controller->createOrGetChat();
            break;
        case $path === '/chat/chats' && $method === 'POST':
            $controller->createOrGetChat();
            break;
        case $path === '/chat/agent' && $method === 'POST':
            $controller->createOrGetAgentChat();
            break;
        case preg_match('/^\/chat\/(\d+)\/messages$/', $path, $matches) && $method === 'GET':
            $controller->getChatMessages($matches[1]);
            break;
        case preg_match('/^\/chat\/chats\/(\d+)\/messages$/', $path, $matches) && $method === 'GET':
            $controller->getChatMessages($matches[1]);
            break;
        case preg_match('/^\/chat\/(\d+)\/messages$/', $path, $matches) && $method === 'POST':
            $controller->sendMessage($matches[1]);
            break;
        case preg_match('/^\/chat\/chats\/(\d+)\/messages$/', $path, $matches) && $method === 'POST':
            $controller->sendMessage($matches[1]);
            break;
        case preg_match('/^\/chat\/(\d+)\/read$/', $path, $matches) && $method === 'PUT':
            $controller->markMessagesAsRead($matches[1]);
            break;
        case preg_match('/^\/chat\/chats\/(\d+)\/read$/', $path, $matches) && $method === 'PUT':
            $controller->markMessagesAsRead($matches[1]);
            break;
         case preg_match('/^\/chat\/(\d+)\/request-agent$/', $path, $matches) && $method === 'POST':
             $controller->requestAgentForChat($matches[1]);
             break;
         case preg_match('/^\/chat\/chats\/(\d+)\/request-agent$/', $path, $matches) && $method === 'POST':
             $controller->requestAgentForChat($matches[1]);
             break;
         case preg_match('/^\/chat\/(\d+)\/resolve-support$/', $path, $matches) && $method === 'POST':
             $controller->resolveSupportForChat($matches[1]);
             break;
         case preg_match('/^\/chat\/chats\/(\d+)\/resolve-support$/', $path, $matches) && $method === 'POST':
             $controller->resolveSupportForChat($matches[1]);
             break;
        case preg_match('/^\/chat\/(\d+)\/upload$/', $path, $matches) && $method === 'POST':
            $_GET['chatId'] = $matches[1];
            $uploadController = new ChatUploadController();
            $uploadController->uploadFile();
            break;
        case preg_match('/^\/chat\/chats\/(\d+)\/upload$/', $path, $matches) && $method === 'POST':
            error_log("CHAT ROUTES: Matched upload route for chat " . $matches[1]);
            $_GET['chatId'] = $matches[1];
            $uploadController = new ChatUploadController();
            $uploadController->uploadFile();
            break;
            case $path === '/chat/agent' && $method === 'POST':
    $controller->createOrGetAgentChat();
    break;
        case $path === '/chat/ad-inquiry' && $method === 'POST':
            $controller->createAdInquiryChat();
            break;
        case $path === '/chat/check-existing' && $method === 'POST':
            $controller->checkExistingChat();
            break;
        case $path === '/chat/admin-find-deal-chat' && $method === 'POST':
            $controller->adminFindDealChat();
            break;
        case preg_match('/^\/chat\/admin\/chats\/(\d+)\/messages$/', $path, $matches) && $method === 'POST':
            $controller->adminSendMessage($matches[1]);
            break;
        case preg_match('/^\/chat\/admin\/chats\/(\d+)$/', $path, $matches) && $method === 'DELETE':
            $controller->adminDeleteChat($matches[1]);
            break;
        case preg_match('/^\/chat\/admin\/messages\/(\d+)$/', $path, $matches) && $method === 'DELETE':
            $controller->adminDeleteMessage($matches[1]);
            break;
        default:
            Response::error('Chat route not found', 404);
    }
}

function handleAdminRoutes($controller, $path, $method) {
    switch (true) {
        case $path === '/admin/email' && $method === 'GET':
            $controller->getAdminEmail();
            break;
        case $path === '/admin/dashboard-stats' && $method === 'GET':
            $controller->getDashboardStats();
            break;
        case $path === '/admin/recent-activities' && $method === 'GET':
            $controller->getRecentActivities();
            break;
        case $path === '/admin/users' && $method === 'GET':
            $controller->getUsers();
            break;
        case $path === '/admin/ads' && $method === 'GET':
            $controller->getAds();
            break;
        case $path === '/admin/chats' && $method === 'GET':
            $controller->getChats();
            break;
        case $path === '/admin/deals' && $method === 'GET':
            $controller->getDeals();
            break;
        case preg_match('/^\/admin\/deals\/(\d+)\/status$/', $path, $matches) && $method === 'PUT':
            $controller->updateDealStatus($matches[1]);
            break;
        case $path === '/admin/support-requests' && $method === 'GET':
            $controller->getSupportRequests();
            break;
        case preg_match('/^\/admin\/users\/(\d+)\/ban$/', $path, $matches) && $method === 'PUT':
            $controller->banUser($matches[1]);
            break;
        case preg_match('/^\/admin\/users\/(\d+)\/unban$/', $path, $matches) && $method === 'PUT':
            $controller->unbanUser($matches[1]);
            break;
        case preg_match('/^\/admin\/users\/(\d+)\/role$/', $path, $matches) && $method === 'PUT':
            $controller->updateUserRole($matches[1]);
            break;
        case preg_match('/^\/admin\/users\/(\d+)\/vip$/', $path, $matches) && $method === 'PUT':
            $controller->toggleVip($matches[1]);
            break;
        case preg_match('/^\/admin\/users\/(\d+)\/display-name$/', $path, $matches) && $method === 'PUT':
            $controller->updateDisplayName($matches[1]);
            break;
        case preg_match('/^\/admin\/users\/(\d+)$/', $path, $matches) && $method === 'DELETE':
            $controller->deleteUser($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)\/delete$/', $path, $matches) && $method === 'DELETE':
            $controller->deleteAd($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)$/', $path, $matches) && $method === 'DELETE':
            $controller->deleteAd($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)\/status$/', $path, $matches) && $method === 'PUT':
            $controller->updateAdStatus($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)\/approve$/', $path, $matches) && $method === 'PUT':
            $controller->approveAd($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)\/reject$/', $path, $matches) && $method === 'PUT':
            $controller->rejectAd($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)\/ban$/', $path, $matches) && $method === 'PUT':
            $controller->banListing($matches[1]);
            break;
        case preg_match('/^\/admin\/ads\/(\d+)\/unban$/', $path, $matches) && $method === 'PUT':
            $controller->unbanListing($matches[1]);
            break;
        default:
            Response::error('Admin route not found', 404);
    }
}

function handleContactRoutes($path, $method) {
    require_once __DIR__ . '/controllers/ContactController.php';
    $controller = new ContactController();
    
    if ($path === '/contact/submit' && $method === 'POST') {
        $controller->submit();
    } elseif ($path === '/contact/status' && $method === 'GET') {
        $controller->status();
    } elseif ($path === '/contact' && $method === 'POST') {
        // Legacy support - redirect to /contact/submit
        $controller->submit();
    } else {
        Response::error('Contact route not found', 404);
    }
}

function handleSocialMediaRoutes($path, $method) {
    require_once __DIR__ . '/routes/social-media.php';
}

function handleDebugRoutes($path, $method) {
    require_once __DIR__ . '/routes/debug.php';
}

function handleDealsRoutes($path, $method) {
    require_once __DIR__ . '/routes/deals.php';
}

function handleCryptoPaymentsRoutes($path, $method) {
    require_once __DIR__ . '/api/crypto-payments.php';
}

function handleTestNOWPayments() {
    require_once __DIR__ . '/test_nowpayments_integration.php';
}
?>
