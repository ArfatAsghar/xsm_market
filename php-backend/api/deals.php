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

require_once '../config/database.php';
require_once '../middleware/auth.php';

// Get the request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];
$query_params = $_GET;

try {
    switch ($method) {
        case 'POST':
            if (isset($query_params['action']) && $query_params['action'] === 'create') {
                createDeal();
            } elseif (strpos($path, '/create') !== false) {
                createDeal();
            } elseif (isset($query_params['action']) && $query_params['action'] === 'seller-agree') {
                sellerAgreeToDeal();
            } elseif (strpos($path, '/seller-agree') !== false) {
                sellerAgreeToDeal();
            } else {
                createDeal(); // Default to create for POST requests
            }
            break;
        
        case 'GET':
            if (strpos($path, '/buyer/') !== false) {
                getBuyerDeals();
            } elseif (strpos($path, '/seller/') !== false) {
                getSellerDeals();
            } elseif (strpos($path, '/') !== false && preg_match('/\/(\d+)$/', $path, $matches)) {
                getDealById($matches[1]);
            } else {
                getAllDeals();
            }
            break;
        
        case 'PUT':
            if (preg_match('/\/(\d+)\/status$/', $path, $matches)) {
                updateDealStatus($matches[1]);
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

function createDeal() {
    global $pdo;
    
    // Get the authenticated user
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        return;
    }
    
    // Get JSON input
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $required_fields = ['seller_id', 'channel_id', 'channel_title', 'channel_price', 'escrow_fee', 'buyer_email', 'payment_methods', 'transaction_id'];
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty($input[$field])) {
            http_response_code(400);
            echo json_encode(['message' => "Missing required field: $field"]);
            return;
        }
    }
    
    try {
        $pdo->beginTransaction();
        
        // Insert main deal record
        $stmt = $pdo->prepare("
            INSERT INTO deals (
                transaction_id, buyer_id, seller_id, channel_id, channel_title, 
                channel_price, escrow_fee, transaction_type, buyer_email, 
                buyer_payment_methods, deal_status, buyer_agreed, buyer_agreed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seller_reviewing', TRUE, NOW())
        ");
        
        $payment_methods_json = json_encode($input['payment_methods']);
        $transaction_type = $input['transaction_type'] ?? 'safest';
        
        $stmt->execute([
            $input['transaction_id'],
            $user['id'],
            $input['seller_id'],
            $input['channel_id'],
            $input['channel_title'],
            $input['channel_price'],
            $input['escrow_fee'],
            $transaction_type,
            $input['buyer_email'],
            $payment_methods_json
        ]);
        
        $deal_id = $pdo->lastInsertId();
        
        // Insert payment methods into separate table
        $payment_stmt = $pdo->prepare("
            INSERT INTO deal_payment_methods (deal_id, payment_method_id, payment_method_name, payment_method_category)
            VALUES (?, ?, ?, ?)
        ");
        
        foreach ($input['payment_methods'] as $method) {
            $payment_stmt->execute([
                $deal_id,
                $method['id'],
                $method['name'],
                $method['category']
            ]);
        }
        
        // Insert history record
        $history_stmt = $pdo->prepare("
            INSERT INTO deal_history (deal_id, action_type, action_by, action_description)
            VALUES (?, 'created', ?, ?)
        ");
        
        $description = "Deal created for channel: {$input['channel_title']} with {$input['channel_price']} USD. Buyer selected " . count($input['payment_methods']) . " payment methods.";
        $history_stmt->execute([$deal_id, $user['id'], $description]);
        
        $pdo->commit();
        
        // Get the created deal with all details
        $deal = getDealWithDetails($deal_id);
        
        http_response_code(201);
        echo json_encode([
            'message' => 'Deal created successfully',
            'deal_id' => $deal_id,
            'transaction_id' => $input['transaction_id'],
            'deal' => $deal
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function sellerAgreeToDeal() {
    global $pdo;
    
    // Get the authenticated user
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['deal_id'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Missing deal_id']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Verify user is the seller for this deal
        $stmt = $pdo->prepare("SELECT * FROM deals WHERE id = ? AND seller_id = ?");
        $stmt->execute([$input['deal_id'], $user['id']]);
        $deal = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$deal) {
            http_response_code(404);
            echo json_encode(['message' => 'Deal not found or you are not the seller']);
            return;
        }
        
        // Update deal to seller agreed
        $update_stmt = $pdo->prepare("
            UPDATE deals 
            SET seller_agreed = TRUE, seller_agreed_at = NOW(), deal_status = 'terms_agreed', updated_at = NOW()
            WHERE id = ?
        ");
        $update_stmt->execute([$input['deal_id']]);
        
        // Insert history record
        $history_stmt = $pdo->prepare("
            INSERT INTO deal_history (deal_id, action_type, action_by, action_description)
            VALUES (?, 'seller_agreed', ?, ?)
        ");
        
        $description = "Seller agreed to the deal terms and selected payment methods.";
        $history_stmt->execute([$input['deal_id'], $user['id'], $description]);
        
        $pdo->commit();
        
        http_response_code(200);
        echo json_encode([
            'message' => 'Seller agreement recorded successfully',
            'deal_id' => $input['deal_id'],
            'status' => 'terms_agreed'
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function getBuyerDeals() {
    global $pdo;
    
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        return;
    }
    
    $stmt = $pdo->prepare("
        SELECT d.*, 
               u.username as seller_name, u.email as seller_email,
               COUNT(dpm.id) as payment_methods_count
        FROM deals d
        LEFT JOIN users u ON d.seller_id = u.id
        LEFT JOIN deal_payment_methods dpm ON d.id = dpm.deal_id
        WHERE d.buyer_id = ?
        GROUP BY d.id
        ORDER BY d.created_at DESC
    ");
    $stmt->execute([$user['id']]);
    $deals = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get payment methods for each deal
    foreach ($deals as &$deal) {
        $deal['payment_methods'] = getDealPaymentMethods($deal['id']);
        $deal['buyer_payment_methods'] = json_decode($deal['buyer_payment_methods'], true);
    }
    
    echo json_encode($deals);
}

function getSellerDeals() {
    global $pdo;
    
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        return;
    }
    
    $stmt = $pdo->prepare("
        SELECT d.*, 
               u.username as buyer_name, u.email as buyer_email,
               COUNT(dpm.id) as payment_methods_count
        FROM deals d
        LEFT JOIN users u ON d.buyer_id = u.id
        LEFT JOIN deal_payment_methods dpm ON d.id = dpm.deal_id
        WHERE d.seller_id = ?
        GROUP BY d.id
        ORDER BY d.created_at DESC
    ");
    $stmt->execute([$user['id']]);
    $deals = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get payment methods for each deal
    foreach ($deals as &$deal) {
        $deal['payment_methods'] = getDealPaymentMethods($deal['id']);
        $deal['buyer_payment_methods'] = json_decode($deal['buyer_payment_methods'], true);
    }
    
    echo json_encode($deals);
}

function getDealById($deal_id) {
    global $pdo;
    
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        return;
    }
    
    $deal = getDealWithDetails($deal_id);
    
    if (!$deal) {
        http_response_code(404);
        echo json_encode(['message' => 'Deal not found']);
        return;
    }
    
    // Check if user is buyer or seller
    if ($deal['buyer_id'] != $user['id'] && $deal['seller_id'] != $user['id']) {
        http_response_code(403);
        echo json_encode(['message' => 'Access denied']);
        return;
    }
    
    echo json_encode($deal);
}

function getDealWithDetails($deal_id) {
    global $pdo;
    
    $stmt = $pdo->prepare("
        SELECT d.*, 
               buyer.username as buyer_name, buyer.email as buyer_email,
               seller.username as seller_name, seller.email as seller_email
        FROM deals d
        LEFT JOIN users buyer ON d.buyer_id = buyer.id
        LEFT JOIN users seller ON d.seller_id = seller.id
        WHERE d.id = ?
    ");
    $stmt->execute([$deal_id]);
    $deal = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($deal) {
        $deal['payment_methods'] = getDealPaymentMethods($deal_id);
        $deal['buyer_payment_methods'] = json_decode($deal['buyer_payment_methods'], true);
        $deal['history'] = getDealHistory($deal_id);
    }
    
    return $deal;
}

function getDealPaymentMethods($deal_id) {
    global $pdo;
    
    $stmt = $pdo->prepare("SELECT * FROM deal_payment_methods WHERE deal_id = ? ORDER BY created_at");
    $stmt->execute([$deal_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getDealHistory($deal_id) {
    global $pdo;
    
    $stmt = $pdo->prepare("
        SELECT dh.*, u.username as action_by_name
        FROM deal_history dh
        LEFT JOIN users u ON dh.action_by = u.id
        WHERE dh.deal_id = ?
        ORDER BY dh.created_at DESC
    ");
    $stmt->execute([$deal_id]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function updateDealStatus($deal_id) {
    global $pdo;
    
    $user = getCurrentUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['message' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['status'])) {
        http_response_code(400);
        echo json_encode(['message' => 'Missing status']);
        return;
    }
    
    $allowed_statuses = ['pending', 'seller_reviewing', 'payment_negotiation', 'terms_agreed', 'escrow_paid', 'channel_transferred', 'payment_completed', 'completed', 'cancelled', 'disputed'];
    
    if (!in_array($input['status'], $allowed_statuses)) {
        http_response_code(400);
        echo json_encode(['message' => 'Invalid status']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Verify user has access to this deal
        $stmt = $pdo->prepare("SELECT * FROM deals WHERE id = ? AND (buyer_id = ? OR seller_id = ?)");
        $stmt->execute([$deal_id, $user['id'], $user['id']]);
        $deal = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$deal) {
            http_response_code(404);
            echo json_encode(['message' => 'Deal not found or access denied']);
            return;
        }
        
        // Update deal status
        $update_stmt = $pdo->prepare("UPDATE deals SET deal_status = ?, updated_at = NOW() WHERE id = ?");
        $update_stmt->execute([$input['status'], $deal_id]);
        
        // Insert history record
        $history_stmt = $pdo->prepare("
            INSERT INTO deal_history (deal_id, action_type, action_by, action_description)
            VALUES (?, ?, ?, ?)
        ");
        
        $description = $input['note'] ?? "Deal status updated to: {$input['status']}";
        $history_stmt->execute([$deal_id, $user['id'], $description]);
        
        $pdo->commit();
        
        echo json_encode([
            'message' => 'Deal status updated successfully',
            'deal_id' => $deal_id,
            'new_status' => $input['status']
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function getCurrentUser() {
    // Get the Authorization header with multiple fallback methods
    $authHeader = null;
    
    // Method 1: apache_request_headers (if available)
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? null;
    }
    
    // Method 2: $_SERVER fallback
    if (!$authHeader) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
    }
    
    // Method 3: Manual header parsing
    if (!$authHeader && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }
    
    if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return null;
    }
    
    $token = $matches[1];
    
    // Include the JWT utility
    require_once '../utils/jwt.php';
    
    try {
        $decoded = JWT::verify($token);
        return $decoded;
    } catch (Exception $e) {
        error_log("JWT verification error: " . $e->getMessage());
        return null;
    }
}
?>
