<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/NOWPaymentsAPI.php';
require_once __DIR__ . '/../utils/PaymentHelpers.php';

// Load environment variables - try multiple locations
$envFile = __DIR__ . '/../.env';
if (!file_exists($envFile)) {
    $envFile = __DIR__ . '/../../.env.production';
}
if (!file_exists($envFile)) {
    $envFile = __DIR__ . '/../.env.production';
}
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue; // Skip comments
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $_ENV[trim($name)] = trim($value);
        }
    }
}

// Print to console when webhook is hit
echo "🚀 NOWPayments Webhook Hit at " . date('Y-m-d H:i:s') . "\n";
error_log("🚀 NOWPayments Webhook endpoint accessed at " . date('Y-m-d H:i:s'));

// Log all webhook requests for debugging
function logWebhook($message, $data = null) {
    $logFile = __DIR__ . '/../../logs/webhook.log';
    
    // Create logs directory if it doesn't exist
    $logDir = dirname($logFile);
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] $message";
    if ($data !== null) {
        $logEntry .= " | Data: " . json_encode($data);
    }
    file_put_contents($logFile, $logEntry . "\n", FILE_APPEND | LOCK_EX);
}

// NOWPayments IPN signature verification according to official documentation
function verifyNowPaymentsSignature($requestBody, $receivedSignature, $ipnSecret) {
    // Parse JSON to array
    $data = json_decode($requestBody, true);
    if (!$data) {
        return false;
    }
    
    // Sort by keys and convert back to JSON string (NOWPayments requirement)
    ksort($data);
    $sortedJson = json_encode($data, JSON_UNESCAPED_SLASHES);
    
    // Create HMAC SHA-512 signature
    $calculatedSignature = hash_hmac('sha512', $sortedJson, $ipnSecret);
    
    logWebhook('Signature verification', [
        'sorted_json' => $sortedJson,
        'calculated_sig' => $calculatedSignature,
        'received_sig' => $receivedSignature,
        'match' => hash_equals($calculatedSignature, $receivedSignature)
    ]);
    
    // Use hash_equals for timing attack protection
    return hash_equals($calculatedSignature, $receivedSignature);
}

try {
    echo "📥 Processing webhook request...\n";
    error_log("📥 NOWPayments webhook - Processing request");
    
    // Only accept POST requests
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit();
    }

    // Get the request body and signature
    $requestBody = file_get_contents('php://input');
    $signature = $_SERVER['HTTP_X_NOWPAYMENTS_SIG'] ?? '';

    logWebhook('Webhook received', [
        'signature' => $signature,
        'body_length' => strlen($requestBody),
        'headers' => getallheaders()
    ]);

    // Get IPN Secret from environment based on current environment
    $environment = $_ENV['NOW_PAYMENTS_ENVIRONMENT'] ?? 'sandbox';
    $ipnSecret = $environment === 'production' 
        ? $_ENV['NOW_PAYMENTS_IPN_SECRET_PRODUCTION'] 
        : $_ENV['NOW_PAYMENTS_IPN_SECRET_SANDBOX'];
    
    if (!$ipnSecret) {
        logWebhook('❌ IPN Secret not configured', ['environment' => $environment]);
        http_response_code(500);
        echo json_encode(['error' => 'IPN Secret not configured']);
        exit();
    }
    
    // Enable signature verification in production (CRITICAL FOR SECURITY)
    $enableSignatureVerification = ($environment === 'production');
    
    logWebhook('IPN Configuration', [
        'environment' => $environment,
        'verification_enabled' => $enableSignatureVerification,
        'secret_configured' => !empty($ipnSecret)
    ]);
    
    // Verify the webhook signature according to NOWPayments documentation
    if ($enableSignatureVerification) {
        if (!$signature) {
            logWebhook('Missing signature header');
            http_response_code(401);
            echo json_encode(['error' => 'Missing signature']);
            exit();
        }
        
        if (!verifyNowPaymentsSignature($requestBody, $signature, $ipnSecret)) {
            logWebhook('Invalid signature verification failed');
            http_response_code(401);
            echo json_encode(['error' => 'Invalid signature']);
            exit();
        }
        
        logWebhook('✅ Signature verification passed');
    } else {
        logWebhook('⚠️ Signature verification DISABLED for testing', ['signature' => $signature]);
    }

    // Parse the webhook data
    $webhookData = json_decode($requestBody, true);
    if (!$webhookData) {
        logWebhook('Invalid JSON in webhook body');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit();
    }

    logWebhook('Webhook data parsed successfully', $webhookData);

    // Extract payment information
    $paymentId = $webhookData['payment_id'] ?? null;
    $paymentStatus = $webhookData['payment_status'] ?? null;
    $orderId = $webhookData['order_id'] ?? null;
    $priceAmount = $webhookData['price_amount'] ?? null;
    $actuallyPaid = $webhookData['actually_paid'] ?? null;
    $payCurrency = $webhookData['pay_currency'] ?? null;
    $outcomeAmount = $webhookData['outcome_amount'] ?? null;
    $outcomeCurrency = $webhookData['outcome_currency'] ?? null;

    if (!$paymentId || !$paymentStatus || !$orderId) {
        logWebhook('Missing required fields', $webhookData);
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit();
    }

    // Extract deal ID from order ID (format: deal_{dealId}_{timestamp})
    if (preg_match('/^deal_(\d+)_\d+$/', $orderId, $matches)) {
        $dealId = intval($matches[1]);
    } else {
        logWebhook('Invalid order ID format', ['order_id' => $orderId]);
        http_response_code(400);
        echo json_encode(['error' => 'Invalid order ID format']);
        exit();
    }

    // Check if payment already processed
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare("
        SELECT id, payment_status, deal_id 
        FROM crypto_payments 
        WHERE nowpayments_payment_id = ?
    ");
    $stmt->execute([$paymentId]);
    $existingPayment = $stmt->fetch(PDO::FETCH_ASSOC);

    $pdo->beginTransaction();

    try {
        if ($existingPayment) {
            // Update existing payment
            $updateStmt = $pdo->prepare("
                UPDATE crypto_payments 
                SET payment_status = ?, 
                    actually_paid = ?, 
                    pay_currency = ?, 
                    outcome_amount = ?, 
                    outcome_currency = ?, 
                    updated_at = NOW(),
                    webhook_data = ?
                WHERE nowpayments_payment_id = ?
            ");
            $updateStmt->execute([
                $paymentStatus,
                $actuallyPaid,
                $payCurrency,
                $outcomeAmount,
                $outcomeCurrency,
                json_encode($webhookData),
                $paymentId
            ]);
            
            logWebhook('Updated existing payment', ['payment_id' => $paymentId, 'status' => $paymentStatus]);
        } else {
            // Create new payment record
            $insertStmt = $pdo->prepare("
                INSERT INTO crypto_payments 
                (deal_id, nowpayments_payment_id, order_id, payment_status, 
                 price_amount, price_currency, actually_paid, pay_currency, 
                 outcome_amount, outcome_currency, webhook_data, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            $insertStmt->execute([
                $dealId,
                $paymentId,
                $orderId,
                $paymentStatus,
                $priceAmount,
                $webhookData['price_currency'] ?? 'usd',
                $actuallyPaid,
                $payCurrency,
                $outcomeAmount,
                $outcomeCurrency,
                json_encode($webhookData)
            ]);
            
            logWebhook('Created new payment record', ['payment_id' => $paymentId, 'deal_id' => $dealId]);
        }

        // Handle different payment statuses
        switch ($paymentStatus) {
            case 'finished':
            case 'confirmed':
                // Payment successful - update deal status
                handleSuccessfulPayment($pdo, $dealId, $paymentId, $webhookData);
                break;
            
            case 'failed':
            case 'expired':
                // Payment failed
                handleFailedPayment($pdo, $dealId, $paymentId, $webhookData);
                break;
            
            case 'waiting':
            case 'confirming':
            case 'sending':
                // Payment in progress - just log it
                logWebhook('Payment in progress', ['status' => $paymentStatus, 'deal_id' => $dealId]);
                break;
            
            default:
                logWebhook('Unknown payment status', ['status' => $paymentStatus]);
        }

        $pdo->commit();
        
        logWebhook('Webhook processed successfully', ['deal_id' => $dealId, 'payment_status' => $paymentStatus]);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Webhook processed successfully']);

    } catch (Exception $e) {
        $pdo->rollBack();
        logWebhook('Error processing webhook', ['error' => $e->getMessage()]);
        throw $e;
    }

} catch (Exception $e) {
    logWebhook('Webhook processing failed', [
        'error' => $e->getMessage(), 
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
    http_response_code(500);
    echo json_encode(['error' => 'Internal server error', 'debug' => $e->getMessage()]);
}

function handleSuccessfulPayment($pdo, $dealId, $paymentId, $webhookData) {
    logWebhook('🎉 Processing successful payment', [
        'deal_id' => $dealId,
        'payment_id' => $paymentId,
        'amount_paid' => $webhookData['actually_paid'] ?? 'N/A',
        'currency' => $webhookData['pay_currency'] ?? 'N/A'
    ]);

    $applied = markTransactionFeePaid($pdo, $dealId, $paymentId, $webhookData);

    logWebhook($applied ? '✅ Deal marked as fee paid via webhook' : 'ℹ️ Deal already marked as fee paid, skipping', [
        'deal_id' => $dealId
    ]);
}

function handleFailedPayment($pdo, $dealId, $paymentId, $webhookData) {
    // Log the failed payment
    $historyStmt = $pdo->prepare("
        INSERT INTO deal_history (deal_id, action_type, action_description, created_at)
        VALUES (?, 'note_added', ?, NOW())
    ");
    $description = "Cryptocurrency payment failed. Payment ID: {$paymentId}. Status: {$webhookData['payment_status']}";
    $historyStmt->execute([$dealId, $description]);

    logWebhook('Payment failed', [
        'deal_id' => $dealId,
        'payment_id' => $paymentId,
        'status' => $webhookData['payment_status']
    ]);
}
