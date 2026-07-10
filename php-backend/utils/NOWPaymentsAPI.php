<?php

class NOWPaymentsAPI {
    private $apiKey;
    private $apiUrl;
    private $ipnSecret;
    private $environment;

    public function __construct() {
        $this->environment = $_ENV['NOW_PAYMENTS_ENVIRONMENT'] ?? 'sandbox';
        
        if ($this->environment === 'production') {
            $this->apiKey = $_ENV['NOW_PAYMENTS_API_KEY_PRODUCTION'];
            $this->apiUrl = $_ENV['NOW_PAYMENTS_API_URL_PRODUCTION'];
            $this->ipnSecret = $_ENV['NOW_PAYMENTS_IPN_SECRET_PRODUCTION'];
        } else {
            $this->apiKey = $_ENV['NOW_PAYMENTS_API_KEY_SANDBOX'];
            $this->apiUrl = $_ENV['NOW_PAYMENTS_API_URL_SANDBOX'];
            $this->ipnSecret = $_ENV['NOW_PAYMENTS_IPN_SECRET_SANDBOX'];
        }
    }

    private function makeRequest($endpoint, $method = 'GET', $data = null) {
        $url = $this->apiUrl . $endpoint;
        
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'x-api-key: ' . $this->apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false
        ]);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            }
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception("CURL Error: " . $error);
        }

        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 400) {
            $errorMessage = $decodedResponse['message'] ?? 'Unknown API error';
            throw new Exception("API Error ({$httpCode}): " . $errorMessage);
        }

        return $decodedResponse;
    }

    public function getAvailableCurrencies() {
        return $this->makeRequest('/currencies');
    }

    public function getEstimatedPrice($fromCurrency, $toCurrency, $amount) {
        $endpoint = "/estimate?amount={$amount}&currency_from={$fromCurrency}&currency_to={$toCurrency}";
        return $this->makeRequest($endpoint);
    }

    public function getMinimumPaymentAmount($fromCurrency, $toCurrency) {
        $endpoint = "/min-amount?currency_from={$fromCurrency}&currency_to={$toCurrency}";
        return $this->makeRequest($endpoint);
    }

    public function createPayment($paymentData) {
        $defaultData = [
            'case' => 'success',
            'ipn_callback_url' => $_ENV['NOW_PAYMENTS_WEBHOOK_URL'],
            'success_url' => $_ENV['FRONTEND_URL'] . '/payment/success',
            'cancel_url' => $_ENV['FRONTEND_URL'] . '/payment/cancel'
        ];

        $data = array_merge($defaultData, $paymentData);
        return $this->makeRequest('/payment', 'POST', $data);
    }

    public function getPaymentStatus($paymentId) {
        return $this->makeRequest("/payment/{$paymentId}");
    }

    public function getPaymentsList($limit = 10, $page = 0) {
        $endpoint = "/payment/?limit={$limit}&page={$page}";
        return $this->makeRequest($endpoint);
    }

    public function verifyIPN($requestBody, $signature) {
        $calculatedSignature = hash_hmac('sha512', $requestBody, $this->ipnSecret);
        return hash_equals($calculatedSignature, $signature);
    }

    public function getSupportedCurrencies() {
        // Return commonly supported cryptocurrencies for the UI
        return [
            ['code' => 'btc', 'name' => 'Bitcoin'],
            ['code' => 'eth', 'name' => 'Ethereum'],
            ['code' => 'usdt', 'name' => 'Tether (USDT)'],
            ['code' => 'usdc', 'name' => 'USD Coin'],
            ['code' => 'ltc', 'name' => 'Litecoin'],
            ['code' => 'xrp', 'name' => 'Ripple'],
            ['code' => 'ada', 'name' => 'Cardano'],
            ['code' => 'dot', 'name' => 'Polkadot'],
            ['code' => 'bnb', 'name' => 'Binance Coin'],
            ['code' => 'sol', 'name' => 'Solana']
        ];
    }

    public function createEscrowPayment($dealId, $amount, $currency = 'usd', $payCurrency = 'btc') {
        $orderId = "deal_{$dealId}_" . time();
        
        $paymentData = [
            'price_amount' => floatval($amount),
            'price_currency' => strtolower($currency),
            'pay_currency' => strtolower($payCurrency),
            'order_id' => $orderId,
            'order_description' => "Escrow payment for deal #{$dealId}",
            'customer_email' => null, // Will be set by the calling function
            'case' => 'success'
        ];

        return $this->createPayment($paymentData);
    }
    
    public function getIPNSecret() {
        return $this->ipnSecret;
    }
}
