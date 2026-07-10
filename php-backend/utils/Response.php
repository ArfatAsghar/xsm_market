<?php

class Response {
    
    public static function json($data, $status = 200) {
        http_response_code($status);
        
        // Only set content type if not already set
        if (!headers_sent() && !in_array('Content-Type: application/json', headers_list())) {
            header('Content-Type: application/json');
        }
        
        echo json_encode($data);
        exit;
    }
    
    public static function error($message, $status = 400, $additionalData = []) {
        $response = array_merge(['message' => $message], $additionalData);
        self::json($response, $status);
    }
    
    public static function success($data, $status = 200) {
        self::json($data, $status);
    }
}
?>
