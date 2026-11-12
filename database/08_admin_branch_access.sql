-- Branch-scoped booking access for staff accounts.
--
-- A row grants one admin account access to one branch's bookings.
-- An admin or manager with no rows keeps access to every branch, so
-- existing accounts behave exactly as before until a superadmin
-- assigns branches. Superadmins always see every branch.
--
-- Apply:    run against the target database (no USE statement; select
--           the database in your client first). Safe to re-run.
-- Rollback: DROP TABLE IF EXISTS admin_branch_access;
--           Every account then sees all branches again. The backend
--           treats a missing table as "no restrictions".
-- Verify:   see the queries at the end of this file.

CREATE TABLE IF NOT EXISTS admin_branch_access (
  admin_id INT NOT NULL,
  branch_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (admin_id, branch_id),
  KEY idx_admin_branch_access_branch (branch_id),

  CONSTRAINT fk_admin_branch_access_admin
    FOREIGN KEY (admin_id) REFERENCES admins (id)
    ON DELETE CASCADE,

  CONSTRAINT fk_admin_branch_access_branch
    FOREIGN KEY (branch_id) REFERENCES branches (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification:
-- SHOW CREATE TABLE admin_branch_access;
-- SELECT a.email, b.name AS branch
-- FROM admin_branch_access aba
-- INNER JOIN admins a ON a.id = aba.admin_id
-- INNER JOIN branches b ON b.id = aba.branch_id
-- ORDER BY a.email, b.name;
