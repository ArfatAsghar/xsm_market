<?php
// Environment Detector & Helper
// Automatically respects .env / .env.production values and prevents overriding live database credentials

function detectEnvironment() {
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';
    
    if (strpos($host, 'localhost') !== false || 
        strpos($host, '127.0.0.1') !== false ||
        strpos($host, '.local') !== false) {
        return 'development';
    }
    
    return 'production';
}

function setupEnvironmentForDevelopment() {
    // Only set local fallback if DB_HOST is not already configured in .env
    if (!getenv('DB_HOST')) {
        $_ENV['PHP_ENV'] = 'development';
        $_ENV['DB_HOST'] = '127.0.0.1';
        $_ENV['DB_NAME'] = 'xsm_market_local';
        $_ENV['DB_USER'] = 'root';
        $_ENV['DB_PASS'] = 'localpassword123';
        $_ENV['DB_PASSWORD'] = 'localpassword123';
        $_ENV['FRONTEND_URL'] = 'http://localhost:5173';
        
        putenv('PHP_ENV=development');
        putenv('DB_HOST=127.0.0.1');
        putenv('DB_NAME=xsm_market_local');
        putenv('DB_USER=root');
        putenv('DB_PASS=localpassword123');
        putenv('DB_PASSWORD=localpassword123');
        putenv('FRONTEND_URL=http://localhost:5173');
    }
    
    putenv('EMAIL_DEBUG_MODE=false');
    putenv('EMAIL_FORCE_SEND=true');
}

function setupEnvironmentForProduction() {
    $_ENV['PHP_ENV'] = 'production';
    $_ENV['EMAIL_DEBUG_MODE'] = 'false';
    $_ENV['EMAIL_FORCE_SEND'] = 'true';
    
    putenv('PHP_ENV=production');
    putenv('EMAIL_DEBUG_MODE=false');
    putenv('EMAIL_FORCE_SEND=true');
}

$detectedEnv = detectEnvironment();

if ($detectedEnv === 'development' && !getenv('DB_HOST')) {
    setupEnvironmentForDevelopment();
} else {
    setupEnvironmentForProduction();
}

return $detectedEnv;
?>