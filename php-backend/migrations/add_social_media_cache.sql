-- Migration: Add Social Media Cache table
-- Purpose: Cache social media extraction results for 24 hours to prevent hitting RapidAPI limits and accelerate extraction response times.

CREATE TABLE IF NOT EXISTS `social_media_cache` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `url_hash` CHAR(32) NOT NULL COMMENT 'MD5 hash of lowercase normalized URL',
    `platform` VARCHAR(30) NOT NULL,
    `channel_url` VARCHAR(500) NOT NULL,
    `cached_data` MEDIUMTEXT NOT NULL COMMENT 'JSON-encoded profile data',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `expires_at` DATETIME NOT NULL COMMENT 'Expiration timestamp (24h TTL)',
    UNIQUE KEY `idx_url_hash_unique` (`url_hash`),
    INDEX `idx_expires_at` (`expires_at`),
    INDEX `idx_platform` (`platform`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

