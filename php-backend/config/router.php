<?php
/**
 * Router Configuration
 * This file allows you to configure the hybrid routing behavior
 */

return [
    // Default routing strategy: 'index' or 'server'
    'default_strategy' => 'index',
    
    // Route-specific overrides
    // Key: route pattern, Value: routing strategy ('index' or 'server')
    'route_overrides' => [
        // Use server.php style for these routes (more structured)
        '/auth/' => 'server',
        '/user' => 'server',
        
        // Use index.php style for these routes (more flexible)
        '/crypto-payments' => 'index',
        '/webhooks/' => 'index',
        '/social-media' => 'index',
        '/debug' => 'index',
        '/contact' => 'index',
        
        // You can override specific routes as needed
        // '/ads' => 'server',  // Uncomment to use server style for ads
        // '/chat' => 'index',  // Uncomment to use index style for chat
    ],
    
    // Feature flags
    'features' => [
        'enable_logging' => true,
        'enable_cors' => true,
        'enable_auth_debug' => true,
        'enable_health_checks' => true,
    ],
    
    // Controller preferences
    'controllers' => [
        // Prefer complete controllers when available
        'use_complete_controllers' => true,
        
        // Controller mappings for different strategies
        'index_style' => [
            'auth' => 'AuthController',
            'user' => 'UserController',
            'ad' => 'AdController',
            'chat' => 'ChatController',
            'admin' => 'AdminController',
        ],
        
        'server_style' => [
            'auth' => 'AuthController',
            'user' => 'UserController',
            'ad' => 'AdController', // Will try AdController-complete if available
            'chat' => 'ChatController', // Will try ChatController-complete if available
            'admin' => 'AdminController', // Will try AdminController-complete if available
        ],
    ],
    
    // Route aliases and redirects
    'aliases' => [
        '/api/auth/google' => '/auth/google-signin',
        '/api/user/profile-legacy' => '/user/profile',
        '/api/ads/user' => '/ads/my-ads',
    ],
    
    // Middleware configuration
    'middleware' => [
        'auth_required' => [
            '/user/',
            '/ads/my-ads',
            '/chat/',
            '/admin/',
        ],
        'admin_required' => [
            '/admin/',
        ],
    ],
];
?>
