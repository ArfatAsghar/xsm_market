-- Migration: Add dual email verification support
-- Date: 2025-08-10
-- Purpose: Support two-step email change verification (current email + new email)

ALTER TABLE `users` 
ADD COLUMN `currentEmailOTP` VARCHAR(10) NULL DEFAULT NULL COMMENT 'OTP sent to current email for verification',
ADD COLUMN `currentEmailOTPExpires` DATETIME NULL DEFAULT NULL COMMENT 'Expiry time for current email OTP',
ADD COLUMN `newEmailOTP` VARCHAR(10) NULL DEFAULT NULL COMMENT 'OTP sent to new email for verification', 
ADD COLUMN `newEmailOTPExpires` DATETIME NULL DEFAULT NULL COMMENT 'Expiry time for new email OTP',
ADD COLUMN `currentEmailVerified` TINYINT(1) DEFAULT 0 COMMENT 'Whether current email has been verified for email change',
ADD COLUMN `emailChangeRequestedAt` DATETIME NULL DEFAULT NULL COMMENT 'When the email change was first requested',
ADD COLUMN `emailChangeLastAttempt` DATETIME NULL DEFAULT NULL COMMENT 'Last time an email change was attempted (for cooldown)';

-- Add indexes for performance
ADD INDEX `idx_current_email_otp` (`currentEmailOTP`),
ADD INDEX `idx_new_email_otp` (`newEmailOTP`),
ADD INDEX `idx_email_change_requested` (`emailChangeRequestedAt`);
