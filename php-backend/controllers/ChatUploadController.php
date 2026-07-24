<?php
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class ChatUploadController {
    private $db;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }
    
    public function uploadFile() {
        try {
            error_log("ChatUploadController: Starting upload process");
            
            // Check authentication
            error_log("ChatUploadController: Checking authentication");
            $user = AuthMiddleware::authenticate();
            if (!$user) {
                error_log("ChatUploadController: Authentication failed");
                Response::error('Unauthorized', 401);
                return;
            }
            error_log("ChatUploadController: User authenticated: " . $user['id']);
            
            // Get chat ID from URL
            $chatId = intval($_GET['chatId'] ?? 0);
            error_log("ChatUploadController: Chat ID: " . $chatId);
            if (!$chatId) {
                Response::error('Chat ID is required', 400);
                return;
            }
            
            // Verify user is participant in this chat
            if (!$this->isUserInChat($user['id'], $chatId)) {
                Response::error('Access denied to this chat', 403);
                return;
            }
            
            // Check if file was uploaded
            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                Response::error('No file uploaded or upload error', 400);
                return;
            }
            
            $file = $_FILES['file'];
            $messageType = $_POST['messageType'] ?? 'file';
            
            // Validate file size (50MB max)
            $maxSize = 50 * 1024 * 1024; // 50MB
            if ($file['size'] > $maxSize) {
                Response::error('File size exceeds maximum limit of 50MB', 400);
                return;
            }
            
            // Validate file types
            $allowedTypes = [
                'image' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                'video' => [
                    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm',
                    'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 
                    'video/3gpp', 'video/x-flv', 'video/x-ms-asf'
                ],
                'file' => [] // Allow all file types for general files
            ];
            
            if ($messageType !== 'file' && isset($allowedTypes[$messageType])) {
                error_log("ChatUploadController: File type: " . $file['type'] . ", Message type: " . $messageType);
                if (!in_array($file['type'], $allowedTypes[$messageType])) {
                    error_log("ChatUploadController: Rejected file type: " . $file['type'] . " for message type: " . $messageType);
                    Response::error("Invalid file type for $messageType. Received: " . $file['type'], 400);
                    return;
                }
            }
            
            // Create upload directory if it doesn't exist
            $uploadDir = __DIR__ . '/../uploads/chat/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            // Generate unique filename
            $fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
            $fileName = uniqid() . '_' . time() . '.' . $fileExtension;
            $filePath = $uploadDir . $fileName;
            
            // Move uploaded file
            if (!move_uploaded_file($file['tmp_name'], $filePath)) {
                Response::error('Failed to save uploaded file', 500);
                return;
            }
            
            // Generate thumbnail for images
            $thumbnail = null;
            if ($messageType === 'image') {
                $thumbnail = $this->generateThumbnail($filePath, $uploadDir);
            }
            
            // Save message to database
            // Files are stored in /api/uploads/chat/ on the server
            $mediaUrl = '/api/uploads/chat/' . $fileName;
            $content = $_POST['content'] ?? '';
            
            $stmt = $this->db->prepare("
                INSERT INTO messages (chatId, senderId, content, messageType, mediaUrl, fileName, fileSize, thumbnail, createdAt, updatedAt) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");
            
            $stmt->execute([
                $chatId,
                $user['id'],
                $content,
                $messageType,
                $mediaUrl,
                $file['name'],
                $file['size'],
                $thumbnail
            ]);
            
            $messageId = $this->db->lastInsertId();
            
            // Get the complete message with sender info
            $adminEmail = getenv('ADMIN_EMAIL');
            $stmt = $this->db->prepare("
                SELECT m.*, u.username, u.fullName, u.email, u.isAdmin 
                FROM messages m 
                JOIN users u ON m.senderId = u.id 
                WHERE m.id = ?
            ");
            $stmt->execute([$messageId]);
            $message = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($message) {
                $message['sender'] = [
                    'id' => $message['senderId'],
                    'username' => $message['username'],
                    'fullName' => $message['fullName'],
                    'email' => $message['email'],
                    'isAdmin' => (!empty($message['isAdmin']) || ($adminEmail && strtolower($message['email'] ?? '') === strtolower($adminEmail)))
                ];
                
                // Remove duplicate fields
                unset($message['username'], $message['fullName'], $message['email'], $message['isAdmin']);
                
                // Convert to proper types
                $message['id'] = intval($message['id']);
                $message['chatId'] = intval($message['chatId']);
                $message['fileSize'] = $message['fileSize'] ? intval($message['fileSize']) : null;
                $message['isRead'] = (bool)$message['isRead'];
            }
            
            Response::success($message);
            
        } catch (Exception $e) {
            error_log('Chat upload error: ' . $e->getMessage());
            Response::error('Failed to upload file', 500);
        }
    }
    
    private function isUserInChat($userId, $chatId) {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as count 
            FROM chat_participants 
            WHERE userId = ? AND chatId = ?
        ");
        $stmt->execute([$userId, $chatId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['count'] > 0;
    }
    
    private function generateThumbnail($imagePath, $uploadDir) {
        try {
            // Create thumbnail (150x150 max)
            $thumbnailName = 'thumb_' . basename($imagePath);
            $thumbnailPath = $uploadDir . $thumbnailName;
            
            $imageInfo = getimagesize($imagePath);
            if (!$imageInfo) {
                return null;
            }
            
            $imageType = $imageInfo[2];
            $sourceImage = null;
            
            switch ($imageType) {
                case IMAGETYPE_JPEG:
                    $sourceImage = imagecreatefromjpeg($imagePath);
                    break;
                case IMAGETYPE_PNG:
                    $sourceImage = imagecreatefrompng($imagePath);
                    break;
                case IMAGETYPE_GIF:
                    $sourceImage = imagecreatefromgif($imagePath);
                    break;
                default:
                    return null;
            }
            
            if (!$sourceImage) {
                return null;
            }
            
            $sourceWidth = imagesx($sourceImage);
            $sourceHeight = imagesy($sourceImage);
            
            // Calculate thumbnail dimensions
            $maxSize = 150;
            if ($sourceWidth > $sourceHeight) {
                $thumbnailWidth = $maxSize;
                $thumbnailHeight = intval(($sourceHeight * $maxSize) / $sourceWidth);
            } else {
                $thumbnailHeight = $maxSize;
                $thumbnailWidth = intval(($sourceWidth * $maxSize) / $sourceHeight);
            }
            
            $thumbnailImage = imagecreatetruecolor($thumbnailWidth, $thumbnailHeight);
            
            // Preserve transparency for PNG and GIF
            if ($imageType == IMAGETYPE_PNG || $imageType == IMAGETYPE_GIF) {
                imagealphablending($thumbnailImage, false);
                imagesavealpha($thumbnailImage, true);
                $transparent = imagecolorallocatealpha($thumbnailImage, 255, 255, 255, 127);
                imagefill($thumbnailImage, 0, 0, $transparent);
            }
            
            imagecopyresampled(
                $thumbnailImage, $sourceImage,
                0, 0, 0, 0,
                $thumbnailWidth, $thumbnailHeight,
                $sourceWidth, $sourceHeight
            );
            
            // Save thumbnail
            switch ($imageType) {
                case IMAGETYPE_JPEG:
                    imagejpeg($thumbnailImage, $thumbnailPath, 85);
                    break;
                case IMAGETYPE_PNG:
                    imagepng($thumbnailImage, $thumbnailPath);
                    break;
                case IMAGETYPE_GIF:
                    imagegif($thumbnailImage, $thumbnailPath);
                    break;
            }
            
            imagedestroy($sourceImage);
            imagedestroy($thumbnailImage);
            
            // Files are stored in /api/uploads/chat/ on the server
            return '/api/uploads/chat/' . $thumbnailName;
            
        } catch (Exception $e) {
            error_log('Thumbnail generation error: ' . $e->getMessage());
            return null;
        }
    }
}
?>
