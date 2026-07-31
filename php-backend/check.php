<?php
header('Content-Type: application/json');
ini_set('display_errors', '0');
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/database.php';


try {
    $db = Database::getConnection();
    $stmt = $db->query("SELECT COUNT(*) as count FROM ads");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode([
        'status' => 'OK',
        'message' => 'API and Database connection working perfectly!',
        'total_ads' => (int)$row['count'],
        'php_version' => PHP_VERSION,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'ERROR',
        'message' => $e->getMessage(),
        'php_version' => PHP_VERSION
    ]);
}
