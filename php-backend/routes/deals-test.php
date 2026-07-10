<?php
// Simple test endpoint
header('Content-Type: application/json');
// Use environment variable for CORS or allow all for production
$frontendUrl = $_ENV['FRONTEND_URL'] ?? 'https://xsmmarket.com';
header('Access-Control-Allow-Origin: ' . $frontendUrl);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

echo json_encode([
    'message' => 'Deals endpoint is working',
    'method' => $_SERVER['REQUEST_METHOD'],
    'path' => $_SERVER['REQUEST_URI'],
    'query' => $_GET,
    'timestamp' => date('Y-m-d H:i:s')
]);
?>
