<?php
require_once __DIR__ . '/../utils/response.php';

class JWT {
    private static function getSecret($type = 'access') {
        if ($type === 'refresh') {
            return getenv('JWT_REFRESH_SECRET') ?: getenv('JWT_SECRET');
        }
        return getenv('JWT_SECRET');
    }
    
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64UrlDecode($data) {
        return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
    }
    
    // Generate JWT access token - identical to Node.js generateAccessToken
    public static function generateAccessToken($userId) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'userId' => (int)$userId,
            'type' => 'access',
            'iat' => time(),
            'exp' => time() + 3600 // 1 hour expiry
        ]);
        
        $headerEncoded = self::base64UrlEncode($header);
        $payloadEncoded = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, self::getSecret('access'), true);
        $signatureEncoded = self::base64UrlEncode($signature);
        
        return $headerEncoded . '.' . $payloadEncoded . '.' . $signatureEncoded;
    }
    
    // Generate JWT refresh token - identical to Node.js generateRefreshToken
    public static function generateRefreshToken($userId) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode([
            'userId' => (int)$userId,
            'type' => 'refresh',
            'iat' => time(),
            'exp' => time() + (7 * 24 * 60 * 60) // 7 days expiry
        ]);
        
        $headerEncoded = self::base64UrlEncode($header);
        $payloadEncoded = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $headerEncoded . '.' . $payloadEncoded, self::getSecret('refresh'), true);
        $signatureEncoded = self::base64UrlEncode($signature);
        
        return $headerEncoded . '.' . $payloadEncoded . '.' . $signatureEncoded;
    }
    
    // Generate both tokens - identical to Node.js generateTokens
    public static function generateTokens($userId) {
        return [
            'accessToken' => self::generateAccessToken($userId),
            'refreshToken' => self::generateRefreshToken($userId)
        ];
    }
    
    // Legacy function for backward compatibility - identical to Node.js generateToken
    public static function generateToken($userId) {
        return self::generateAccessToken($userId);
    }
    
    public static function encode($payload, $type = 'access') {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        
        // Set expiration based on type
        $payload['iat'] = time();
        if ($type === 'refresh') {
            $payload['exp'] = time() + (7 * 24 * 60 * 60); // 7 days
        } else {
            $payload['exp'] = time() + (60 * 60); // 1 hour
        }
        
        $payload = json_encode($payload);
        
        $headerEncoded = self::base64UrlEncode($header);
        $payloadEncoded = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $headerEncoded . "." . $payloadEncoded, self::getSecret($type), true);
        $signatureEncoded = self::base64UrlEncode($signature);
        
        return $headerEncoded . "." . $payloadEncoded . "." . $signatureEncoded;
    }
    
    // Verify JWT token - identical to Node.js jwt.verify()
    public static function verify($token, $type = 'access') {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                return false;
            }
            
            $header = json_decode(self::base64UrlDecode($parts[0]), true);
            $payload = json_decode(self::base64UrlDecode($parts[1]), true);
            $signature = $parts[2];
            
            // Verify signature
            $secret = self::getSecret($type);
            $expectedSignature = self::base64UrlEncode(
                hash_hmac('sha256', $parts[0] . '.' . $parts[1], $secret, true)
            );
            
            if (!hash_equals($signature, $expectedSignature)) {
                return false;
            }
            
            // Check expiration
            if (isset($payload['exp']) && time() > $payload['exp']) {
                return false;
            }
            
            // Check type if specified
            if ($type && isset($payload['type']) && $payload['type'] !== $type) {
                return false;
            }
            
            return $payload;
            
        } catch (Exception $e) {
            return false;
        }
    }
    
    public static function decode($jwt, $type = 'access') {
        $tokenParts = explode('.', $jwt);
        
        if (count($tokenParts) !== 3) {
            throw new Exception('Invalid token format');
        }
        
        $header = json_decode(self::base64UrlDecode($tokenParts[0]), true);
        $payload = json_decode(self::base64UrlDecode($tokenParts[1]), true);
        $signatureProvided = $tokenParts[2];
        
        // Verify signature
        $signature = hash_hmac('sha256', $tokenParts[0] . "." . $tokenParts[1], self::getSecret($type), true);
        $signatureEncoded = self::base64UrlEncode($signature);
        
        if (!hash_equals($signatureEncoded, $signatureProvided)) {
            throw new Exception('Invalid token signature');
        }
        
        // Check expiration
        if (isset($payload['exp']) && time() > $payload['exp']) {
            throw new Exception('Token has expired');
        }
        
        return $payload;
    }
}
?>
