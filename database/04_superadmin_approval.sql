USE klinik_putrijaya;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS approved_by INT NULL,
  ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_admins_account_status
  ON admins (account_status);

CREATE INDEX IF NOT EXISTS idx_admins_role
  ON admins (role);

-- Existing active administrators remain active.
UPDATE admins
SET account_status = 'active',
    is_active = 1,
    role = CASE
      WHEN role IS NULL OR TRIM(role) = '' THEN 'admin'
      ELSE role
    END
WHERE id > 0
  AND account_status NOT IN ('pending_verification', 'pending_approval', 'rejected');

SELECT id, username, email, role, account_status, is_active
FROM admins
ORDER BY id;

SELECT 'superadmin_approval_migration_complete' AS status;
