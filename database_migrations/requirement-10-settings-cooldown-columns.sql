ALTER TABLE users
ADD COLUMN lastEmailChange datetime DEFAULT NULL COMMENT 'Timestamp of last successful email change';

ALTER TABLE users
ADD COLUMN lastPasswordChange datetime DEFAULT NULL COMMENT 'Timestamp of last successful password change';

ALTER TABLE users
ADD COLUMN lastUsernameChange datetime DEFAULT NULL COMMENT 'Timestamp of last successful username change';

ALTER TABLE users
ADD COLUMN pendingEmail varchar(255) DEFAULT NULL COMMENT 'New email address pending verification';

ALTER TABLE users
ADD COLUMN emailChangeToken varchar(64) DEFAULT NULL COMMENT 'Token for email change verification';

ALTER TABLE users
ADD COLUMN currentEmailOTP varchar(10) DEFAULT NULL COMMENT 'OTP sent to current email for verification';

ALTER TABLE users
ADD COLUMN currentEmailOTPExpires datetime DEFAULT NULL COMMENT 'Expiry time for current email OTP';

ALTER TABLE users
ADD COLUMN 
ewEmailOTP varchar(10) DEFAULT NULL COMMENT 'OTP sent to new email for verification';

ALTER TABLE users
ADD COLUMN 
ewEmailOTPExpires datetime DEFAULT NULL COMMENT 'Expiry time for new email OTP';

ALTER TABLE users
ADD COLUMN currentEmailVerified tinyint(1) DEFAULT 0 COMMENT 'Whether current email has been verified for email change';

ALTER TABLE users
ADD COLUMN emailChangeRequestedAt datetime DEFAULT NULL COMMENT 'When the email change was first requested';
