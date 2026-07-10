<?php
class Validation {
    public static function validate($data, $rules) {
        $errors = [];
        
        foreach ($rules as $field => $fieldRules) {
            $value = $data[$field] ?? null;
            
            foreach ($fieldRules as $rule) {
                $error = self::validateRule($field, $value, $rule, $data);
                if ($error) {
                    $errors[$field][] = $error;
                }
            }
        }
        
        return $errors;
    }
    
    private static function validateRule($field, $value, $rule, $allData) {
        if (is_string($rule)) {
            $ruleName = $rule;
            $ruleValue = null;
        } else {
            $ruleName = $rule[0];
            $ruleValue = $rule[1] ?? null;
        }
        
        switch ($ruleName) {
            case 'required':
                if (empty($value) && $value !== '0' && $value !== 0) {
                    return ucfirst($field) . ' is required';
                }
                break;
                
            case 'email':
                if (!empty($value) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    return ucfirst($field) . ' must be a valid email address';
                }
                break;
                
            case 'min':
                if (!empty($value) && strlen($value) < $ruleValue) {
                    return ucfirst($field) . " must be at least {$ruleValue} characters";
                }
                break;
                
            case 'max':
                if (!empty($value) && strlen($value) > $ruleValue) {
                    return ucfirst($field) . " must not exceed {$ruleValue} characters";
                }
                break;
                
            case 'numeric':
                if (!empty($value) && !is_numeric($value)) {
                    return ucfirst($field) . ' must be a number';
                }
                break;
                
            case 'integer':
                if (!empty($value) && !filter_var($value, FILTER_VALIDATE_INT)) {
                    return ucfirst($field) . ' must be an integer';
                }
                break;
                
            case 'unique':
                // This would need database checking - implement as needed
                break;
                
            case 'confirmed':
                $confirmField = $field . '_confirmation';
                if (!empty($value) && $value !== ($allData[$confirmField] ?? null)) {
                    return ucfirst($field) . ' confirmation does not match';
                }
                break;
        }
        
        return null;
    }
    
    public static function sanitizeInput($data) {
        if (is_array($data)) {
            return array_map([self::class, 'sanitizeInput'], $data);
        }
        
        return trim(htmlspecialchars($data, ENT_QUOTES, 'UTF-8'));
    }
    
    public static function isValidEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    public static function isValidPhone($phone) {
        return preg_match('/^[\+]?[1-9][\d]{0,15}$/', $phone);
    }
    
    public static function isValidUsername($username) {
        return preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username);
    }
    
    public static function isValidEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }
    
    public static function isValidPassword($password) {
        return strlen($password) >= 6;
    }
}
?>
