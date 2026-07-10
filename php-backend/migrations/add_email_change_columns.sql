-- Migration: Add email change functionality columns to users table
-- Date: 2024-12-19

ALTER TABLE `users` 
ADD COLUMN `pendingEmail` VARCHAR(255) NULL DEFAULT NULL COMMENT 'New email address pending verification',
ADD COLUMN `emailChangeToken` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Token for email change verification',
ADD INDEX `idx_email_change_token` (`emailChangeToken`);

-- Note: We already have emailOTP and otpExpires columns that can be reused for email change verification
