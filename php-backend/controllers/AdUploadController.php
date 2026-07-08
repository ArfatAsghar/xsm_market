<?php
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/auth.php';

class AdUploadController {
    private $db;
    private $authMiddleware;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->authMiddleware = new AuthMiddleware();
    }
    
    /**
     * Get the base URL for the API based on the current request
     * Works for both localhost development and production domains
     */
    private function getApiBaseUrl() {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'];
        
        // If we're in the /api/ directory, go up one level
        // The request comes to /api/uploads/screenshots but we want /uploads/ads
        return $protocol . $host;
    }
    
    public function uploadScreenshots() {
        try {
            error_log('=== UPLOAD SCREENSHOTS ENDPOINT HIT ===');
            error_log('Request method: ' . $_SERVER['REQUEST_METHOD']);
            error_log('Content type: ' . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));
            error_log('Request URI: ' . $_SERVER['REQUEST_URI']);
            error_log('Available _FILES keys: ' . implode(', ', array_keys($_FILES)));
            
            // Check authentication
            $user = $this->authMiddleware->authenticate();
            if (!$user) {
                error_log('Authentication failed');
                Response::error('Unauthorized', 401);
                return;
            }
            
            error_log('User authenticated: ' . json_encode(['id' => $user['id'], 'username' => $user['username']]));
            
            // Check if files were uploaded - handle screenshots[] format
            $files = null;
            $fileCount = 0;
            
            // Debug log the received files
            error_log('Received _FILES: ' . print_r($_FILES, true));
            error_log('Received _POST: ' . print_r($_POST, true));
            
            // Check for screenshots[] format first (multiple files)
            if (isset($_FILES['screenshots']) && is_array($_FILES['screenshots']['name'])) {
                $files = $_FILES['screenshots'];
                $fileCount = count($files['name']);
                error_log('Found screenshots[] format with ' . $fileCount . ' files');
            } 
            // Check for single screenshots format
            elseif (isset($_FILES['screenshots']) && !is_array($_FILES['screenshots']['name'])) {
                // Convert single file to array format for consistent processing
                $files = [
                    'name' => [$_FILES['screenshots']['name']],
                    'type' => [$_FILES['screenshots']['type']],
                    'tmp_name' => [$_FILES['screenshots']['tmp_name']],
                    'error' => [$_FILES['screenshots']['error']],
                    'size' => [$_FILES['screenshots']['size']]
                ];
                $fileCount = 1;
                error_log('Found single screenshots format, converted to array');
            } else {
                error_log('No screenshots found in _FILES. Available keys: ' . implode(', ', array_keys($_FILES)));
                Response::error('No screenshots uploaded', 400);
                return;
            }
            
            error_log('File count detected: ' . $fileCount);
            
            $uploadedFiles = [];
            
            // Validate file count (max 20 screenshots)
            if ($fileCount > 20) {
                Response::error('Maximum 20 screenshots allowed', 400);
                return;
            }
            
            // Create upload directory if it doesn't exist
            $uploadDir = __DIR__ . '/../uploads/ads/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            // Process each uploaded file
            for ($i = 0; $i < $fileCount; $i++) {
                // Check for upload errors
                if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                    Response::error("Upload error for file " . ($i + 1), 400);
                    return;
                }
                
                // Validate file size (10MB max per file)
                $maxSize = 10 * 1024 * 1024; // 10MB
                if ($files['size'][$i] > $maxSize) {
                    Response::error("File " . ($i + 1) . " exceeds maximum size of 10MB", 400);
                    return;
                }
                
                // Validate file type (images only)
                $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                $fileType = $files['type'][$i];
                if (!in_array($fileType, $allowedTypes)) {
                    Response::error("Invalid file type for file " . ($i + 1) . ". Only images are allowed.", 400);
                    return;
                }
                
                error_log("Processing file $i: {$files['name'][$i]}");
                error_log("File type: {$files['type'][$i]}");
                error_log("File size: {$files['size'][$i]}");
                error_log("Temp path: {$files['tmp_name'][$i]}");
                
                // Generate unique filename
                $fileExtension = pathinfo($files['name'][$i], PATHINFO_EXTENSION);
                $fileName = uniqid() . '_' . time() . '_' . $i . '.' . $fileExtension;
                $filePath = $uploadDir . $fileName;
                
                // Move uploaded file to permanent location
                if (!move_uploaded_file($files['tmp_name'][$i], $filePath)) {
                    error_log("Failed to move uploaded file from {$files['tmp_name'][$i]} to $filePath");
                    Response::error("Failed to save file " . ($i + 1), 500);
                    return;
                }
                
                error_log("Successfully moved file to: $filePath");
                
                // Generate URL for the file using correct domain
                // Files are stored in /api/uploads/ads/ on the server
$fileUrl = '/uploads/ads/' . $fileName;                               
                $uploadedFiles[] = [
                    'url' => $fileUrl,
                    'originalName' => $files['name'][$i],
                    'size' => $files['size'][$i],
                    'type' => $fileType
                ];
            }
            
            Response::success([
                'screenshots' => $uploadedFiles,
                'count' => count($uploadedFiles)
            ]);
            
            error_log('✅ Successfully uploaded ' . count($uploadedFiles) . ' screenshots');
            
        } catch (Exception $e) {
            error_log('Ad upload error: ' . $e->getMessage());
            Response::error('Failed to upload screenshots', 500);
        }
    }
    
    public function uploadThumbnail() {
        try {
            // Check authentication
            $user = $this->authMiddleware->authenticate();
            if (!$user) {
                Response::error('Unauthorized', 401);
                return;
            }
            
            // Check if file was uploaded
            if (!isset($_FILES['thumbnail']) || $_FILES['thumbnail']['error'] !== UPLOAD_ERR_OK) {
                Response::error('No thumbnail uploaded or upload error', 400);
                return;
            }
            
            $file = $_FILES['thumbnail'];
            
            // Validate file size (5MB max)
            $maxSize = 5 * 1024 * 1024; // 5MB
            if ($file['size'] > $maxSize) {
                Response::error('Thumbnail size exceeds maximum limit of 5MB', 400);
                return;
            }
            
            // Validate file type (images only)
            $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($file['type'], $allowedTypes)) {
                Response::error('Invalid file type. Only images are allowed.', 400);
                return;
            }
            
            // Read file and convert to base64
            $imageData = file_get_contents($file['tmp_name']);
            if ($imageData === false) {
                Response::error('Failed to read uploaded file', 500);
                return;
            }
            
            $base64Image = base64_encode($imageData);
            $dataUri = 'data:' . $file['type'] . ';base64,' . $base64Image;
            
            // Generate smaller thumbnail for display
            $smallThumbnail = $this->generateThumbnailFromBase64($dataUri, $file['type']);
            
            Response::success([
                'thumbnail' => $dataUri,
                'smallThumbnail' => $smallThumbnail,
                'originalName' => $file['name'],
                'size' => $file['size']
            ]);
            
        } catch (Exception $e) {
            error_log('Thumbnail upload error: ' . $e->getMessage());
            Response::error('Failed to upload thumbnail', 500);
        }
    }
}
?>
