<?php
require_once __DIR__ . '/../utils/EmailService.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validation.php';

class ContactController {
    
    // Handle contact form submission
    public function submit() {
        try {
            $input = json_decode(file_get_contents('php://input'), true);
            
            $name = trim($input['name'] ?? '');
            $email = trim($input['email'] ?? '');
            $subject = trim($input['subject'] ?? '');
            $category = trim($input['category'] ?? '');
            $message = trim($input['message'] ?? '');
            
            // Validate required fields
            if (!$name || !$email || !$subject || !$category || !$message) {
                Response::error('All fields are required', 400, ['success' => false]);
                return;
            }
            
            // Validate email format
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                Response::error('Invalid email format', 400, ['success' => false]);
                return;
            }
            
            // Validate category
            $validCategories = [
                'General Inquiry',
                'Technical Support',
                'Account Issues',
                'Transaction Support',
                'Report a Problem',
                'Partnership Inquiry',
                'Press/Media',
                'Other'
            ];
            
            if (!in_array($category, $validCategories)) {
                Response::error('Invalid category', 400, ['success' => false]);
                return;
            }
            
            // Check message length
            if (strlen($message) < 10) {
                Response::error('Message must be at least 10 characters long', 400, ['success' => false]);
                return;
            }
            
            if (strlen($message) > 2000) {
                Response::error('Message cannot exceed 2000 characters', 400, ['success' => false]);
                return;
            }
            
            $formData = [
                'name' => $name,
                'email' => $email,
                'subject' => $subject,
                'category' => $category,
                'message' => $message
            ];
            
            // Check if email service is configured
            try {
                $emailService = new EmailService();
            } catch (Exception $e) {
                error_log('Email service not configured: ' . $e->getMessage());
                Response::error('Email service is temporarily unavailable. Please try again later.', 500, ['success' => false]);
                return;
            }
            
            // Send notification to admin
            try {
                $this->sendContactNotification($formData);
                error_log("✅ Contact form notification sent for: $email");
            } catch (Exception $e) {
                error_log('Failed to send contact notification: ' . $e->getMessage());
                Response::error('Failed to send your message. Please try again later.', 500, ['success' => false]);
                return;
            }
            
            // Send auto-reply to user (don't fail if this doesn't work)
            try {
                $this->sendContactAutoReply($formData);
                error_log("✅ Contact auto-reply sent to: $email");
            } catch (Exception $e) {
                error_log('Failed to send auto-reply, but continuing... ' . $e->getMessage());
            }
            
            Response::success([
                'success' => true,
                'message' => 'Your message has been sent successfully! We will get back to you soon.'
            ]);
            
        } catch (Exception $e) {
            error_log('Contact form submission error: ' . $e->getMessage());
            Response::error('An error occurred while processing your request. Please try again later.', 500, [
                'success' => false
            ]);
        }
    }
    
    // Check if contact service is available
    public function status() {
        try {
            $emailService = new EmailService();
            Response::success([
                'success' => true,
                'available' => true,
                'message' => 'Contact service is available'
            ]);
        } catch (Exception $e) {
            Response::success([
                'success' => true,
                'available' => false,
                'message' => 'Contact service is temporarily unavailable'
            ]);
        }
    }
    
    // Send contact form notification to admin
    private function sendContactNotification($formData) {
        $emailService = new EmailService();
        
        $name = $formData['name'];
        $email = $formData['email'];
        $subject = $formData['subject'];
        $category = $formData['category'];
        $message = $formData['message'];
        
        $adminEmail = getenv('GMAIL_USER');
        $emailSubject = "[XSM Market Contact] $category: $subject";
        
        $emailBody = "
        <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;\">
          <div style=\"background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);\">
            <div style=\"text-align: center; margin-bottom: 30px;\">
              <h1 style=\"color: #FFD700; font-size: 2.5rem; margin-bottom: 10px;\">XSM Market</h1>
              <h2 style=\"color: #333; margin-bottom: 10px;\">New Contact Form Submission</h2>
            </div>
            
            <div style=\"background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;\">
              <h3 style=\"color: #FFD700; margin-top: 0;\">Contact Details:</h3>
              <table style=\"width: 100%; border-collapse: collapse;\">
                <tr>
                  <td style=\"padding: 8px 0; font-weight: bold; color: #333; width: 30%;\">Name:</td>
                  <td style=\"padding: 8px 0; color: #666;\">$name</td>
                </tr>
                <tr>
                  <td style=\"padding: 8px 0; font-weight: bold; color: #333;\">Email:</td>
                  <td style=\"padding: 8px 0; color: #666;\">$email</td>
                </tr>
                <tr>
                  <td style=\"padding: 8px 0; font-weight: bold; color: #333;\">Category:</td>
                  <td style=\"padding: 8px 0; color: #666;\">$category</td>
                </tr>
                <tr>
                  <td style=\"padding: 8px 0; font-weight: bold; color: #333;\">Subject:</td>
                  <td style=\"padding: 8px 0; color: #666;\">$subject</td>
                </tr>
              </table>
            </div>
            
            <div style=\"background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;\">
              <h3 style=\"color: #FFD700; margin-top: 0;\">Message:</h3>
              <p style=\"color: #333; white-space: pre-wrap; margin: 0;\">" . htmlspecialchars($message) . "</p>
            </div>
            
            <div style=\"background-color: #fffbf0; border: 1px solid #FFD700; padding: 15px; border-radius: 8px; margin: 20px 0;\">
              <p style=\"margin: 0; color: #333;\">
                <strong>Reply to:</strong> $email<br>
                <strong>Submitted at:</strong> " . date('Y-m-d H:i:s') . "
              </p>
            </div>
          </div>
        </div>
        ";
        
        return $emailService->sendEmail($adminEmail, $emailSubject, $emailBody);
    }
    
    // Send auto-reply to user
    private function sendContactAutoReply($formData) {
        $emailService = new EmailService();
        
        $name = $formData['name'];
        $email = $formData['email'];
        $subject = $formData['subject'];
        $category = $formData['category'];
        
        // Determine response time based on category
        $responseTime = 'within 24 hours';
        switch ($category) {
            case 'Technical Support':
                $responseTime = 'within 4-8 hours';
                break;
            case 'Transaction Support':
                $responseTime = 'within 2 hours';
                break;
            case 'Account Issues':
                $responseTime = 'within 4-8 hours';
                break;
        }
        
        $emailSubject = "Re: $subject - We received your message";
        
        $emailBody = "
        <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;\">
          <div style=\"background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.1);\">
            <div style=\"text-align: center; margin-bottom: 30px;\">
              <h1 style=\"color: #FFD700; font-size: 2.5rem; margin-bottom: 10px;\">XSM Market</h1>
              <h2 style=\"color: #333; margin-bottom: 10px;\">Thank You for Contacting Us!</h2>
            </div>
            
            <p style=\"color: #333;\">Hello $name,</p>
            
            <p style=\"color: #333;\">
              Thank you for reaching out to us. We have received your message and will respond $responseTime.
            </p>
            
            <div style=\"background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;\">
              <h3 style=\"color: #FFD700; margin-top: 0;\">Your Message Details:</h3>
              <p style=\"margin: 5px 0; color: #666;\"><strong>Category:</strong> $category</p>
              <p style=\"margin: 5px 0; color: #666;\"><strong>Subject:</strong> $subject</p>
              <p style=\"margin: 5px 0; color: #666;\"><strong>Submitted:</strong> " . date('Y-m-d H:i:s') . "</p>
            </div>
            
            <div style=\"background-color: #fffbf0; border: 1px solid #FFD700; padding: 15px; border-radius: 8px; margin: 20px 0;\">
              <h4 style=\"color: #333; margin-top: 0;\">Expected Response Time:</h4>
              <ul style=\"margin: 10px 0; color: #666;\">
                <li>General inquiries: Within 24 hours</li>
                <li>Technical support: Within 4-8 hours</li>
                <li>Transaction issues: Within 2 hours</li>
                <li>Account issues: Within 4-8 hours</li>
              </ul>
            </div>
            
            <p style=\"color: #333;\">
              In the meantime, you can check our FAQ section or browse our help center for immediate assistance.
            </p>
            
            <div style=\"text-align: center; margin: 30px 0;\">
              <p style=\"color: #666; margin: 0;\">
                Best regards,<br>
                The XSM Market Support Team
              </p>
            </div>
          </div>
        </div>
        ";
        
        return $emailService->sendEmail($email, $emailSubject, $emailBody);
    }
}
?>
