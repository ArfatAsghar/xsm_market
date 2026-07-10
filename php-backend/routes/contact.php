<?php
// Contact form handler
$input = json_decode(file_get_contents('php://input'), true);

$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$subject = trim($input['subject'] ?? '');
$message = trim($input['message'] ?? '');

// Validation
if (!$name || !$email || !$subject || !$message) {
    Response::error('All fields are required', 400);
}

if (!Validation::isValidEmail($email)) {
    Response::error('Please provide a valid email address', 400);
}

try {
    // Send email to admin
    $adminEmail = getenv('ADMIN_EMAIL') ?: 'admin@xsmmarket.com';
    
    $emailSubject = "Contact Form: $subject";
    $emailMessage = "
    <html>
    <body>
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> $name</p>
        <p><strong>Email:</strong> $email</p>
        <p><strong>Subject:</strong> $subject</p>
        <p><strong>Message:</strong></p>
        <div style='border: 1px solid #ccc; padding: 10px; margin: 10px 0;'>
            " . nl2br(htmlspecialchars($message)) . "
        </div>
        <p><small>Sent from XSM Market contact form</small></p>
    </body>
    </html>
    ";
    
    $headers = [
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: XSM Market <noreply@xsmmarket.com>',
        'Reply-To: ' . $email
    ];
    
    $emailSent = mail($adminEmail, $emailSubject, $emailMessage, implode("\r\n", $headers));
    
    if ($emailSent) {
        error_log("Contact form submitted by: $email");
        Response::success(['message' => 'Your message has been sent successfully. We will get back to you soon!']);
    } else {
        error_log("Failed to send contact form email from: $email");
        Response::error('Failed to send message. Please try again later.', 500);
    }
    
} catch (Exception $e) {
    error_log('Contact form error: ' . $e->getMessage());
    Response::error('Server error. Please try again later.', 500);
}
?>
