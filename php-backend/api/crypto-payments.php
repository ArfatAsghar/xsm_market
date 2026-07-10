<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// These should already be loaded by index.php, but include if not
if (!class_exists('Database')) {
    require_once __DIR__ . '/../config/database.php';
}
if (!class_exists('AuthMiddleware')) {
    require_once __DIR__ . '/../middleware/auth.php';
}
if (!class_exists('NOWPaymentsAPI')) {
    require_once __DIR__ . '/../utils/NOWPaymentsAPI.php';
}

// Helper function for getting current user
function getCurrentUser() {
    try {
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
        
        if ($authHeader && preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
        
        if (!$token) {
            return null;
        }
        
        // Verify the token
        require_once __DIR__ . '/../utils/jwt.php';
        require_once __DIR__ . '/../models/User.php';
        
        $decoded = JWT::decode($token, 'access');
        
        if (!isset($decoded['userId'])) {
            return null;
        }
        
        // Check if user still exists
        $user = new User();
        $currentUser = $user->findById($decoded['userId']);
        
        return $currentUser;
        
    } catch (Exception $e) {
        error_log('Crypto payments auth error: ' . $e->getMessage());
        return null;
    }
}

// Get the request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];
$pathParts = explode('/', trim($path, '/'));

try {
    switch ($method) {
        case 'GET':
            if (end($pathParts) === 'currencies') {
                getCurrencies();
            } elseif (end($pathParts) === 'estimate') {
                getEstimate();
            } elseif (preg_match('/\/payments\/(\d+)\/status$/', $path, $matches)) {
                getPaymentStatus($matches[1]);
            } else {
                http_response_code(404);
                echo json_encode(['message' => 'Endpoint not found']);
            }
            break;
        
        case 'POST':
            if (strpos($path, '/create-payment') !== false) {
                createCryptoPayment();
            } else {
                http_response_code(404);
                echo json_encode(['message' => 'Endpoint not found']);
            }
            break;
        
        default:
            http_response_code(405);
            echo json_encode(['message' => 'Method not allowed']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'message' => 'Internal server error',
        'error' => $e->getMessage()
    ]);
}

function getCurrencies() {
    try {
        $nowPayments = new NOWPaymentsAPI();
        $currencies = $nowPayments->getSupportedCurrencies();
        
        echo json_encode([
            'success' => true,
            'currencies' => $currencies
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to fetch currencies',
            'error' => $e->getMessage()
        ]);
    }
}

function getEstimate() {
    $amount = $_GET['amount'] ?? null;
    $from = $_GET['from'] ?? 'usd';
    $to = $_GET['to'] ?? 'btc';
    
    if (!$amount) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Amount parameter is required'
        ]);
        return;
    }
    
    try {
        $nowPayments = new NOWPaymentsAPI();
        $estimate = $nowPayments->getEstimatedPrice($from, $to, $amount);
        
        echo json_encode([
            'success' => true,
            'estimate' => $estimate
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to get estimate',
            'error' => $e->getMessage()
        ]);
    }
}

function createCryptoPayment() {
    // Get the authenticated user
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        return;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $dealId = $input['deal_id'] ?? null;
    $payCurrency = $input['pay_currency'] ?? 'btc';
    
    if (!$dealId) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Deal ID is required'
        ]);
        return;
    }
    
    try {
        $pdo = Database::getConnection();
        
        // Get deal information
        $stmt = $pdo->prepare("
            SELECT d.*, 
                   buyer.email as buyer_email, buyer.username as buyer_username,
                   seller.email as seller_email, seller.username as seller_username
            FROM deals d
            LEFT JOIN users buyer ON d.buyer_id = buyer.id
            LEFT JOIN users seller ON d.seller_id = seller.id
            WHERE d.id = ? AND (d.buyer_id = ? OR d.seller_id = ?)
        ");
        $stmt->execute([$dealId, $user['id'], $user['id']]);
        $deal = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$deal) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Deal not found or you do not have access to it'
            ]);
            return;
        }
        
        // Check if transaction fee is already paid
        if ($deal['transaction_fee_paid']) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Transaction fee has already been paid for this deal'
            ]);
            return;
        }
        
        // Check if there's already a pending crypto payment
        $checkStmt = $pdo->prepare("
            SELECT * FROM crypto_payments 
            WHERE deal_id = ? AND payment_status IN ('waiting', 'confirming', 'sending')
        ");
        $checkStmt->execute([$dealId]);
        $existingPayment = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingPayment) {
            // Return existing payment information
            echo json_encode([
                'success' => true,
                'message' => 'Payment already exists',
                'payment' => [
                    'payment_id' => $existingPayment['nowpayments_payment_id'],
                    'payment_url' => $existingPayment['payment_url'],
                    'qr_code_url' => $existingPayment['qr_code_url'],
                    'amount' => $existingPayment['price_amount'],
                    'currency' => $existingPayment['price_currency'],
                    'pay_currency' => $existingPayment['pay_currency'],
                    'status' => $existingPayment['payment_status']
                ]
            ]);
            return;
        }
        
        // Create NOWPayments payment
        $nowPayments = new NOWPaymentsAPI();
        $orderId = "deal_{$dealId}_" . time();
        
        $paymentData = [
            'price_amount' => floatval($deal['escrow_fee']),
            'price_currency' => 'usd',
            'pay_currency' => strtolower($payCurrency),
            'order_id' => $orderId,
            'order_description' => "Escrow fee for deal #{$dealId} - {$deal['channel_title']}",
            'customer_email' => $user['email']
        ];
        
        $paymentResponse = $nowPayments->createPayment($paymentData);
        
        // Store payment in our database
        $insertStmt = $pdo->prepare("
            INSERT INTO crypto_payments 
            (deal_id, nowpayments_payment_id, order_id, payment_status, 
             price_amount, price_currency, pay_currency, payment_url, 
             qr_code_url, webhook_data, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ");
        
        $insertStmt->execute([
            $dealId,
            $paymentResponse['payment_id'],
            $orderId,
            $paymentResponse['payment_status'],
            $paymentData['price_amount'],
            $paymentData['price_currency'],
            $paymentData['pay_currency'],
            $paymentResponse['payment_url'] ?? null,
            $paymentResponse['qr_code_url'] ?? null,
            json_encode($paymentResponse)
        ]);
        
        // Add to deal history
        $historyStmt = $pdo->prepare("
            INSERT INTO deal_history (deal_id, action_type, action_by, action_description, created_at)
            VALUES (?, 'note_added', ?, ?, NOW())
        ");
        $description = "Cryptocurrency payment initiated. Payment ID: {$paymentResponse['payment_id']}. Pay currency: {$payCurrency}";
        $historyStmt->execute([$dealId, $user['id'], $description]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Crypto payment created successfully',
            'payment' => [
                'payment_id' => $paymentResponse['payment_id'],
                'payment_url' => $paymentResponse['payment_url'] ?? null,
                'qr_code_url' => $paymentResponse['qr_code_url'] ?? null,
                'amount' => $paymentData['price_amount'],
                'currency' => $paymentData['price_currency'],
                'pay_currency' => $paymentData['pay_currency'],
                'pay_amount' => $paymentResponse['pay_amount'] ?? null,
                'status' => $paymentResponse['payment_status'],
                'order_id' => $orderId,
                'created_date' => $paymentResponse['created_at'] ?? null,
                'updated_date' => $paymentResponse['updated_at'] ?? null
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to create crypto payment',
            'error' => $e->getMessage()
        ]);
    }
}

function getPaymentStatus($dealId) {
    // Get the authenticated user
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        return;
    }
    
    try {
        $pdo = Database::getConnection();
        
        // Get payment information
        $stmt = $pdo->prepare("
            SELECT cp.*, d.buyer_id, d.seller_id
            FROM crypto_payments cp
            JOIN deals d ON cp.deal_id = d.id
            WHERE cp.deal_id = ? AND (d.buyer_id = ? OR d.seller_id = ?)
            ORDER BY cp.created_at DESC
            LIMIT 1
        ");
        $stmt->execute([$dealId, $user['id'], $user['id']]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$payment) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Payment not found'
            ]);
            return;
        }
        
        // Optionally fetch latest status from NOWPayments
        try {
            $nowPayments = new NOWPaymentsAPI();
            $latestStatus = $nowPayments->getPaymentStatus($payment['nowpayments_payment_id']);
            
            // Update our database if status changed
            if ($latestStatus['payment_status'] !== $payment['payment_status']) {
                $updateStmt = $pdo->prepare("
                    UPDATE crypto_payments 
                    SET payment_status = ?, updated_at = NOW()
                    WHERE id = ?
                ");
                $updateStmt->execute([$latestStatus['payment_status'], $payment['id']]);
                $payment['payment_status'] = $latestStatus['payment_status'];
            }
        } catch (Exception $e) {
            // If we can't fetch from NOWPayments, just use our stored data
            error_log("Failed to fetch latest payment status: " . $e->getMessage());
        }
        
        echo json_encode([
            'success' => true,
            'payment' => [
                'payment_id' => $payment['nowpayments_payment_id'],
                'status' => $payment['payment_status'],
                'amount' => $payment['price_amount'],
                'currency' => $payment['price_currency'],
                'pay_currency' => $payment['pay_currency'],
                'actually_paid' => $payment['actually_paid'],
                'payment_url' => $payment['payment_url'],
                'qr_code_url' => $payment['qr_code_url'],
                'created_at' => $payment['created_at'],
                'updated_at' => $payment['updated_at']
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Failed to get payment status',
            'error' => $e->getMessage()
        ]);
    }
}
