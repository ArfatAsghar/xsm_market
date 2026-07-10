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

    // Get deal details to find buyer_id for action_by field
    $dealStmt = $pdo->prepare("SELECT buyer_id FROM deals WHERE id = ?");
    $dealStmt->execute([$dealId]);
    $deal = $dealStmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$deal) {
        throw new Exception("Deal not found: $dealId");
    }
    
    $buyerId = $deal['buyer_id'];

    // Update deal status to indicate transaction fee has been paid
    $stmt = $pdo->prepare("
        UPDATE deals 
        SET transaction_fee_paid = 1,
            transaction_fee_paid_at = NOW(),
            transaction_fee_payment_method = 'crypto',
            deal_status = 'fee_paid',
            updated_at = NOW()
        WHERE id = ?
    ");
    $result = $stmt->execute([$dealId]);
    
    if ($result) {
        $rowsAffected = $stmt->rowCount();
        logWebhook('✅ Deal updated successfully', [
            'deal_id' => $dealId,
            'rows_affected' => $rowsAffected,
            'new_status' => 'fee_paid'
        ]);
    } else {
        logWebhook('❌ Failed to update deal', ['deal_id' => $dealId]);
    }

    // Add to deal history with buyer_id as action_by
    $historyStmt = $pdo->prepare("
        INSERT INTO deal_history (deal_id, action_type, action_by, action_description, created_at)
        VALUES (?, 'fee_paid', ?, ?, NOW())
    ");
    $description = "Transaction fee paid via cryptocurrency. Payment ID: {$paymentId}. Amount: {$webhookData['actually_paid']} {$webhookData['pay_currency']}";
    $historyResult = $historyStmt->execute([$dealId, $buyerId, $description]);
    
    if ($historyResult) {
        logWebhook('✅ Deal history updated', ['deal_id' => $dealId]);
    } else {
        logWebhook('❌ Failed to update deal history', ['deal_id' => $dealId]);
    }

    // Get deal details for notifications
    $dealStmt = $pdo->prepare("
        SELECT d.*, 
               buyer.email as buyer_email, buyer.username as buyer_username,
               seller.email as seller_email, seller.username as seller_username
        FROM deals d
        LEFT JOIN users buyer ON d.buyer_id = buyer.id
        LEFT JOIN users seller ON d.seller_id = seller.id
        WHERE d.id = ?
    ");
    $dealStmt->execute([$dealId]);
    $deal = $dealStmt->fetch(PDO::FETCH_ASSOC);

    if ($deal) {
        logWebhook('✅ Deal updated - transaction fee paid via crypto!', [
            'deal_id' => $dealId,
            'transaction_id' => $deal['transaction_id'],
            'buyer' => $deal['buyer_username'],
            'seller' => $deal['seller_username'],
            'channel' => $deal['channel_title'],
            'fee_paid' => $deal['transaction_fee_paid'],
            'payment_method' => $deal['transaction_fee_payment_method'],
            'deal_status' => $deal['deal_status']
        ]);
        
        // Send agent email to seller via chat (same as in deals.php)
        try {
            // Get admin email from environment - try different environment variable names
            $admin_email = $_ENV['ADMIN_EMAIL'] ?? $_ENV['admin_email'] ?? 'hamzasheikh1228@gmail.com';
            
            logWebhook('Using admin email', ['admin_email' => $admin_email]);
            
            // Find the chat for this deal (based on seller and channel)
            $chatStmt = $pdo->prepare("
                SELECT c.id as chat_id FROM chats c
                INNER JOIN chat_participants cp1 ON c.id = cp1.chatId
                INNER JOIN chat_participants cp2 ON c.id = cp2.chatId
                WHERE c.type = 'ad_inquiry'
                AND cp1.userId = ? AND cp1.isActive = 1
                AND cp2.userId = ? AND cp2.isActive = 1
                AND cp1.chatId = cp2.chatId
                LIMIT 1
            ");
            $chatStmt->execute([$deal['buyer_id'], $deal['seller_id']]);
            $chat = $chatStmt->fetch(PDO::FETCH_ASSOC);
            
            logWebhook('Chat search result', [
                'buyer_id' => $deal['buyer_id'],
                'seller_id' => $deal['seller_id'],
                'chat_found' => !empty($chat),
                'chat_id' => $chat['chat_id'] ?? 'none'
            ]);
            
            if ($chat) {
                // Send automatic message with agent email
                $message_content = "🎉 Great news! The cryptocurrency payment has been confirmed and your deal is now proceeding to the next step.\n\n📧 **Agent Email for Account Rights**: {$admin_email}\n\nPlease add this email as a manager/collaborator to your account so our agent can verify everything and facilitate the secure transfer. Once you've given rights to this email, please confirm below.\n\n⚠️ **Important**: Only give manager/collaborator access, NOT ownership. Our agent will handle the ownership transfer securely.";
                
                // Insert system message
                $messageStmt = $pdo->prepare("
                    INSERT INTO messages (chatId, senderId, content, messageType, isRead, createdAt, updatedAt)
                    VALUES (?, 1, ?, 'system', 0, NOW(), NOW())
                ");
                $messageStmt->execute([$chat['chat_id'], $message_content]);
                
                // Update chat last message
                $chatUpdateStmt = $pdo->prepare("
                    UPDATE chats SET lastMessage = ?, lastMessageTime = NOW(), updatedAt = NOW()
                    WHERE id = ?
                ");
                $chatUpdateStmt->execute(['System: Agent email provided for account access', $chat['chat_id']]);
                
                logWebhook('✅ Agent email message sent to chat', ['chat_id' => $chat['chat_id']]);
            } else {
                logWebhook('⚠️ No chat found for this deal - agent email will still be marked as sent');
            }
            
            // ALWAYS update deal with agent email sent status (even if chat not found)
            $agentEmailStmt = $pdo->prepare("
                UPDATE deals 
                SET agent_email_sent = TRUE,
                    agent_email_sent_at = NOW(),
                    deal_status = 'agent_access_pending',
                    updated_at = NOW()
                WHERE id = ?
            ");
            $agentEmailResult = $agentEmailStmt->execute([$dealId]);
            
            logWebhook('Agent email status update', [
                'deal_id' => $dealId,
                'update_success' => $agentEmailResult,
                'rows_affected' => $agentEmailStmt->rowCount()
            ]);
            
            // Add history record for agent email sent
            $agentHistoryStmt = $pdo->prepare("
                INSERT INTO deal_history (deal_id, action_type, action_by, action_description, created_at)
                VALUES (?, 'agent_email_sent', 1, ?, NOW())
            ");
            $agent_email_description = "Agent email ({$admin_email}) sent to seller for account access via webhook";
            $agentHistoryResult = $agentHistoryStmt->execute([$dealId, $agent_email_description]);
            
            logWebhook('Agent email history update', [
                'deal_id' => $dealId,
                'history_success' => $agentHistoryResult
            ]);
            
            logWebhook('✅ Agent email process completed', [
                'deal_status_updated' => $agentEmailResult,
                'chat_message_sent' => !empty($chat)
            ]);
            
        } catch (Exception $e) {
            logWebhook('❌ Error in agent email process', ['error' => $e->getMessage()]);
            
            // Even if there's an error, try to mark as sent to avoid blocking the deal
            try {
                $fallbackStmt = $pdo->prepare("
                    UPDATE deals 
                    SET agent_email_sent = TRUE,
                        agent_email_sent_at = NOW(),
                        updated_at = NOW()
                    WHERE id = ?
                ");
                $fallbackStmt->execute([$dealId]);
                logWebhook('✅ Fallback: Agent email marked as sent despite error');
            } catch (Exception $fallbackError) {
                logWebhook('❌ Fallback failed too', ['error' => $fallbackError->getMessage()]);
            }
        }
        
    } else {
        logWebhook('❌ Could not find deal after update', ['deal_id' => $dealId]);
    }
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
