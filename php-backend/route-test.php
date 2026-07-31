<?php
// Absolute minimum test - no requires, no dependencies
ini_set('display_errors', '1');
error_reporting(E_ALL);
header('Content-Type: application/json');

echo json_encode([
    'status'      => 'PHP_OK',
    'php_version' => PHP_VERSION,
    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
    'server_name' => $_SERVER['SERVER_NAME'] ?? 'unknown',
    'timestamp'   => date('Y-m-d H:i:s'),
], JSON_PRETTY_PRINT);
