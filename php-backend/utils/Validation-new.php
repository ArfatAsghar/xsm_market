<?php

class Validation {
    
    public static function isValidEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    public static function isValidUsername($username) {
        if (strlen($username) < 3 || strlen($username) > 50) {
            return false;
        }
        return preg_match('/^[a-zA-Z0-9_]+$/', $username);
    }
    
    public static function isValidPassword($password) {
        return strlen($password) >= 6;
    }
    
    public static function sanitizeInput($input) {
        return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
    }
}
?>
