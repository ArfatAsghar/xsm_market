<?php
/**
 * reCAPTCHA Verification Utility
 * Handles Google reCAPTCHA v2 verification
 */
class RecaptchaService {
    private $secretKey;
    
    public function __construct() {
        $this->secretKey = $_ENV['RECAPTCHA_SECRET_KEY'] ?? '';
        
        if (empty($this->secretKey)) {
            throw new Exception('reCAPTCHA secret key not configured');
        }
    }
    
    /**
     * Verify reCAPTCHA token
     * @param string $token The reCAPTCHA token from the frontend
     * @param string $remoteIp Optional remote IP address
     * @return array Array containing success status and error codes if any
     */
    public function verifyToken($token, $remoteIp = null) {
        if (empty($token)) {
            return [
                'success' => false,
                'error-codes' => ['missing-input-response'],
                'message' => 'reCAPTCHA token is required'
            ];
        }
        
        $data = [
            'secret' => $this->secretKey,
            'response' => $token
        ];
        
        if ($remoteIp) {
            $data['remoteip'] = $remoteIp;
        }
        
        $options = [
            'http' => [
                'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                'method' => 'POST',
                'content' => http_build_query($data)
            ]
        ];
        
        $context = stream_context_create($options);
        $result = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);
        
        if ($result === false) {
            return [
                'success' => false,
                'error-codes' => ['network-error'],
                'message' => 'Failed to verify reCAPTCHA: Network error'
            ];
        }
        
        $response = json_decode($result, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [
                'success' => false,
                'error-codes' => ['invalid-json'],
                'message' => 'Failed to verify reCAPTCHA: Invalid response'
            ];
        }
        
        if (!$response['success']) {
            $errorCodes = $response['error-codes'] ?? ['unknown-error'];
            $errorMessage = $this->getErrorMessage($errorCodes);
            
            return [
                'success' => false,
                'error-codes' => $errorCodes,
                'message' => $errorMessage
            ];
        }
        
        return [
            'success' => true,
            'challenge_ts' => $response['challenge_ts'] ?? null,
            'hostname' => $response['hostname'] ?? null
        ];
    }
    
    /**
     * Get human-readable error message from reCAPTCHA error codes
     * @param array $errorCodes
     * @return string
     */
    private function getErrorMessage($errorCodes) {
        $messages = [
            'missing-input-secret' => 'The secret parameter is missing',
            'invalid-input-secret' => 'The secret parameter is invalid or malformed',
            'missing-input-response' => 'reCAPTCHA verification is required',
            'invalid-input-response' => 'reCAPTCHA verification failed. Please try again',
            'bad-request' => 'The request is invalid or malformed',
            'timeout-or-duplicate' => 'reCAPTCHA has expired. Please try again'
        ];
        
        foreach ($errorCodes as $code) {
            if (isset($messages[$code])) {
                return $messages[$code];
            }
        }
        
        return 'reCAPTCHA verification failed. Please try again';
    }
    
    /**
     * Check if reCAPTCHA verification should be enforced
     * Can be used to disable reCAPTCHA in development or for certain conditions
     * @return bool
     */
    public function shouldEnforce() {
        // Check environment variables safely
        $phpEnv = getenv('PHP_ENV') ?: $_ENV['PHP_ENV'] ?? $_SERVER['PHP_ENV'] ?? 'production';
        $disableRecaptcha = getenv('DISABLE_RECAPTCHA') ?: $_ENV['DISABLE_RECAPTCHA'] ?? $_SERVER['DISABLE_RECAPTCHA'] ?? 'false';
        
        // Disable reCAPTCHA in development if needed
        if ($phpEnv === 'development' && $disableRecaptcha === 'true') {
            return false;
        }
        
        // For testing purposes, allow bypass with test tokens
        if ($phpEnv === 'development' || $phpEnv === 'testing') {
            return false;
        }
        
        return true;
    }
}
?>
