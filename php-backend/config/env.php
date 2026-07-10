<?php
// Load environment variables from .env file
function loadEnv($file = '.env') {
    $envPath = __DIR__ . '/../' . $file;
    
    if (!file_exists($envPath)) {
        // Try production env
        $envPath = __DIR__ . '/../.env.production';
        if (!file_exists($envPath)) {
            error_log('Warning: No .env file found');
            return;
        }
    }
    
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue; // Skip comments
        }
        
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            if (preg_match('/^(["\'])(.*)\\1$/', $value, $matches)) {
                $value = $matches[2];
            }
            
            if (!array_key_exists($key, $_ENV)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

// Load environment variables
loadEnv();

// Set default values if not set
if (!getenv('JWT_SECRET')) {
    putenv('JWT_SECRET=your-default-jwt-secret-change-this-in-production');
}

if (!getenv('JWT_REFRESH_SECRET')) {
    putenv('JWT_REFRESH_SECRET=' . (getenv('JWT_SECRET') ?: 'your-default-refresh-secret'));
}

if (!getenv('PHP_ENV')) {
    putenv('PHP_ENV=development');
}

// Debug environment variables (remove in production)
if (getenv('PHP_ENV') !== 'production') {
    error_log('Environment check:');
    error_log('DB_HOST: ' . (getenv('DB_HOST') ? 'Set' : 'NOT SET'));
    error_log('DB_NAME: ' . (getenv('DB_NAME') ? 'Set' : 'NOT SET'));
    error_log('DB_USER: ' . (getenv('DB_USER') ? 'Set' : 'NOT SET'));
    error_log('DB_PASSWORD: ' . (getenv('DB_PASSWORD') ? 'Set' : 'NOT SET'));
    error_log('JWT_SECRET: ' . (getenv('JWT_SECRET') ? 'Set' : 'NOT SET'));
    error_log('GOOGLE_CLIENT_ID: ' . (getenv('GOOGLE_CLIENT_ID') ? 'Set' : 'NOT SET'));
    error_log('GMAIL_USER: ' . (getenv('GMAIL_USER') ? 'Set' : 'NOT SET'));
    error_log('GMAIL_APP_PASSWORD: ' . (getenv('GMAIL_APP_PASSWORD') ? 'Set' : 'NOT SET'));
}
?>
