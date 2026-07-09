ALTER TABLE users
ADD COLUMN isAdmin tinyint(1) NOT NULL DEFAULT 0;

INSERT INTO users (
  username,
  email,
  password,
  ullName,
  uthProvider,
  isEmailVerified,
  isAdmin,
  createdAt,
  updatedAt
)
SELECT
  'website_agent',
  'support@xsm-market.local',
  NULL,
  'Website Agent',
  'email',
  1,
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM users
  WHERE username = 'website_agent'
  OR email = 'support@xsm-market.local'
);

UPDATE users
SET
  isAdmin = 1,
  isEmailVerified = 1,
  ullName = 'Website Agent'
WHERE username = 'website_agent'
OR email = 'support@xsm-market.local';
