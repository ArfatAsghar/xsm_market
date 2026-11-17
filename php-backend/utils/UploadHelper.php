<?php
/**
 * UploadHelper - Dual-redundant storage and unified serving for user uploads.
 * 
 * Ensures uploaded media (ads, chat, kyc, avatars) is stored in both:
 * 1. api/uploads/<subfolder>/ (Backend internal upload store)
 * 2. uploads/<subfolder>/     (Root web public store)
 * 
 * Even if one folder is deleted during site updates or code extractions,
 * media remains safe in the mirror directory and is auto-synchronized.
 */
class UploadHelper {
    /**
     * Get candidate directories for upload storage and serving.
     */
    public static function getCandidateRoots() {
        $apiDir = dirname(__DIR__); // php-backend or /public_html/api
        $rootDir = dirname($apiDir); // root or /public_html

        return [
            rtrim($apiDir, '/\\') . '/uploads',
            rtrim($rootDir, '/\\') . '/uploads',
            rtrim($rootDir, '/\\') . '/public_html/uploads',
            rtrim($apiDir, '/\\') . '/public/uploads'
        ];
    }

    /**
     * Ensure all required upload subdirectories exist with proper permissions.
     */
    public static function ensureUploadDirectories($subfolder = '') {
        $roots = self::getCandidateRoots();
        $subfolders = $subfolder ? [$subfolder] : ['ads', 'chat', 'kyc', 'avatars', 'temp'];

        foreach ($roots as $root) {
            if (!is_dir($root)) {
                @mkdir($root, 0777, true);
            }
            @chmod($root, 0777);

            foreach ($subfolders as $sub) {
                $target = $root . '/' . trim($sub, '/\\');
                if (!is_dir($target)) {
                    @mkdir($target, 0777, true);
                }
                @chmod($target, 0777);
            }
        }
    }

    /**
     * Save an uploaded file with dual redundancy across api/uploads and root uploads.
     * 
     * @param string $tmpPath The PHP temporary file path ($_FILES['...']['tmp_name'])
     * @param string $subfolder Subfolder name ('ads', 'chat', 'kyc', 'avatars')
     * @param string $fileName Unique generated file name
     * @return bool True if saved successfully to at least one location
     */
    public static function saveUploadedFile($tmpPath, $subfolder, $fileName) {
        if (!file_exists($tmpPath)) {
            return false;
        }

        self::ensureUploadDirectories($subfolder);
        $roots = self::getCandidateRoots();
        $savedPaths = [];

        // 1. First move or copy from temp to primary root
        $primaryTarget = $roots[0] . '/' . trim($subfolder, '/\\') . '/' . $fileName;
        $primaryDir = dirname($primaryTarget);
        if (!is_dir($primaryDir)) {
            @mkdir($primaryDir, 0777, true);
        }

        $moved = false;
        if (is_uploaded_file($tmpPath)) {
            $moved = @move_uploaded_file($tmpPath, $primaryTarget);
        } else {
            $moved = @copy($tmpPath, $primaryTarget);
        }

        if ($moved) {
            @chmod($primaryTarget, 0644);
            $savedPaths[] = $primaryTarget;
        }

        // Source file for mirroring
        $sourcePath = $moved ? $primaryTarget : $tmpPath;

        // 2. Mirror to all other candidate roots (e.g. root uploads/)
        for ($i = 1; $i < count($roots); $i++) {
            $mirrorTarget = $roots[$i] . '/' . trim($subfolder, '/\\') . '/' . $fileName;
            $mirrorDir = dirname($mirrorTarget);
            if (!is_dir($mirrorDir)) {
                @mkdir($mirrorDir, 0777, true);
            }
            if (is_dir($mirrorDir)) {
                if (@copy($sourcePath, $mirrorTarget)) {
                    @chmod($mirrorTarget, 0644);
                    $savedPaths[] = $mirrorTarget;
                }
            }
        }

        return count($savedPaths) > 0;
    }

    /**
     * Save raw binary data (e.g. downloaded remote avatars) across upload roots.
     */
    public static function saveBinaryData($binaryData, $subfolder, $fileName) {
        if (empty($binaryData)) return false;
        self::ensureUploadDirectories($subfolder);
        $roots = self::getCandidateRoots();
        $saved = false;
        foreach ($roots as $root) {
            $destDir = $root . '/' . trim($subfolder, '/\\');
            if (!is_dir($destDir)) {
                @mkdir($destDir, 0777, true);
            }
            if (is_dir($destDir)) {
                $target = $destDir . '/' . $fileName;
                if (@file_put_contents($target, $binaryData) !== false) {
                    @chmod($target, 0644);
                    $saved = true;
                }
            }
        }
        return $saved;
    }

    /**
     * Mirror an existing file across all candidate upload roots.
     */
    public static function mirrorFile($sourceFile, $subfolder, $fileName) {
        if (!file_exists($sourceFile)) return;

        $roots = self::getCandidateRoots();
        foreach ($roots as $root) {
            $target = $root . '/' . trim($subfolder, '/\\') . '/' . $fileName;
            if ($target !== $sourceFile && !file_exists($target)) {
                $dir = dirname($target);
                if (!is_dir($dir)) @mkdir($dir, 0777, true);
                if (is_dir($dir)) {
                    @copy($sourceFile, $target);
                    @chmod($target, 0644);
                }
            }
        }
    }

    /**
     * Locate an uploaded file across all candidate storage roots.
     * If found in one root but missing in others, automatically re-syncs it.
     */
    public static function findUploadedFile($relPath) {
        $cleanPath = ltrim($relPath, '/\\');
        $cleanPath = str_replace(['../', '..\\', "\0"], '', $cleanPath);

        $roots = self::getCandidateRoots();
        $foundFile = null;
        $missingRoots = [];

        foreach ($roots as $root) {
            $fullPath = $root . '/' . $cleanPath;
            if (is_file($fullPath) && is_readable($fullPath)) {
                if (!$foundFile) {
                    $foundFile = $fullPath;
                }
            } else {
                $missingRoots[] = $root;
            }
        }

        // Self-healing: copy to any missing candidate roots
        if ($foundFile && count($missingRoots) > 0) {
            foreach ($missingRoots as $missingRoot) {
                $syncTarget = $missingRoot . '/' . $cleanPath;
                $syncDir = dirname($syncTarget);
                if (!is_dir($syncDir)) {
                    @mkdir($syncDir, 0777, true);
                }
                if (is_dir($syncDir)) {
                    @copy($foundFile, $syncTarget);
                    @chmod($syncTarget, 0644);
                }
            }
        }

        return $foundFile;
    }

    /**
     * Serve an uploaded file directly with appropriate HTTP headers.
     */
    public static function serveUploadedFile($requestPath) {
        // Normalize /api/uploads/... or /uploads/... to relative path inside uploads
        $relPath = $requestPath;
        if (strpos($relPath, '/api/uploads/') === 0) {
            $relPath = substr($relPath, strlen('/api/uploads/'));
        } elseif (strpos($relPath, '/uploads/') === 0) {
            $relPath = substr($relPath, strlen('/uploads/'));
        }

        $relPath = ltrim($relPath, '/\\');
        $filePath = self::findUploadedFile($relPath);

        if (!$filePath || !is_file($filePath)) {
            http_response_code(404);
            header('Content-Type: application/json');
            header('Access-Control-Allow-Origin: *');
            echo json_encode([
                'success' => false,
                'message' => 'Uploaded file not found',
                'path' => $requestPath
            ]);
            exit;
        }

        // Determine MIME type
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $mimeTypes = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'svg'  => 'image/svg+xml',
            'mp4'  => 'video/mp4',
            'webm' => 'video/webm',
            'mov'  => 'video/quicktime',
            'avi'  => 'video/x-msvideo',
            'pdf'  => 'application/pdf',
        ];

        $mimeType = $mimeTypes[$ext] ?? (function_exists('mime_content_type') ? @mime_content_type($filePath) : 'application/octet-stream');
        if (!$mimeType) {
            $mimeType = 'application/octet-stream';
        }

        // Send streaming headers
        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($filePath));
        header('Cache-Control: public, max-age=604800, immutable');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
        header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization');

        // Handle HEAD requests
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
            exit;
        }

        // Stream file
        @readfile($filePath);
        exit;
    }
}
