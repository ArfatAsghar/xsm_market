<?php
// ─── Hostinger Production Database Configuration ─────────────────────────────
// These values match the live MySQL database on xsmmarket.com (Hostinger)
putenv('DB_HOST=localhost');
putenv('DB_NAME=u718696665_xsm_market_db');
putenv('DB_USER=u718696665_xsm_user');
putenv('DB_PASSWORD=gd#2SEwMtAbBwA7');
putenv('PHP_ENV=production');
putenv('SITE_URL=https://xsmmarket.com');
putenv('FRONTEND_URL=https://xsmmarket.com');

// Keep these from the original config
putenv('JWT_SECRET=xsm-market-secret-key-2025');
putenv('JWT_REFRESH_SECRET=xsm-market-refresh-secret-key-2025');
putenv('GOOGLE_CLIENT_ID=706026691678-kbn3pqlj9f5t7o8sri6lf5ucgi03btjb.apps.googleusercontent.com');
putenv('GMAIL_USER=novaflowa4@gmail.com');
putenv('GMAIL_APP_PASSWORD=otip jnis jpln znno');
putenv('ADMIN_EMAIL=novaflowa4@gmail.com');
putenv('SOCIALBLADE_CLIENT_ID=cli_e99bd2a868f43119adfee3b2');
putenv('SOCIALBLADE_TOKEN=6746ffe68390223ddb077789fa8ac3228a800a8d503c8251dc0266b56d5f57ef');
putenv('RECAPTCHA_SITE_KEY=6LfTNporAAAAAFLpNrgqR9pOIBnp5GsVR2w2AJex');
putenv('RECAPTCHA_SECRET_KEY=6LfTNporAAAAAOP8fXn5ObMQtAT89S5KDEUsp_yb');
putenv('NOW_PAYMENTS_API_KEY_PRODUCTION=1PZWJCA-2D24K0Z-Q8G8BNP-Z4NN5X5');
putenv('NOW_PAYMENTS_IPN_SECRET_PRODUCTION=ISiEUUwIZVvuFP/EGq7PJO9LRmCgbUjj');
putenv('NOW_PAYMENTS_ENVIRONMENT=production');

// Load environment variables from .env file or system environment (fallback)
function loadEnv($file = '.env') {
    $envPath = __DIR__ . '/../' . $file;
    
    if (!file_exists($envPath)) {
        $envPath = __DIR__ . '/../.env.production';
    }
    
    if (file_exists($envPath)) {
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
                
                // Only set if not already set above
                if (!getenv($key)) {
                    putenv("$key=$value");
                    $_ENV[$key] = $value;
                    $_SERVER[$key] = $value;
                }
            }
        }
    }
}

// Sync putenv values to $_ENV and $_SERVER
foreach ([
    'DB_HOST','DB_NAME','DB_USER','DB_PASSWORD','PHP_ENV','SITE_URL','FRONTEND_URL',
    'JWT_SECRET','JWT_REFRESH_SECRET','GOOGLE_CLIENT_ID','GMAIL_USER','GMAIL_APP_PASSWORD',
    'ADMIN_EMAIL','SOCIALBLADE_CLIENT_ID','SOCIALBLADE_TOKEN',
    'RECAPTCHA_SITE_KEY','RECAPTCHA_SECRET_KEY',
    'NOW_PAYMENTS_API_KEY_PRODUCTION','NOW_PAYMENTS_IPN_SECRET_PRODUCTION','NOW_PAYMENTS_ENVIRONMENT'
] as $k) {
    $v = getenv($k);
    if ($v !== false) {
        $_ENV[$k] = $v;
        $_SERVER[$k] = $v;
    }
}

// Set JWT defaults if still missing
if (!getenv('JWT_REFRESH_SECRET')) {
    putenv('JWT_REFRESH_SECRET=' . getenv('JWT_SECRET'));
}
?>
