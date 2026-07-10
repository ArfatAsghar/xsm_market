<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../utils/NOWPaymentsAPI.php';

try {
    $nowPayments = new NOWPaymentsAPI();
    
    echo json_encode([
        'success' => true,
        'message' => 'NOWPayments API is working',
        'environment' => $_ENV['NOW_PAYMENTS_ENVIRONMENT'] ?? 'sandbox',
        'api_url' => $nowPayments->apiUrl ?? 'Not set',
        'webhook_url' => $_ENV['NOW_PAYMENTS_WEBHOOK_URL'] ?? 'Not set'
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'NOWPayments API test failed',
        'error' => $e->getMessage()
    ]);
}
?>
