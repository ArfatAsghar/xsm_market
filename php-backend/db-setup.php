<?php
header('Content-Type: application/json');
require_once __DIR__ . '/config/env.php';

$dbHost = getenv('DB_HOST') ?: 'NOT SET';
$dbName = getenv('DB_NAME') ?: 'NOT SET';
$dbUser = getenv('DB_USER') ?: 'NOT SET';
$dbPassSet = getenv('DB_PASSWORD') ? 'SET' : 'NOT SET';

$response = [
    'env_config' => [
        'DB_HOST' => $dbHost,
        'DB_NAME' => $dbName,
        'DB_USER' => $dbUser,
        'DB_PASSWORD' => $dbPassSet,
    ],
    'connection_status' => 'PENDING'
];

try {
    require_once __DIR__ . '/config/database.php';
    $pdo = Database::getConnection();
    
    $adsCount = $pdo->query("SELECT COUNT(*) FROM ads")->fetchColumn();
    $usersCount = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    
    $response['connection_status'] = 'SUCCESS';
    $response['message'] = 'Database connected successfully!';
    $response['database_stats'] = [
        'total_ads' => (int)$adsCount,
        'total_users' => (int)$usersCount
    ];
} catch (Exception $e) {
    http_response_code(500);
    $response['connection_status'] = 'FAILED';
    $response['error_message'] = $e->getMessage();
    $response['troubleshooting'] = 'Please open public_html/api/config/env.php in Hostinger File Manager and set your DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD.';
}

echo json_encode($response, JSON_PRETTY_PRINT);
