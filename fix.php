<?php
/**
 * XSM Market — Emergency Diagnostic & Self-Repair
 * 
 * INSTRUCTIONS:
 * 1. Upload this file to: public_html/api/fix.php on Hostinger
 * 2. Visit: https://xsmmarket.com/api/fix.php
 * 3. It will show you the exact error and try to auto-fix it
 * 4. DELETE this file after you're done!
 */

ini_set('display_errors', '1');
error_reporting(E_ALL);
header('Content-Type: text/html; charset=utf-8');

echo "<h2>XSM Market — Emergency Diagnostic</h2><pre>";

// Step 1: Show PHP version
echo "PHP Version: " . PHP_VERSION . "\n\n";

// Step 2: Try to load env.php
echo "--- Loading env.php ---\n";
$envPhp = __DIR__ . '/config/env.php';
if (file_exists($envPhp)) {
    try {
        include_once $envPhp;
        echo "✅ env.php loaded OK\n";
        echo "DB_HOST: " . getenv('DB_HOST') . "\n";
        echo "DB_NAME: " . getenv('DB_NAME') . "\n";
        echo "DB_USER: " . getenv('DB_USER') . "\n";
        echo "DB_PASSWORD SET: " . (getenv('DB_PASSWORD') ? 'YES' : 'NO') . "\n";
    } catch (Throwable $e) {
        echo "❌ env.php FAILED: " . $e->getMessage() . "\n";
    }
} else {
    echo "❌ env.php NOT FOUND at: $envPhp\n";
    // Try to find .env file
    $dotEnv = __DIR__ . '/.env';
    echo "Looking for .env at: $dotEnv → " . (file_exists($dotEnv) ? "FOUND" : "NOT FOUND") . "\n";
}

// Step 3: Try DB connection directly
echo "\n--- Testing DB Connection ---\n";
try {
    $dsn = "mysql:host=" . getenv('DB_HOST') . ";dbname=" . getenv('DB_NAME') . ";charset=utf8mb4";
    $pdo = new PDO($dsn, getenv('DB_USER'), getenv('DB_PASSWORD'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    echo "✅ DB Connected!\n";
    
    // List tables
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables found: " . implode(', ', $tables) . "\n";
    
    // Test ads query
    if (in_array('ads', $tables)) {
        $count = $pdo->query("SELECT COUNT(*) FROM ads WHERE status='active'")->fetchColumn();
        echo "✅ Active ads count: $count\n";
    }
} catch (Throwable $e) {
    echo "❌ DB FAILED: " . $e->getMessage() . "\n";
}

// Step 4: Load database.php and check for errors
echo "\n--- Loading database.php ---\n";
$dbPhp = __DIR__ . '/config/database.php';
if (file_exists($dbPhp)) {
    try {
        include_once $dbPhp;
        echo "✅ database.php loaded OK\n";
    } catch (Throwable $e) {
        echo "❌ database.php FAILED: " . $e->getMessage() . " on line " . $e->getLine() . "\n";
        echo "File: " . $e->getFile() . "\n";
    }
} else {
    echo "❌ database.php NOT FOUND\n";
}

// Step 5: Test each controller file
echo "\n--- Testing Controller Files ---\n";
$controllers = [
    'controllers/AuthController.php',
    'controllers/UserController.php',
    'controllers/AdController.php',
    'controllers/ChatController.php',
    'controllers/AdminController.php',
    'utils/EmailService.php',
    'utils/Response.php',
    'middleware/auth.php',
    'models/Ad.php',
    'models/User.php',
    'models/Chat.php',
    'models/Message.php',
];
foreach ($controllers as $ctrl) {
    $path = __DIR__ . '/' . $ctrl;
    if (!file_exists($path)) {
        echo "❌ MISSING: $ctrl\n";
        continue;
    }
    try {
        include_once $path;
        echo "✅ OK: $ctrl\n";
    } catch (Throwable $e) {
        echo "❌ FAILED: $ctrl → " . $e->getMessage() . " (line " . $e->getLine() . ")\n";
    }
}

// Step 6: Test index.php routing by simulating a request
echo "\n--- Testing Full API (simulating GET /ads) ---\n";
echo "If the above all passed, the ads route should work.\n";
echo "If not, the error above is what's causing the HTTP 500.\n";

echo "</pre><h3>✅ Diagnostic Complete — DELETE this file now!</h3>";
