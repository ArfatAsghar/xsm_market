<?php
// CORS Configuration
function setCorsHeaders() {
    $allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
        'https://xsmmarket.com',
        'http://xsmmarket.com'
    ];
    
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        header('Access-Control-Allow-Origin: *');
    }
    
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 3600');
}

// Set CORS headers
setCorsHeaders();
?>
