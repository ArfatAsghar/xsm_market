<?php
// Include PHPMailer manually if available
if (file_exists(__DIR__ . '/../vendor/phpmailer/src/PHPMailer.php')) {
    require_once __DIR__ . '/../vendor/phpmailer/src/PHPMailer.php';
    require_once __DIR__ . '/../vendor/phpmailer/src/SMTP.php';
    require_once __DIR__ . '/../vendor/phpmailer/src/Exception.php';
}

// EmailService - Converted from Node.js emailService to maintain identical functionality
class EmailService {
    private $smtpHost;
    private $smtpPort;
    private $smtpUser;
    private $smtpPassword;
    
    public function __construct() {
        // Load environment from .env file if not loaded
        if (!getenv('GMAIL_USER') && file_exists(__DIR__ . '/../.env')) {
            $envFile = __DIR__ . '/../.env';
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
                    list($key, $value) = explode('=', $line, 2);
                    putenv(trim($key) . '=' . trim($value));
                }
            }
        }
        
        $this->smtpHost = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
        $this->smtpPort = getenv('SMTP_PORT') ?: 587;
        $this->smtpUser = getenv('GMAIL_USER') ?: '';
        $this->smtpPassword = getenv('GMAIL_APP_PASSWORD') ?: '';
        
        // Debug log for email configuration
        error_log('Email Service Config - User: ' . $this->smtpUser . ', Host: ' . $this->smtpHost);
    }
    
    // Send OTP email - identical to Node.js sendOTPEmail function
    public function sendOTPEmail($email, $otp, $username) {
        try {
            error_log("Attempting to send OTP email to: $email with OTP: $otp");
            
            // Check environment - in development, we still want to send real emails
            $phpEnv = getenv('PHP_ENV') ?: $_ENV['PHP_ENV'] ?? $_SERVER['PHP_ENV'] ?? 'production';
            error_log("EMAIL SENDING MODE: $phpEnv - Will attempt to send real email");
            
            $subject = 'XSM Market - Email Verification';
            $htmlBody = $this->getOTPEmailTemplate($otp, $username);
            $textBody = "Hello $username,\n\nYour verification code is: $otp\n\nThis code expires in 10 minutes.\n\nBest regards,\nXSM Market Team";
            
            // Enhanced logging for production debugging
            error_log("PRODUCTION MODE: Attempting real email send to $email");
            error_log("SMTP Config - Host: {$this->smtpHost}, Port: {$this->smtpPort}, User: {$this->smtpUser}");
            
            $result = $this->sendEmail($email, $subject, $htmlBody, $textBody);
            
            if ($result) {
                error_log("✅ OTP Email sent successfully to: $email");
            } else {
                error_log("❌ OTP Email failed to send to: $email");
                // In production, if email fails, still return true but log the OTP for manual verification
                error_log("🚨 PRODUCTION EMAIL FAILED - Manual OTP for $email: $otp");
            }
            
            return $result;
            
        } catch (Exception $e) {
            error_log('❌ Exception in sendOTPEmail: ' . $e->getMessage());
            error_log('🚨 PRODUCTION EMAIL EXCEPTION - Manual OTP for ' . $email . ': ' . $otp);
            return false;
        }
    }
    
    // Send welcome email - identical to Node.js sendWelcomeEmail function
    public function sendWelcomeEmail($email, $username) {
        try {
            $subject = 'Welcome to XSM Market!';
            $htmlBody = $this->getWelcomeEmailTemplate($username);
            $textBody = "Hello $username,\n\nWelcome to XSM Market! Your account has been successfully verified.\n\nYou can now start buying and selling social media accounts.\n\nBest regards,\nXSM Market Team";
            
            return $this->sendEmail($email, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log('Failed to send welcome email: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send password reset email - identical to Node.js functionality
    public function sendPasswordResetEmail($email, $resetToken) {
        try {
            $resetUrl = ($_ENV['FRONTEND_URL'] ?? 'http://localhost:5173') . '/reset-password?token=' . $resetToken;
            $subject = 'XSM Market - Password Reset';
            $htmlBody = $this->getPasswordResetEmailTemplate($resetUrl);
            $textBody = "You requested a password reset.\n\nClick the link below to reset your password:\n$resetUrl\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nXSM Market Team";
            
            return $this->sendEmail($email, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log('Failed to send password reset email: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send contact form email
    public function sendContactEmail($contactData) {
        try {
            $adminEmail = $_ENV['ADMIN_EMAIL'] ?? $_ENV['GMAIL_USER'];
            $subject = 'XSM Market - Contact Form: ' . $contactData['subject'];
            
            $htmlBody = $this->getContactEmailTemplate($contactData);
            $textBody = "New contact form submission:\n\nName: {$contactData['name']}\nEmail: {$contactData['email']}\nSubject: {$contactData['subject']}\n\nMessage:\n{$contactData['message']}";
            
            return $this->sendEmail($adminEmail, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log('Failed to send contact email: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send temporary password email - new method for forgot password functionality
    public function sendTemporaryPasswordEmail($email, $temporaryPassword, $username) {
        try {
            error_log("Attempting to send temporary password email to: $email");
            
            $subject = 'XSM Market - Temporary Password';
            $htmlBody = $this->getTemporaryPasswordEmailTemplate($temporaryPassword, $username);
            $textBody = "Hello $username,\n\nYour temporary password is: $temporaryPassword\n\nPlease use this password to log in to your account. You can change this password later in your profile settings.\n\nFor security reasons, we recommend changing this password as soon as possible.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($email, $subject, $htmlBody, $textBody);
            error_log("Temporary password email send result: " . ($result ? 'SUCCESS' : 'FAILED'));
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send temporary password email: ' . $e->getMessage());
            return false;
        }
    }

    // Send ban notification email
    public function sendBanEmail($email, $username, $reason, $duration, $banExpires) {
        try {
            $isPermanent = ($duration === 'permanent' || !$banExpires);
            $subject = 'Account Status Update - XSM Market';
            
            $durationText = $isPermanent 
                ? 'Permanently Banned' 
                : 'Temporarily Suspended until ' . date('F j, Y g:i A T', strtotime($banExpires));

            $reasonText = !empty($reason) ? htmlspecialchars($reason) : 'Violation of platform terms and conditions.';

            $htmlBody = '
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: Arial, sans-serif; background-color: #121212; color: #ffffff; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #1e1e1e; border-radius: 12px; padding: 30px; border: 1px solid #333;">
                <div style="text-align: center; margin-bottom: 20px;">
                  <h1 style="color: #ffd000; margin: 0; font-size: 24px;">XSM Market</h1>
                  <p style="color: #888; font-size: 13px; margin-top: 4px;">Account Status Notification</p>
                </div>
                
                <h2 style="color: #ef4444; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 10px;">
                  Account Restriction Notice
                </h2>
                
                <p>Hello <strong>' . htmlspecialchars($username) . '</strong>,</p>
                
                <p>This email is to notify you that your account on <strong>XSM Market</strong> has been restricted.</p>
                
                <div style="background-color: #2a1515; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #fff;"><strong>Restriction Type:</strong> <span style="color: #f87171;">' . htmlspecialchars($durationText) . '</span></p>
                  <p style="margin: 0; font-size: 14px; color: #fff;"><strong>Reason:</strong> ' . $reasonText . '</p>
                </div>
                
                ' . ($isPermanent ? 
                  '<p style="color: #bbb; font-size: 13px;">Since your ban is permanent, access to buying, selling, and marketplace transactions has been revoked.</p>' : 
                  '<p style="color: #bbb; font-size: 13px;">Your account access will automatically be restored on <strong>' . date('F j, Y g:i A T', strtotime($banExpires)) . '</strong>.</p>'
                ) . '
                
                <p style="color: #bbb; font-size: 13px;">If you believe this action was taken in error or wish to submit an appeal, you may contact platform administrators using the support chat.</p>
                
                <hr style="border: none; border-top: 1px solid #333; margin: 25px 0;">
                <p style="color: #666; font-size: 11px; text-align: center;">&copy; ' . date('Y') . ' XSM Market. All rights reserved.</p>
              </div>
            </body>
            </html>';

            $textBody = "Hello $username,\n\nYour XSM Market account status has been updated.\n\nRestriction Type: $durationText\nReason: $reasonText\n\nIf you have any questions or wish to appeal, please contact Support through the platform chat.\n\nBest regards,\nXSM Market Team";

            return $this->sendEmail($email, $subject, $htmlBody, $textBody);
        } catch (Exception $e) {
            error_log('Failed to send ban email: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send email change verification - new method for email change functionality
    public function sendEmailChangeVerification($newEmail, $otp, $username, $verificationToken) {
        try {
            $subject = 'XSM Market - Verify Your New Email Address';
            $htmlBody = $this->getEmailChangeVerificationTemplate($otp, $username, $verificationToken);
            $textBody = "Hello $username,\n\nYou requested to change your email address on XSM Market.\n\nYour verification code is: $otp\n\nThis code expires in 15 minutes.\n\nIf you didn't request this change, please ignore this email.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($newEmail, $subject, $htmlBody, $textBody);
            
            return $result;
            
        } catch (Exception $e) {
            return false;
        }
    }
    
    // Send email change notification to old email - new method for email change functionality
    public function sendEmailChangeNotification($oldEmail, $newEmail, $username) {
        try {
            error_log("Sending email change notification to old email: $oldEmail");
            
            $subject = 'XSM Market - Email Address Changed';
            $htmlBody = $this->getEmailChangeNotificationTemplate($oldEmail, $newEmail, $username);
            $textBody = "Hello $username,\n\nYour email address on XSM Market has been successfully changed.\n\nOld email: $oldEmail\nNew email: $newEmail\n\nIf you didn't make this change, please contact our support team immediately.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($oldEmail, $subject, $htmlBody, $textBody);
            error_log("Email change notification send result: " . ($result ? 'SUCCESS' : 'FAILED'));
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send email change notification: ' . $e->getMessage());
            return false;
        }
    }
    
    // NEW DUAL VERIFICATION METHODS
    
    // Send verification to CURRENT email - Step 1 of dual verification
    public function sendCurrentEmailVerification($currentEmail, $otp, $username, $newEmail) {
        try {
            $subject = 'XSM Market - Verify Current Email for Address Change';
            $htmlBody = $this->getCurrentEmailVerificationTemplate($otp, $username, $newEmail);
            $textBody = "Hello $username,\n\nYou requested to change your email address on XSM Market to: $newEmail\n\nTo verify that you own this current email address, please enter this verification code: $otp\n\nThis code expires in 15 minutes.\n\nAfter verifying this email, you'll receive another verification code at your new email address.\n\nIf you didn't request this change, please ignore this email.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($currentEmail, $subject, $htmlBody, $textBody);
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send current email verification: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send verification to NEW email - Step 2 of dual verification
    public function sendNewEmailVerification($newEmail, $otp, $username) {
        try {
            $subject = 'XSM Market - Verify Your New Email Address';
            $htmlBody = $this->getNewEmailVerificationTemplate($otp, $username);
            $textBody = "Hello $username,\n\nYour current email has been verified! Now please verify ownership of this new email address.\n\nYour verification code is: $otp\n\nThis code expires in 15 minutes.\n\nOnce you enter this code, your email address will be successfully changed.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($newEmail, $subject, $htmlBody, $textBody);
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send new email verification: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send final confirmation to NEW email after successful change
    public function sendEmailChangeConfirmation($newEmail, $username) {
        try {
            $subject = 'XSM Market - Email Address Successfully Changed';
            $htmlBody = $this->getEmailChangeConfirmationTemplate($username);
            $textBody = "Hello $username,\n\nGreat news! Your email address on XSM Market has been successfully changed.\n\nYou can now use this email address to log into your account.\n\nFor your security, we recommend updating your browser's saved passwords if needed.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($newEmail, $subject, $htmlBody, $textBody);
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send email change confirmation: ' . $e->getMessage());
            return false;
        }
    }
    
    // Send password change verification - new method for secure password change
    public function sendPasswordChangeVerification($email, $otp, $username, $verificationToken, $isGoogleUser = false) {
        try {
            $subject = $isGoogleUser ? 'XSM Market - Set Your Password' : 'XSM Market - Verify Password Change';
            $htmlBody = $this->getPasswordChangeVerificationTemplate($otp, $username, $verificationToken, $isGoogleUser);
            $textBody = $isGoogleUser 
                ? "Hello $username,\n\nYou are setting a password for your XSM Market account.\n\nYour verification code is: $otp\n\nThis code expires in 15 minutes.\n\nBest regards,\nXSM Market Team"
                : "Hello $username,\n\nYou requested to change your password on XSM Market.\n\nYour verification code is: $otp\n\nThis code expires in 15 minutes.\n\nIf you didn't request this change, please ignore this email.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($email, $subject, $htmlBody, $textBody);
            
            return $result;
            
        } catch (Exception $e) {
            return false;
        }
    }
    
    // Send password change notification - new method for password change confirmation
    public function sendPasswordChangeNotification($email, $username, $isGoogleUser = false) {
        try {
            error_log("Sending password change notification to: $email");
            
            $subject = $isGoogleUser ? 'XSM Market - Password Set Successfully' : 'XSM Market - Password Changed';
            $htmlBody = $this->getPasswordChangeNotificationTemplate($username, $isGoogleUser);
            $textBody = $isGoogleUser
                ? "Hello $username,\n\nYou have successfully set a password for your XSM Market account.\n\nYou can now login using both Google sign-in and email/password.\n\nBest regards,\nXSM Market Team"
                : "Hello $username,\n\nYour password on XSM Market has been successfully changed.\n\nIf you didn't make this change, please contact our support team immediately.\n\nBest regards,\nXSM Market Team";
            
            $result = $this->sendEmail($email, $subject, $htmlBody, $textBody);
            error_log("Password change notification send result: " . ($result ? 'SUCCESS' : 'FAILED'));
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send password change notification: ' . $e->getMessage());
            return false;
        }
    }

    // ─── NEW MESSAGE NOTIFICATION EMAIL ────────────────────────────────────────
    // Sent to recipient when someone sends them a personal chat message
    public function sendNewMessageEmail($toEmail, $toUsername, $senderName, $preview, $chatLink = '/chat') {
        try {
            $subject = "💬 New message from $senderName — XSM Market";
            $previewEscaped = htmlspecialchars(mb_strimwidth($preview, 0, 120, '…'));
            $htmlBody = $this->getBaseEmailTemplate(
                "New Message",
                "💬",
                "You have a new message!",
                "Hi <strong>$toUsername</strong>,<br><br>
                <strong>$senderName</strong> sent you a message on XSM Market:",
                "<div style=\"background:#1a1a1a;border-left:3px solid #ffd000;padding:14px 18px;border-radius:6px;margin:16px 0;color:#d1d5db;font-style:italic;font-size:14px;\">
                    \"$previewEscaped\"
                </div>",
                "Open Inbox",
                "https://xsmmarket.com$chatLink",
                "Reply promptly to keep the conversation going."
            );
            $textBody = "Hi $toUsername,\n\n$senderName sent you a message:\n\"$preview\"\n\nOpen your inbox: https://xsmmarket.com$chatLink\n\nBest regards,\nXSM Market Team";
            return $this->sendEmail($toEmail, $subject, $htmlBody, $textBody);
        } catch (Exception $e) {
            error_log('Failed to send new message email: ' . $e->getMessage());
            return false;
        }
    }

    // ─── ADMIN / AGENT MESSAGE EMAIL ───────────────────────────────────────────
    // Sent to user when admin/manager sends a message from the Admin Dashboard
    public function sendAdminMessageEmail($toEmail, $toUsername, $agentName, $preview) {
        try {
            $subject = "📬 Message from XSM Market Support — $agentName";
            $previewEscaped = htmlspecialchars(mb_strimwidth($preview, 0, 120, '…'));
            $htmlBody = $this->getBaseEmailTemplate(
                "Support Message",
                "📬",
                "A message from our support team",
                "Hi <strong>$toUsername</strong>,<br><br>
                <strong>$agentName</strong> from XSM Market has sent you a message:",
                "<div style=\"background:#1a1a1a;border-left:3px solid #ffd000;padding:14px 18px;border-radius:6px;margin:16px 0;color:#d1d5db;font-size:14px;\">
                    \"$previewEscaped\"
                </div>",
                "View in Inbox",
                "https://xsmmarket.com/chat",
                "This is an official message from the XSM Market support team."
            );
            $textBody = "Hi $toUsername,\n\n$agentName from XSM Market Support sent you a message:\n\"$preview\"\n\nView it here: https://xsmmarket.com/chat\n\nBest regards,\nXSM Market Team";
            return $this->sendEmail($toEmail, $subject, $htmlBody, $textBody);
        } catch (Exception $e) {
            error_log('Failed to send admin message email: ' . $e->getMessage());
            return false;
        }
    }

    // ─── DEAL STAGE EMAIL ──────────────────────────────────────────────────────
    // Sent to buyer/seller at each of the 11 deal stages
    public function sendDealStageEmail($toEmail, $toUsername, $dealStage, $txnId, $channelTitle, $role = 'buyer') {
        try {
            $roleLabel = $role === 'seller' ? 'Seller' : 'Buyer';
            $txnIdEscaped = htmlspecialchars($txnId);
            $channelEscaped = htmlspecialchars($channelTitle);

            $stageInfo = $this->getDealStageInfo($dealStage, $role);
            if (!$stageInfo) return false; // Unknown stage, skip

            $subject = "🤝 Deal Update [{$txnIdEscaped}]: {$stageInfo['title']} — XSM Market";

            $txnBadge = "<div style=\"display:inline-block;background:#ffd000;color:#000;font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px;margin-bottom:16px;letter-spacing:0.5px;\">
                Transaction ID: {$txnIdEscaped}
            </div>";

            $htmlBody = $this->getBaseEmailTemplate(
                "Deal Update",
                $stageInfo['emoji'],
                $stageInfo['title'],
                "Hi <strong>$toUsername</strong> ($roleLabel),<br><br>
                Your deal for <strong>$channelEscaped</strong> has been updated.",
                "$txnBadge
                <div style=\"background:#1a1a1a;border-left:3px solid #ffd000;padding:14px 18px;border-radius:6px;margin:16px 0;color:#d1d5db;font-size:14px;\">
                    {$stageInfo['description']}
                </div>",
                "View Deal",
                "https://xsmmarket.com/" . ($role === 'seller' ? 'seller-deals' : 'my-deals'),
                "Keep an eye on your deal progress in your dashboard."
            );
            $textBody = "Hi $toUsername,\n\nDeal Update [{$txnIdEscaped}] — {$stageInfo['title']}\n\nChannel: $channelTitle\n{$stageInfo['descriptionText']}\n\nView your deal: https://xsmmarket.com/" . ($role === 'seller' ? 'seller-deals' : 'my-deals') . "\n\nBest regards,\nXSM Market Team";
            return $this->sendEmail($toEmail, $subject, $htmlBody, $textBody);
        } catch (Exception $e) {
            error_log('Failed to send deal stage email: ' . $e->getMessage());
            return false;
        }
    }

    // Helper: Returns title, emoji, description for each deal stage
    private function getDealStageInfo($stage, $role = 'buyer') {
        $stages = [
            'pending' => [
                'emoji' => '🆕',
                'title' => 'New Deal Request',
                'description' => 'A new deal request has been submitted. Both parties must review and agree to the terms before the deal proceeds.',
                'descriptionText' => 'A new deal request has been submitted. Both parties must agree to terms before proceeding.'
            ],
            'terms_agreed' => [
                'emoji' => '✅',
                'title' => 'Both Parties Agreed to Terms',
                'description' => 'Great news! Both buyer and seller have agreed to the deal terms. The next step is initiating the payment process.',
                'descriptionText' => 'Both buyer and seller have agreed to the deal terms. Awaiting payment initiation.'
            ],
            'payment_pending' => [
                'emoji' => '⏳',
                'title' => 'Payment Processing Initiated',
                'description' => 'The payment process has been initiated. The buyer is in the process of completing the transaction fee payment.',
                'descriptionText' => 'Payment processing has been initiated. The buyer is completing the transaction fee.'
            ],
            'fee_paid' => [
                'emoji' => '💳',
                'title' => 'Transaction Fee Paid',
                'description' => 'The transaction fee has been successfully paid. The agent email will be sent to the seller to provide account access credentials.',
                'descriptionText' => 'The transaction fee has been paid. Agent access will be coordinated next.'
            ],
            'agent_access_pending' => [
                'emoji' => '📧',
                'title' => 'Agent Email Sent to Seller',
                'description' => 'The XSM Market agent email has been sent to the seller. The seller should provide account access credentials to this email.',
                'descriptionText' => 'Agent email has been sent. The seller should provide account access to the agent email.'
            ],
            'agent_access_confirmed' => [
                'emoji' => '🔑',
                'title' => 'Account Access Confirmed',
                'description' => 'Account access has been confirmed by the buyer. The deal is now progressing to the next stage.',
                'descriptionText' => 'Account access has been confirmed. The deal is progressing.'
            ],
            'waiting_promotion_timer' => [
                'emoji' => '⏱️',
                'title' => 'Promotion Timer Running',
                'description' => 'The account is being verified during the promotion period. Please wait for the timer to complete before the next step.',
                'descriptionText' => 'The account is in the promotion verification period. Please wait.'
            ],
            'promotion_timer_complete' => [
                'emoji' => '🎯',
                'title' => 'Promotion Period Complete',
                'description' => 'The promotion verification period has completed successfully! The buyer can now proceed with the payment to the seller.',
                'descriptionText' => 'The promotion period has ended. The buyer can now proceed with payment to seller.'
            ],
            'buyer_paid_seller' => [
                'emoji' => '💰',
                'title' => 'Payment Sent to Seller',
                'description' => 'The buyer has made payment to the seller. The seller should confirm receipt of the payment to complete the transaction.',
                'descriptionText' => 'Payment has been sent to the seller. The seller must confirm receipt.'
            ],
            'seller_confirmed_payment' => [
                'emoji' => '👍',
                'title' => 'Seller Confirmed Payment Receipt',
                'description' => 'The seller has confirmed receiving the payment. The admin will now review and complete the transaction.',
                'descriptionText' => 'Seller has confirmed payment receipt. Admin review is pending.'
            ],
            'payment_confirmed' => [
                'emoji' => '🏆',
                'title' => 'Transaction Confirmed by Admin',
                'description' => 'The XSM Market admin has confirmed the transaction. The deal is now being finalized.',
                'descriptionText' => 'Admin has confirmed the transaction. Finalizing deal.'
            ],
            'completed' => [
                'emoji' => '🎉',
                'title' => 'Transaction Completed!',
                'description' => 'Congratulations! The deal has been completed successfully. Thank you for using XSM Market. We hope to see you again!',
                'descriptionText' => 'The deal has been completed successfully! Thank you for using XSM Market.'
            ],
        ];
        return $stages[$stage] ?? null;
    }

    // ─── BASE EMAIL TEMPLATE ──────────────────────────────────────────────────
    // Shared premium branded template for all XSM Market emails
    private function getBaseEmailTemplate($type, $emoji, $heading, $intro, $bodyContent, $ctaText, $ctaUrl, $footer = '') {
        return "<!DOCTYPE html>
<html lang=\"en\">
<head>
<meta charset=\"UTF-8\">
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
<title>$heading — XSM Market</title>
</head>
<body style=\"margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Helvetica,Arial,sans-serif;\">
<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#0a0a0a;padding:40px 20px;\">
<tr><td align=\"center\">
<table width=\"580\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:580px;width:100%;background:#111111;border-radius:16px;overflow:hidden;border:1px solid rgba(255,208,0,0.15);box-shadow:0 20px 60px rgba(0,0,0,0.8);\">
  <!-- Header -->
  <tr><td style=\"background:linear-gradient(135deg,#1a1500 0%,#0a0a0a 50%,#1a1500 100%);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(255,208,0,0.2);\">
    <div style=\"font-size:40px;margin-bottom:12px;\">$emoji</div>
    <img src=\"https://xsmmarket.com/images/logo.png\" alt=\"XSM Market\" style=\"height:36px;max-width:160px;object-fit:contain;\" onerror=\"this.style.display='none'\">
    <div style=\"color:#ffd000;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:8px;\">$type</div>
  </td></tr>
  <!-- Body -->
  <tr><td style=\"padding:36px 40px;\">
    <h1 style=\"color:#ffffff;font-size:22px;font-weight:700;margin:0 0 20px 0;line-height:1.3;\">$heading</h1>
    <p style=\"color:#a0a0a0;font-size:15px;line-height:1.7;margin:0 0 20px 0;\">$intro</p>
    $bodyContent
    <div style=\"text-align:center;margin:32px 0 24px;\">
      <a href=\"$ctaUrl\" style=\"display:inline-block;background:#ffd000;color:#000000;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;\">$ctaText →</a>
    </div>
    " . ($footer ? "<p style=\"color:#555555;font-size:13px;line-height:1.6;margin:0;\">$footer</p>" : "") . "
  </td></tr>
  <!-- Footer -->
  <tr><td style=\"background:#0d0d0d;padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;\">
    <p style=\"color:#3d3d3d;font-size:12px;margin:0 0 6px;\">© 2025 XSM Market. All rights reserved.</p>
    <p style=\"color:#2d2d2d;font-size:11px;margin:0;\">You received this email because of account activity on XSM Market.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>";
    }

    // Core email sending function - made public for use by other controllers
    public function sendEmail($to, $subject, $htmlBody, $textBody = '') {
        try {
            // Check email method availability
            $hasCredentials = getenv('GMAIL_USER') && getenv('GMAIL_APP_PASSWORD');
            $phpEnv = getenv('PHP_ENV') ?: 'production';
            
            error_log("📧 SendEmail called - To: $to, Env: $phpEnv, HasCredentials: " . ($hasCredentials ? 'YES' : 'NO'));
            
            // In development mode, try to send real emails and always return true for auth to work
            if ($phpEnv === 'development') {
                error_log("🔧 Development mode - attempting to send real email");
                
                if ($hasCredentials) {
                    // Try PHPMailer first
                    if (class_exists('PHPMailer\PHPMailer\PHPMailer') || class_exists('PHPMailer')) {
                        error_log("🔧 Trying PHPMailer in development...");
                        $result = $this->sendWithPHPMailer($to, $subject, $htmlBody, $textBody);
                        if ($result) {
                            error_log("✅ PHPMailer succeeded in development");
                            return true;
                        }
                    }
                    
                    // Try direct SMTP
                    error_log("🔧 Trying direct SMTP in development...");
                    $result = $this->sendWithDirectSMTP($to, $subject, $htmlBody, $textBody);
                    if ($result) {
                        error_log("✅ Direct SMTP succeeded in development");
                        return true;
                    }
                }
                
                // In development, even if email fails, log it and return true so auth works
                error_log("⚠️ Real email failed in development, using mock but returning success");
                $this->sendMockEmail($to, $subject, $htmlBody, $textBody);
                return true; // Always return true in development mode
            }
            
            // Production mode - try all methods
            if ($hasCredentials) {
                // Use PHPMailer if available, otherwise try direct SMTP
                if (class_exists('PHPMailer\PHPMailer\PHPMailer') || class_exists('PHPMailer')) {
                    error_log("🔧 Trying PHPMailer...");
                    $result = $this->sendWithPHPMailer($to, $subject, $htmlBody, $textBody);
                    if ($result) {
                        error_log("✅ PHPMailer succeeded");
                        return true;
                    } else {
                        error_log("❌ PHPMailer failed, trying direct SMTP...");
                    }
                } else {
                    error_log("⚠️ PHPMailer not available, trying direct SMTP...");
                }
                
                // Try direct SMTP as fallback
                $result = $this->sendWithDirectSMTP($to, $subject, $htmlBody, $textBody);
                if ($result) {
                    error_log("✅ Direct SMTP succeeded");
                    return true;
                } else {
                    error_log("❌ Direct SMTP failed");
                }
                
                // Try native PHP mail() as last resort in production
                error_log("🔧 Trying native PHP mail() as last resort...");
                $result = $this->sendWithNativeMail($to, $subject, $htmlBody, $textBody);
                if ($result) {
                    error_log("✅ Native PHP mail() succeeded");
                    return true;
                } else {
                    error_log("❌ Native PHP mail() failed");
                }
            } else {
                error_log("❌ No email credentials available");
            }
            
            // Fallback to mock email if real sending fails or no credentials
            error_log("📝 Falling back to mock email");
            return $this->sendMockEmail($to, $subject, $htmlBody, $textBody);
            
        } catch (Exception $e) {
            error_log("❌ Exception in sendEmail: " . $e->getMessage());
            // Fallback to mock email in case of error
            return $this->sendMockEmail($to, $subject, $htmlBody, $textBody);
        }
    }
    
    // Mock email sending for development
    private function sendMockEmail($to, $subject, $htmlBody, $textBody = '') {
        // Extract OTP from email content for development
        $otp = '';
        if (preg_match('/\b(\d{6})\b/', $htmlBody, $matches)) {
            $otp = $matches[1];
        } elseif (preg_match('/\b(\d{6})\b/', $textBody, $matches)) {
            $otp = $matches[1];
        }
        
        // Save email to a log file for development purposes
        $logFile = __DIR__ . '/../logs/mock-emails.log';
        $logDir = dirname($logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        $logContent = "\n" . str_repeat("=", 80) . "\n";
        $logContent .= "📧 MOCK EMAIL - " . date('Y-m-d H:i:s') . "\n";
        $logContent .= str_repeat("=", 80) . "\n";
        $logContent .= "To: $to\n";
        $logContent .= "Subject: $subject\n";
        if ($otp) {
            $logContent .= "🔢 OTP CODE: $otp\n";
            $logContent .= str_repeat("-", 40) . "\n";
        }
        $logContent .= "HTML Body:\n" . $htmlBody . "\n";
        $logContent .= str_repeat("=", 80) . "\n\n";
        
        file_put_contents($logFile, $logContent, FILE_APPEND | LOCK_EX);
        
        return true; // Always return true in development
    }
    
    // Send with PHPMailer (preferred method)
    private function sendWithPHPMailer($to, $subject, $htmlBody, $textBody) {
        // Support both namespaced and non-namespaced PHPMailer
        if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
            $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        } else {
            $mail = new PHPMailer(true);
        }
        
        try {
            // Server settings
            $mail->isSMTP();
            $mail->Host = $this->smtpHost;
            $mail->SMTPAuth = true;
            $mail->Username = $this->smtpUser;
            $mail->Password = $this->smtpPassword;
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port = $this->smtpPort;
            
            // Recipients
            $mail->setFrom($this->smtpUser, 'XSM Market');
            $mail->addAddress($to);
            
            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $htmlBody;
            if ($textBody) {
                $mail->AltBody = $textBody;
            }
            
            $mail->send();
            return true;
            
        } catch (Exception $e) {
            return false;
        }
    }
    
    // Direct SMTP sending without PHPMailer
    private function sendWithSMTP($to, $subject, $htmlBody, $textBody = '') {
        try {
            error_log("Attempting direct SMTP connection to {$this->smtpHost}:{$this->smtpPort}");
            
            // Create socket connection
            $socket = fsockopen($this->smtpHost, $this->smtpPort, $errno, $errstr, 30);
            if (!$socket) {
                error_log("SMTP Connection failed: $errstr ($errno)");
                return false;
            }
            
            // Read initial response
            $response = fgets($socket, 512);
            error_log("SMTP Initial: " . trim($response));
            
            // EHLO
            fputs($socket, "EHLO localhost\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP EHLO: " . trim($response));
            
            // STARTTLS
            fputs($socket, "STARTTLS\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP STARTTLS: " . trim($response));
            
            // Upgrade to TLS
            if (stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                error_log("TLS encryption enabled");
            } else {
                error_log("TLS encryption failed");
                fclose($socket);
                return false;
            }
            
            // EHLO again after TLS
            fputs($socket, "EHLO localhost\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP EHLO after TLS: " . trim($response));
            
            // AUTH LOGIN
            fputs($socket, "AUTH LOGIN\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP AUTH: " . trim($response));
            
            // Send username
            fputs($socket, base64_encode($this->smtpUser) . "\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP Username: " . trim($response));
            
            // Send password
            fputs($socket, base64_encode($this->smtpPassword) . "\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP Password: " . trim($response));
            
            if (strpos($response, '235') === false) {
                error_log("SMTP Authentication failed");
                fclose($socket);
                return false;
            }
            
            // MAIL FROM
            fputs($socket, "MAIL FROM: <{$this->smtpUser}>\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP MAIL FROM: " . trim($response));
            
            // RCPT TO
            fputs($socket, "RCPT TO: <$to>\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP RCPT TO: " . trim($response));
            
            // DATA
            fputs($socket, "DATA\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP DATA: " . trim($response));
            
            // Email headers and body
            $email_data = "From: XSM Market <{$this->smtpUser}>\r\n";
            $email_data .= "To: $to\r\n";
            $email_data .= "Subject: $subject\r\n";
            $email_data .= "MIME-Version: 1.0\r\n";
            $email_data .= "Content-Type: text/html; charset=UTF-8\r\n";
            $email_data .= "\r\n";
            $email_data .= $htmlBody;
            $email_data .= "\r\n.\r\n";
            
            fputs($socket, $email_data);
            $response = fgets($socket, 512);
            error_log("SMTP Send: " . trim($response));
            
            // QUIT
            fputs($socket, "QUIT\r\n");
            $response = fgets($socket, 512);
            error_log("SMTP QUIT: " . trim($response));
            
            fclose($socket);
            
            if (strpos($response, '250') !== false) {
                error_log("Email sent successfully via SMTP");
                return true;
            } else {
                error_log("Email sending failed");
                return false;
            }
            
        } catch (Exception $e) {
            error_log('SMTP sending error: ' . $e->getMessage());
            return false;
        }
    }
    
    // Fallback to PHP mail()
    private function sendWithPHPMail($to, $subject, $htmlBody) {
        error_log("Attempting to send email via PHP mail() to: $to");
        error_log("From email: {$this->smtpUser}");
        
        if (empty($this->smtpUser)) {
            error_log("ERROR: GMAIL_USER not configured");
            return false;
        }
        
        $headers = "MIME-Version: 1.0" . "\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
        $headers .= "From: XSM Market <{$this->smtpUser}>" . "\r\n";
        $headers .= "Reply-To: {$this->smtpUser}" . "\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        
        $result = mail($to, $subject, $htmlBody, $headers);
        error_log("PHP mail() result: " . ($result ? 'SUCCESS' : 'FAILED'));
        
        if (!$result) {
            error_log("PHP mail() failed. Check server mail configuration.");
        }
        
        return $result;
    }
    
    // Email templates
    private function getOTPEmailTemplate($otp, $username) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Email Verification</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #333; margin-bottom: 20px;'>Email Verification</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>Thank you for registering with XSM Market! To complete your registration, please verify your email address using the verification code below:</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <div style='background-color: #007bff; color: white; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 3px; display: inline-block;'>
                $otp
            </div>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>This verification code expires in <strong>10 minutes</strong>.</p>
        
        <p style='color: #555; margin-bottom: 20px;'>If you didn't request this verification, please ignore this email.</p>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team
        </p>
    </div>
</body>
</html>";
    }
    
    private function getWelcomeEmailTemplate($username) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Welcome to XSM Market</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #28a745; margin-bottom: 20px;'>Welcome!</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>Welcome to XSM Market! Your account has been successfully verified and you're now ready to start buying and selling social media accounts.</p>
        
        <div style='background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;'>
            <h3 style='color: #333; margin-top: 0;'>What you can do now:</h3>
            <ul style='color: #555; margin: 0; padding-left: 20px;'>
                <li>Browse available social media accounts</li>
                <li>List your own accounts for sale</li>
                <li>Chat with buyers and sellers</li>
                <li>Manage your profile and preferences</li>
            </ul>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>If you have any questions or need assistance, feel free to contact our support team.</p>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team
        </p>
    </div>
</body>
</html>";
    }
    
    private function getPasswordResetEmailTemplate($resetUrl) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Password Reset</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #dc3545; margin-bottom: 20px;'>Password Reset Request</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>You requested a password reset for your XSM Market account.</p>
        
        <p style='color: #555; margin-bottom: 20px;'>Click the button below to reset your password:</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <a href='$resetUrl' style='background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;'>Reset Password</a>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>This link expires in <strong>15 minutes</strong>.</p>
        
        <p style='color: #555; margin-bottom: 20px;'>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team
        </p>
    </div>
</body>
</html>";
    }
    
    private function getTemporaryPasswordEmailTemplate($temporaryPassword, $username) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Temporary Password</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #ffc107; margin-bottom: 20px;'>Temporary Password</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>We've generated a temporary password for your XSM Market account as requested. You can use this password to log in to your account:</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <div style='background-color: #ffc107; color: #212529; padding: 15px 30px; border-radius: 5px; font-size: 20px; font-weight: bold; letter-spacing: 2px; display: inline-block; font-family: monospace;'>
                $temporaryPassword
            </div>
        </div>
        
        <div style='background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: #856404; margin: 0; font-weight: bold;'>⚠️ Important Security Notice:</p>
            <p style='color: #856404; margin: 10px 0 0 0;'>For your security, we strongly recommend changing this password immediately after logging in. You can update your password in your profile settings.</p>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>If you didn't request a password reset, please contact our support team immediately.</p>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team
        </p>
    </div>
</body>
</html>";
    }
    
    private function getContactEmailTemplate($contactData) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Contact Form Submission</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <h2 style='color: #333; margin-bottom: 20px;'>New Contact Form Submission</h2>
        
        <div style='background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;'>
            <p><strong>Name:</strong> {$contactData['name']}</p>
            <p><strong>Email:</strong> {$contactData['email']}</p>
            <p><strong>Subject:</strong> {$contactData['subject']}</p>
        </div>
        
        <h3 style='color: #333;'>Message:</h3>
        <div style='background-color: #ffffff; border: 1px solid #ddd; padding: 15px; border-radius: 5px;'>
            <p style='margin: 0; white-space: pre-wrap;'>{$contactData['message']}</p>
        </div>
        
        <p style='color: #888; font-size: 14px; margin-top: 30px;'>
            Received at: " . date('Y-m-d H:i:s') . "
        </p>
    </div>
</body>
</html>";
    }
    
    private function getEmailChangeVerificationTemplate($otp, $username, $verificationToken) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Email Change Verification</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #17a2b8; margin-bottom: 20px;'>Verify Your New Email Address</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>You requested to change your email address on XSM Market. To complete this change, please verify your new email address using the verification code below:</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <div style='background-color: #17a2b8; color: white; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 3px; display: inline-block;'>
                $otp
            </div>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>This verification code expires in <strong>15 minutes</strong>.</p>
        
        <div style='background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: #0c5460; margin: 0; font-weight: bold;'>📧 Security Notice:</p>
            <p style='color: #0c5460; margin: 10px 0 0 0;'>If you didn't request this email change, please ignore this message. Your current email address will remain unchanged.</p>
        </div>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team
        </p>
    </div>
</body>
</html>";
    }
    
    private function getEmailChangeNotificationTemplate($oldEmail, $newEmail, $username) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Email Address Changed</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #28a745; margin-bottom: 20px;'>Email Address Successfully Changed</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>Your email address on XSM Market has been successfully changed.</p>
        
        <div style='background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: #333; margin: 0;'><strong>Previous email:</strong> $oldEmail</p>
            <p style='color: #333; margin: 10px 0 0 0;'><strong>New email:</strong> $newEmail</p>
        </div>
        
        <div style='background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: #721c24; margin: 0; font-weight: bold;'>🚨 Important Security Notice:</p>
            <p style='color: #721c24; margin: 10px 0 0 0;'>If you didn't make this change, please contact our support team immediately. Your account security may have been compromised.</p>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>All future communications will be sent to your new email address.</p>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team<br>
            Changed on: " . date('Y-m-d H:i:s') . "
        </p>
    </div>
</body>
</html>";
    }
    
    private function getPasswordChangeVerificationTemplate($otp, $username, $verificationToken, $isGoogleUser = false) {
        $title = $isGoogleUser ? 'Set Your Password' : 'Verify Password Change';
        $heading = $isGoogleUser ? 'Set Your Password' : 'Verify Password Change';
        $message = $isGoogleUser 
            ? 'You are setting a password for your XSM Market account. This will allow you to login with email/password in addition to Google sign-in.'
            : 'You requested to change your password on XSM Market. To complete this change, please verify using the code below:';
        $color = $isGoogleUser ? '#28a745' : '#ffc107';
        
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>$title</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: $color; margin-bottom: 20px;'>$heading</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>$message</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <div style='background-color: $color; color: " . ($isGoogleUser ? 'white' : '#212529') . "; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 3px; display: inline-block;'>
                $otp
            </div>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>This verification code expires in <strong>15 minutes</strong>.</p>
        
        <div style='background-color: " . ($isGoogleUser ? '#d4edda' : '#fff3cd') . "; border: 1px solid " . ($isGoogleUser ? '#c3e6cb' : '#ffeaa7') . "; padding: 15px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: " . ($isGoogleUser ? '#155724' : '#856404') . "; margin: 0; font-weight: bold;'>" . ($isGoogleUser ? '🔐' : '⚠️') . " Security Notice:</p>
            <p style='color: " . ($isGoogleUser ? '#155724' : '#856404') . "; margin: 10px 0 0 0;'>" . ($isGoogleUser 
                ? 'Setting a password will not affect your Google sign-in. You will be able to use both methods to access your account.'
                : 'If you didn\'t request this password change, please ignore this message and contact our support team if you have concerns.') . "</p>
        </div>
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team
        </p>
    </div>
</body>
</html>";
    }
    
    private function getPasswordChangeNotificationTemplate($username, $isGoogleUser = false) {
        $title = $isGoogleUser ? 'Password Set Successfully' : 'Password Changed';
        $heading = $isGoogleUser ? 'Password Set Successfully' : 'Password Changed Successfully';
        $message = $isGoogleUser
            ? 'You have successfully set a password for your XSM Market account. You can now login using both Google sign-in and email/password.'
            : 'Your password on XSM Market has been successfully changed.';
        $color = $isGoogleUser ? '#28a745' : '#17a2b8';
        
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>$title</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: $color; margin-bottom: 20px;'>$heading</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>$message</p>
        
        " . ($isGoogleUser ? "
        <div style='background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: #155724; margin: 0; font-weight: bold;'>🎉 Dual Login Available:</p>
            <p style='color: #155724; margin: 10px 0 0 0;'>You can now sign in using either:
                <br>• Google Sign-in (your original method)
                <br>• Email and Password (newly set)
            </p>
        </div>
        " : "
        <div style='background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0;'>
            <p style='color: #721c24; margin: 0; font-weight: bold;'>🚨 Important Security Notice:</p>
            <p style='color: #721c24; margin: 10px 0 0 0;'>If you didn't make this change, please contact our support team immediately. Your account security may have been compromised.</p>
        </div>
        ") . "
        
        <hr style='border: none; border-top: 1px solid #eee; margin: 30px 0;'>
        
        <p style='color: #888; font-size: 14px; margin: 0;'>
            Best regards,<br>
            The XSM Market Team<br>
            Changed on: " . date('Y-m-d H:i:s') . "
        </p>
    </div>
</body>
</html>";
    }

    // Direct SMTP implementation using PHP sockets (simpler and more reliable)
    private function sendWithDirectSMTP($to, $subject, $htmlBody, $textBody = '') {
        try {
            // Gmail SMTP settings
            $host = 'smtp.gmail.com';
            $port = 587;
            $username = $this->smtpUser;
            $password = $this->smtpPassword;
            $from = $this->smtpUser;
            
            if (empty($username) || empty($password)) {
                return false;
            }
            
            // Connect to Gmail SMTP
            $socket = fsockopen($host, $port, $errno, $errstr, 30);
            if (!$socket) {
                return false;
            }
            
            // Helper function to read SMTP response
            $readResponse = function() use ($socket) {
                $response = '';
                while ($line = fgets($socket, 515)) {
                    $response .= $line;
                    if (substr($line, 3, 1) == ' ') break;
                }
                return trim($response);
            };
            
            // Helper function to send SMTP command
            $sendCommand = function($command, $expected = '250') use ($socket, $readResponse) {
                fputs($socket, $command . "\r\n");
                $response = $readResponse();
                return strpos($response, $expected) === 0;
            };
            
            // Read greeting
            $greeting = $readResponse();
            error_log("SMTP Greeting: $greeting");
            
            if (!strpos($greeting, '220') === 0) {
                error_log("SMTP greeting failed");
                fclose($socket);
                return false;
            }
            
            // Send EHLO
            if (!$sendCommand("EHLO localhost", '250')) {
                error_log("EHLO failed");
                fclose($socket);
                return false;
            }
            
            // Start TLS
            if (!$sendCommand("STARTTLS", '220')) {
                error_log("STARTTLS failed");
                fclose($socket);
                return false;
            }
            
            // Enable encryption
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                error_log("TLS encryption failed");
                fclose($socket);
                return false;
            }
            
            // Send EHLO again after TLS
            if (!$sendCommand("EHLO localhost", '250')) {
                error_log("EHLO after TLS failed");
                fclose($socket);
                return false;
            }
            
            // Authenticate
            if (!$sendCommand("AUTH LOGIN", '334')) {
                error_log("AUTH LOGIN failed");
                fclose($socket);
                return false;
            }
            
            // Send username
            if (!$sendCommand(base64_encode($username), '334')) {
                error_log("Username authentication failed");
                fclose($socket);
                return false;
            }
            
            // Send password
            if (!$sendCommand(base64_encode($password), '235')) {
                error_log("Password authentication failed");
                fclose($socket);
                return false;
            }
            
            // Send MAIL FROM
            if (!$sendCommand("MAIL FROM: <$from>", '250')) {
                error_log("MAIL FROM failed");
                fclose($socket);
                return false;
            }
            
            // Send RCPT TO
            if (!$sendCommand("RCPT TO: <$to>", '250')) {
                error_log("RCPT TO failed");
                fclose($socket);
                return false;
            }
            
            // Send DATA
            if (!$sendCommand("DATA", '354')) {
                error_log("DATA command failed");
                fclose($socket);
                return false;
            }
            
            // Prepare email headers and body
            $headers = "From: XSM Market <$from>\r\n";
            $headers .= "To: $to\r\n";
            $headers .= "Subject: $subject\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: multipart/alternative; boundary=\"boundary123\"\r\n";
            $headers .= "\r\n";
            
            $emailBody = "--boundary123\r\n";
            $emailBody .= "Content-Type: text/plain; charset=UTF-8\r\n";
            $emailBody .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
            $emailBody .= ($textBody ?: strip_tags($htmlBody)) . "\r\n";
            $emailBody .= "--boundary123\r\n";
            $emailBody .= "Content-Type: text/html; charset=UTF-8\r\n";
            $emailBody .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
            $emailBody .= $htmlBody . "\r\n";
            $emailBody .= "--boundary123--\r\n";
            
            // Send email content
            fputs($socket, $headers . $emailBody . "\r\n.\r\n");
            $response = $readResponse();
            error_log("Email send response: $response");
            
            $success = strpos($response, '250') === 0;
            
            // Send QUIT
            $sendCommand("QUIT", '221');
            fclose($socket);
            
            if ($success) {
                error_log("✅ Email sent successfully to $to");
                return true;
            } else {
                error_log("❌ Email sending failed: $response");
                return false;
            }
            
        } catch (Exception $e) {
            error_log("Direct SMTP error: " . $e->getMessage());
            return false;
        }
    }
    
    // NEW EMAIL TEMPLATES FOR DUAL VERIFICATION
    
    private function getCurrentEmailVerificationTemplate($otp, $username, $newEmail) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Verify Current Email</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #17a2b8; margin-bottom: 20px;'>Verify Your Current Email (Step 1 of 2)</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>You requested to change your email address to: <strong>$newEmail</strong></p>
        
        <p style='color: #555; margin-bottom: 20px;'>First, we need to verify that you own this current email address. Please enter this verification code:</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <div style='display: inline-block; background-color: #17a2b8; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;'>
                $otp
            </div>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>After entering this code, you'll receive another verification code at your new email address.</p>
        
        <p style='color: #dc3545; margin-bottom: 20px; padding: 15px; background-color: #f8d7da; border-radius: 5px; border-left: 4px solid #dc3545;'>
            <strong>⚠️ Important:</strong> This code expires in 15 minutes.
        </p>
        
        <p style='color: #555; margin-bottom: 20px;'>If you didn't request this change, please ignore this email and your account will remain secure.</p>
        
        <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
            <p style='color: #888; font-size: 14px; margin: 0;'>Best regards,<br>The XSM Market Team</p>
        </div>
    </div>
</body>
</html>";
    }
    
    private function getNewEmailVerificationTemplate($otp, $username) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Verify New Email</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <h2 style='color: #28a745; margin-bottom: 20px;'>Verify Your New Email (Step 2 of 2)</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #28a745; margin-bottom: 20px;'>✅ Your current email has been verified successfully!</p>
        
        <p style='color: #555; margin-bottom: 20px;'>Now, please verify that you own this new email address by entering this verification code:</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <div style='display: inline-block; background-color: #28a745; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px;'>
                $otp
            </div>
        </div>
        
        <p style='color: #555; margin-bottom: 20px;'>Once you enter this code, your email address will be successfully changed and you can use this new email to log in.</p>
        
        <p style='color: #dc3545; margin-bottom: 20px; padding: 15px; background-color: #f8d7da; border-radius: 5px; border-left: 4px solid #dc3545;'>
            <strong>⚠️ Important:</strong> This code expires in 15 minutes.
        </p>
        
        <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
            <p style='color: #888; font-size: 14px; margin: 0;'>Best regards,<br>The XSM Market Team</p>
        </div>
    </div>
</body>
</html>";
    }
    
    // Native PHP mail() fallback for production environments
    private function sendWithNativeMail($to, $subject, $htmlBody, $textBody = '') {
        try {
            error_log("📧 Attempting native PHP mail() to: $to");
            
            // Set headers for HTML email
            $headers = "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
            $headers .= "From: XSM Market <{$this->smtpUser}>\r\n";
            $headers .= "Reply-To: {$this->smtpUser}\r\n";
            $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
            
            // Use HTML body or text body
            $body = $htmlBody ?: $textBody;
            
            // Send email using PHP's mail() function
            $result = mail($to, $subject, $body, $headers);
            
            if ($result) {
                error_log("✅ Native PHP mail() sent successfully to: $to");
                return true;
            } else {
                error_log("❌ Native PHP mail() failed for: $to");
                return false;
            }
            
        } catch (Exception $e) {
            error_log("❌ Native PHP mail() exception: " . $e->getMessage());
            return false;
        }
    }

    private function getEmailChangeConfirmationTemplate($username) {
        return "
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Email Changed Successfully</title>
</head>
<body style='font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);'>
        <div style='text-align: center; margin-bottom: 30px;'>
            <h1 style='color: #333; margin: 0;'>XSM Market</h1>
            <p style='color: #666; margin: 5px 0 0 0;'>Social Media Marketplace</p>
        </div>
        
        <div style='text-align: center; margin-bottom: 30px;'>
            <div style='display: inline-block; background-color: #28a745; color: white; padding: 20px; border-radius: 50%; font-size: 30px;'>
                ✅
            </div>
        </div>
        
        <h2 style='color: #28a745; margin-bottom: 20px; text-align: center;'>Email Address Successfully Changed!</h2>
        
        <p style='color: #555; margin-bottom: 20px;'>Hello <strong>$username</strong>,</p>
        
        <p style='color: #555; margin-bottom: 20px;'>Congratulations! Your email address on XSM Market has been successfully changed.</p>
        
        <p style='color: #555; margin-bottom: 20px;'>You can now use this new email address to:</p>
        
        <ul style='color: #555; margin-bottom: 20px; padding-left: 20px;'>
            <li>Log into your XSM Market account</li>
            <li>Receive important notifications</li>
            <li>Reset your password if needed</li>
        </ul>
        
        <p style='color: #555; margin-bottom: 20px;'>For your security, we recommend updating your browser's saved passwords with this new email address.</p>
        
        <div style='text-align: center; margin: 30px 0;'>
            <a href='#' style='display: inline-block; background-color: #17a2b8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Go to XSM Market</a>
        </div>
        
        <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;'>
            <p style='color: #888; font-size: 14px; margin: 0;'>Best regards,<br>The XSM Market Team</p>
        </div>
    </div>
</body>
</html>";
    }

    // Req 25: Send Important Account Update Email
    public function sendAccountUpdateEmail($toEmail, $toUsername, $updateTitle, $updateDetails) {
        try {
            $subject = "📢 Important Account Update: $updateTitle";
            $htmlBody = $this->getBaseEmailTemplate(
                "Account Update",
                "📢",
                $updateTitle,
                "Hi <strong>$toUsername</strong>,<br><br>" . htmlspecialchars($updateDetails),
                "",
                "Log In to Account",
                "https://xsmmarket.com/profile",
                "Review your account details in your dashboard."
            );
            $textBody = "Hi $toUsername,\n\nAccount Update: $updateTitle\n\n$updateDetails\n\nLog in: https://xsmmarket.com/profile\n\nBest regards,\nXSM Market Team";
            return $this->sendEmail($toEmail, $subject, $htmlBody, $textBody);
        } catch (Exception $e) {
            error_log("Failed to send account update email: " . $e->getMessage());
            return false;
        }
    }
}
