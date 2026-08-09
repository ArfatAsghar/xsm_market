<?php

require_once __DIR__ . '/SystemUser.php';

// Marks a deal's transaction fee as paid and runs the associated side effects
// (deal history, agent email chat message). Safe to call multiple times for
// the same deal - it is a no-op if the fee is already marked paid, so both
// the NOWPayments webhook and the status-polling endpoint can call it.
function markTransactionFeePaid($pdo, $dealId, $paymentId, $paymentInfo) {
    $dealStmt = $pdo->prepare("SELECT buyer_id, seller_id, transaction_fee_paid FROM deals WHERE id = ?");
    $dealStmt->execute([$dealId]);
    $deal = $dealStmt->fetch(PDO::FETCH_ASSOC);

    if (!$deal) {
        throw new Exception("Deal not found: $dealId");
    }

    if ($deal['transaction_fee_paid']) {
        // Already processed (e.g. by the webhook or a previous poll) - nothing to do.
        return false;
    }

    $buyerId = $deal['buyer_id'];

    $stmt = $pdo->prepare("
        UPDATE deals
        SET transaction_fee_paid = 1,
            transaction_fee_paid_at = NOW(),
            transaction_fee_payment_method = 'crypto',
            deal_status = 'fee_paid',
            updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->execute([$dealId]);

    $historyStmt = $pdo->prepare("
        INSERT INTO deal_history (deal_id, action_type, action_by, action_description, created_at)
        VALUES (?, 'fee_paid', ?, ?, NOW())
    ");
    $actuallyPaid = $paymentInfo['actually_paid'] ?? 'N/A';
    $payCurrency = $paymentInfo['pay_currency'] ?? 'N/A';
    $description = "Transaction fee paid via cryptocurrency. Payment ID: {$paymentId}. Amount: {$actuallyPaid} {$payCurrency}";
    $historyStmt->execute([$dealId, $buyerId, $description]);

    // Send agent email to seller via chat, same as the deal's normal flow
    try {
        $admin_email = $_ENV['ADMIN_EMAIL'] ?? $_ENV['admin_email'] ?? 'novaflowa4@gmail.com';

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

        if ($chat) {
            $message_content = "🎉 Great news! The cryptocurrency payment has been confirmed and your deal is now proceeding to the next step.\n\n📧 **Agent Email for Account Rights**: {$admin_email}\n\nPlease add this email as a manager/collaborator to your account so our agent can verify everything and facilitate the secure transfer. Once you've given rights to this email, please confirm below.\n\n⚠️ **Important**: Only give manager/collaborator access, NOT ownership. Our agent will handle the ownership transfer securely.";

            $messageStmt = $pdo->prepare("
                INSERT INTO messages (chatId, senderId, content, messageType, isRead, createdAt, updatedAt)
                VALUES (?, ?, ?, 'system', 0, NOW(), NOW())
            ");
            $messageStmt->execute([$chat['chat_id'], getSystemUserId($pdo), $message_content]);

            $chatUpdateStmt = $pdo->prepare("
                UPDATE chats SET lastMessage = ?, lastMessageTime = NOW(), updatedAt = NOW()
                WHERE id = ?
            ");
            $chatUpdateStmt->execute(['System: Agent email provided for account access', $chat['chat_id']]);
        }

        $agentEmailStmt = $pdo->prepare("
            UPDATE deals
            SET agent_email_sent = TRUE,
                agent_email_sent_at = NOW(),
                deal_status = 'agent_access_pending',
                updated_at = NOW()
            WHERE id = ?
        ");
        $agentEmailStmt->execute([$dealId]);

        $agentHistoryStmt = $pdo->prepare("
            INSERT INTO deal_history (deal_id, action_type, action_by, action_description, created_at)
            VALUES (?, 'agent_email_sent', 1, ?, NOW())
        ");
        $agent_email_description = "Agent email ({$admin_email}) sent to seller for account access";
        $agentHistoryStmt->execute([$dealId, $agent_email_description]);

    } catch (Exception $e) {
        error_log('Error in agent email process: ' . $e->getMessage());

        try {
            $fallbackStmt = $pdo->prepare("
                UPDATE deals
                SET agent_email_sent = TRUE,
                    agent_email_sent_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $fallbackStmt->execute([$dealId]);
        } catch (Exception $fallbackError) {
            error_log('Fallback agent email update failed: ' . $fallbackError->getMessage());
        }
    }

    return true;
}
