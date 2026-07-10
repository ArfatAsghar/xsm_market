-- Table for storing cryptocurrency payment information
CREATE TABLE IF NOT EXISTS crypto_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deal_id INT NOT NULL,
    nowpayments_payment_id VARCHAR(255) NOT NULL UNIQUE,
    order_id VARCHAR(255) NOT NULL,
    payment_status ENUM('waiting', 'confirming', 'confirmed', 'sending', 'finished', 'failed', 'refunded', 'expired') NOT NULL,
    price_amount DECIMAL(20, 8) NOT NULL,
    price_currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    actually_paid DECIMAL(20, 8) NULL,
    pay_currency VARCHAR(10) NULL,
    outcome_amount DECIMAL(20, 8) NULL,
    outcome_currency VARCHAR(10) NULL,
    payment_url TEXT NULL,
    qr_code_url TEXT NULL,
    webhook_data JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
    INDEX idx_payment_id (nowpayments_payment_id),
    INDEX idx_order_id (order_id),
    INDEX idx_deal_id (deal_id),
    INDEX idx_status (payment_status)
);
