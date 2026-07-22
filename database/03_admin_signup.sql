USE klinik_putrijaya;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS email_verification_token_hash CHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(32) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS last_login_at DATETIME NULL;

-- Preserve all existing admin accounts as active accounts.
-- The primary-key condition keeps MySQL Workbench Safe Update Mode satisfied.
UPDATE admins
SET
  account_status = 'active',
  auth_provider = CASE
    WHEN auth_provider IS NULL OR TRIM(auth_provider) = '' THEN 'local'
    ELSE auth_provider
  END,
  role = CASE
    WHEN role IS NULL OR TRIM(role) = '' THEN 'admin'
    ELSE role
  END,
  email_verified_at = CASE
    WHEN email IS NOT NULL AND TRIM(email) <> '' AND email_verified_at IS NULL THEN NOW()
    ELSE email_verified_at
  END,
  is_active = 1
WHERE id > 0;

SELECT 'admin_signup_migration_complete' AS status;
