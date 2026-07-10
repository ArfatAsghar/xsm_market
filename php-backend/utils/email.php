<?php
class EmailService {
    
    public static function sendOTPEmail($email, $otp, $username) {
        $subject = 'Verify Your Email - XSM Market';
        $message = "
        <html>
        <head>
            <title>Email Verification - XSM Market</title>
        </head>
        <body>
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <h2 style='color: #333;'>Welcome to XSM Market, $username!</h2>
                <p>Thank you for registering with XSM Market. To complete your registration, please verify your email address.</p>
                <div style='background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;'>
                    <h3 style='margin: 0; color: #007bff;'>Your Verification Code:</h3>
                    <h1 style='margin: 10px 0; font-size: 32px; letter-spacing: 5px; color: #333;'>$otp</h1>
                </div>
                <p>This verification code will expire in 15 minutes.</p>
                <p>If you didn't create an account with XSM Market, please ignore this email.</p>
                <hr style='margin: 30px 0;'>
                <p style='color: #666; font-size: 12px;'>
                    This is an automated email from XSM Market. Please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return self::sendEmail($email, $subject, $message);
    }
    
    public static function sendWelcomeEmail($email, $username) {
        $subject = 'Welcome to XSM Market!';
        $message = "
        <html>
        <head>
            <title>Welcome to XSM Market</title>
        </head>
        <body>
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <h2 style='color: #333;'>Welcome to XSM Market, $username!</h2>
                <p>Your email has been successfully verified and your account is now active.</p>
                <p>You can now:</p>
                <ul>
                    <li>Browse and purchase social media accounts</li>
                    <li>List your own accounts for sale</li>
                    <li>Chat with buyers and sellers</li>
                    <li>Manage your profile and listings</li>
                </ul>
                <p>Get started by exploring our marketplace!</p>
                <hr style='margin: 30px 0;'>
                <p style='color: #666; font-size: 12px;'>
                    This is an automated email from XSM Market. Please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return self::sendEmail($email, $subject, $message);
    }
    
    public static function sendPasswordResetEmail($email, $resetToken) {
        $resetUrl = getenv('FRONTEND_URL') . "/reset-password?token=$resetToken";
        
        $subject = 'Password Reset - XSM Market';
        $message = "
        <html>
        <head>
            <title>Password Reset - XSM Market</title>
        </head>
        <body>
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                <h2 style='color: #333;'>Password Reset Request</h2>
                <p>You have requested to reset your password for your XSM Market account.</p>
                <p>Click the button below to reset your password:</p>
                <div style='text-align: center; margin: 30px 0;'>
                    <a href='$resetUrl' style='background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;'>Reset Password</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style='word-break: break-all; color: #007bff;'>$resetUrl</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
                <hr style='margin: 30px 0;'>
                <p style='color: #666; font-size: 12px;'>
                    This is an automated email from XSM Market. Please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
        ";
        
        return self::sendEmail($email, $subject, $message);
    }
    
    private static function sendEmail($to, $subject, $message) {
        $headers = [
            'MIME-Version: 1.0',
            'Content-type: text/html; charset=UTF-8',
            'From: XSM Market <' . (getenv('GMAIL_USER') ?: 'noreply@xsmmarket.com') . '>',
            'Reply-To: noreply@xsmmarket.com',
            'X-Mailer: PHP/' . phpversion()
        ];
        
        try {
            // Try to use PHP's mail function first
            $result = mail($to, $subject, $message, implode("\r\n", $headers));
            
            if ($result) {
                error_log("Email sent successfully to: $to");
                return true;
            }
            
            // If mail() fails, try SMTP if credentials are available
            if (getenv('GMAIL_USER') && getenv('GMAIL_APP_PASSWORD')) {
                return self::sendSMTPEmail($to, $subject, $message);
            }
            
            error_log("Failed to send email to: $to");
            return false;
            
        } catch (Exception $e) {
            error_log("Email error: " . $e->getMessage());
            return false;
        }
    }
    
    private static function sendSMTPEmail($to, $subject, $message) {
        // Basic SMTP implementation
        // In production, you might want to use a library like PHPMailer
        
        $smtpHost = 'smtp.gmail.com';
        $smtpPort = 587;
        $smtpUser = getenv('GMAIL_USER');
        $smtpPass = getenv('GMAIL_APP_PASSWORD');
        
        try {
            $socket = fsockopen($smtpHost, $smtpPort, $errno, $errstr, 30);
            if (!$socket) {
                throw new Exception("Could not connect to SMTP server: $errstr ($errno)");
            }
            
            // Basic SMTP conversation
            fgets($socket, 512);
            fputs($socket, "EHLO localhost\r\n");
            fgets($socket, 512);
            
            fputs($socket, "STARTTLS\r\n");
            fgets($socket, 512);
            
            stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            
            fputs($socket, "EHLO localhost\r\n");
            fgets($socket, 512);
            
            fputs($socket, "AUTH LOGIN\r\n");
            fgets($socket, 512);
            
            fputs($socket, base64_encode($smtpUser) . "\r\n");
            fgets($socket, 512);
            
            fputs($socket, base64_encode($smtpPass) . "\r\n");
            fgets($socket, 512);
            
            fputs($socket, "MAIL FROM: <$smtpUser>\r\n");
            fgets($socket, 512);
            
            fputs($socket, "RCPT TO: <$to>\r\n");
            fgets($socket, 512);
            
            fputs($socket, "DATA\r\n");
            fgets($socket, 512);
            
            $headers = "MIME-Version: 1.0\r\n";
            $headers .= "Content-type: text/html; charset=UTF-8\r\n";
            $headers .= "From: XSM Market <$smtpUser>\r\n";
            $headers .= "To: $to\r\n";
            $headers .= "Subject: $subject\r\n\r\n";
            
            fputs($socket, $headers . $message . "\r\n.\r\n");
            fgets($socket, 512);
            
            fputs($socket, "QUIT\r\n");
            fclose($socket);
            
            error_log("SMTP email sent successfully to: $to");
            return true;
            
        } catch (Exception $e) {
            error_log("SMTP error: " . $e->getMessage());
            return false;
        }
    }
}
?>
