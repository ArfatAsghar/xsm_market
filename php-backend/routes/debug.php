<?php
// Debug routes for development
if (getenv('PHP_ENV') === 'production') {
    Response::error('Debug routes are disabled in production', 403);
}

switch (true) {
    case $path === '/debug/info' && $method === 'GET':
        handleDebugInfo();
        break;
    case $path === '/debug/db' && $method === 'GET':
        handleDebugDatabase();
        break;
    case $path === '/debug/email' && $method === 'POST':
        handleDebugEmail();
        break;
    default:
        Response::error('Debug route not found', 404);
}

function handleDebugInfo() {
    $info = [
        'php_version' => phpversion(),
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'environment' => getenv('PHP_ENV') ?: 'development',
        'timezone' => date_default_timezone_get(),
        'current_time' => date('Y-m-d H:i:s'),
        'memory_usage' => memory_get_usage(true),
        'memory_limit' => ini_get('memory_limit'),
        'extensions' => [
            'pdo' => extension_loaded('pdo'),
            'pdo_mysql' => extension_loaded('pdo_mysql'),
            'json' => extension_loaded('json'),
            'openssl' => extension_loaded('openssl'),
            'curl' => extension_loaded('curl')
        ],
        'env_vars' => [
            'DB_HOST' => getenv('DB_HOST') ? 'Set' : 'Not set',
            'DB_NAME' => getenv('DB_NAME') ? 'Set' : 'Not set',
            'DB_USER' => getenv('DB_USER') ? 'Set' : 'Not set',
            'DB_PASSWORD' => getenv('DB_PASSWORD') ? 'Set' : 'Not set',
            'JWT_SECRET' => getenv('JWT_SECRET') ? 'Set' : 'Not set',
            'GMAIL_USER' => getenv('GMAIL_USER') ? 'Set' : 'Not set',
            'GMAIL_APP_PASSWORD' => getenv('GMAIL_APP_PASSWORD') ? 'Set' : 'Not set'
        ]
    ];
    
    Response::json($info);
}

function handleDebugDatabase() {
    try {
        $isConnected = Database::testConnection();
        
        if ($isConnected) {
            $pdo = Database::getConnection();
            
            // Test queries
            $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
            
            $tableInfo = [];
            foreach ($tables as $table) {
                $count = $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
                $tableInfo[$table] = ['count' => $count];
            }
            
            Response::json([
                'connected' => true,
                'tables' => $tableInfo
            ]);
        } else {
            Response::json([
                'connected' => false,
                'error' => 'Could not connect to database'
            ]);
        }
        
    } catch (Exception $e) {
        Response::json([
            'connected' => false,
            'error' => $e->getMessage()
        ]);
    }
}

function handleDebugEmail() {
    $input = json_decode(file_get_contents('php://input'), true);
    $testEmail = trim($input['email'] ?? '');
    
    if (!$testEmail) {
        Response::error('Test email is required', 400);
    }
    
    if (!Validation::isValidEmail($testEmail)) {
        Response::error('Invalid email format', 400);
    }
    
    try {
        $result = EmailService::sendOTPEmail($testEmail, '123456', 'TestUser');
        
        Response::json([
            'sent' => $result,
            'email' => $testEmail,
            'message' => $result ? 'Test email sent successfully' : 'Failed to send test email'
        ]);
        
    } catch (Exception $e) {
        Response::json([
            'sent' => false,
            'email' => $testEmail,
            'error' => $e->getMessage()
        ]);
    }
}
?>
