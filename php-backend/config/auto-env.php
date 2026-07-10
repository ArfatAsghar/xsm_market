<?php
// Development Configuration Helper
// This script helps detect and configure the right environment automatically

function detectEnvironment() {
    // Check if we're on localhost/local development
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'unknown';
    
    if (strpos($host, 'localhost') !== false || 
        strpos($host, '127.0.0.1') !== false ||
        strpos($host, '.local') !== false) {
        return 'development';
    }
    
    // Check if we're on a live domain
    if (strpos($host, 'xsmmarket.com') !== false ||
        strpos($host, 'hostinger') !== false) {
        return 'production';
    }
    
    return 'development'; // Default to development for safety
}

function setupEnvironmentForDevelopment() {
    // Override environment variables for development
    $_ENV['PHP_ENV'] = 'development';
    $_ENV['DB_HOST'] = 'localhost';
    $_ENV['DB_NAME'] = 'xsm_market_local';
    $_ENV['DB_USER'] = 'root';
    $_ENV['DB_PASS'] = 'localpassword123';
    $_ENV['FRONTEND_URL'] = 'http://localhost:5173';
    $_ENV['EMAIL_DEBUG_MODE'] = 'false'; // Still send real emails in development
    $_ENV['EMAIL_FORCE_SEND'] = 'true';
    
    // Set environment variables globally
    putenv('PHP_ENV=development');
    putenv('DB_HOST=localhost');
    putenv('DB_NAME=xsm_market_local');
    putenv('DB_USER=root');
    putenv('DB_PASS=localpassword123');
    putenv('FRONTEND_URL=http://localhost:5173');
    putenv('EMAIL_DEBUG_MODE=false');
    putenv('EMAIL_FORCE_SEND=true');
    
    error_log('Development environment configured automatically');
}

function setupEnvironmentForProduction() {
    // Keep production settings from .env file
    $_ENV['PHP_ENV'] = 'production';
    $_ENV['EMAIL_DEBUG_MODE'] = 'false';
    $_ENV['EMAIL_FORCE_SEND'] = 'true';
    
    putenv('PHP_ENV=production');
    putenv('EMAIL_DEBUG_MODE=false');
    putenv('EMAIL_FORCE_SEND=true');
    
    error_log('Production environment maintained');
}

// Auto-configure based on detected environment
$detectedEnv = detectEnvironment();
error_log('Detected environment: ' . $detectedEnv);

if ($detectedEnv === 'development') {
    setupEnvironmentForDevelopment();
} else {
    setupEnvironmentForProduction();
}

return $detectedEnv;
?>