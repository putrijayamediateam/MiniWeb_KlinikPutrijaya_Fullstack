USE klinik_putrijaya;

-- Run this file once in MySQL Workbench.
-- It safely adds the new columns only when they do not already exist.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    SET @sql_text = CONCAT(
      'ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition
    );
    PREPARE statement_handle FROM @sql_text;
    EXECUTE statement_handle;
    DEALLOCATE PREPARE statement_handle;
  END IF;
END$$

DROP PROCEDURE IF EXISTS add_index_if_missing$$
CREATE PROCEDURE add_index_if_missing(
  IN p_table VARCHAR(64),
  IN p_index VARCHAR(64),
  IN p_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = p_table
      AND index_name = p_index
  ) THEN
    SET @sql_text = CONCAT(
      'ALTER TABLE `', p_table, '` ADD ', p_definition
    );
    PREPARE statement_handle FROM @sql_text;
    EXECUTE statement_handle;
    DEALLOCATE PREPARE statement_handle;
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(120) NOT NULL UNIQUE,
  email VARCHAR(190) NULL,
  password_hash VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL add_column_if_missing('admins', 'email', 'VARCHAR(190) NULL AFTER `username`');
CALL add_column_if_missing('admins', 'password_hash', 'VARCHAR(255) NULL AFTER `email`');
CALL add_column_if_missing('admins', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL add_column_if_missing('admins', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('admins', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
CALL add_index_if_missing('admins', 'idx_admin_email', 'INDEX `idx_admin_email` (`email`)');

CALL add_column_if_missing('services', 'slug', 'VARCHAR(180) NULL AFTER `category_key`');
CALL add_column_if_missing('services', 'full_description', 'LONGTEXT NULL AFTER `description`');
CALL add_column_if_missing('services', 'suitable_for', 'TEXT NULL AFTER `full_description`');
CALL add_column_if_missing('services', 'included_items', 'TEXT NULL AFTER `suitable_for`');
CALL add_column_if_missing('services', 'preparation', 'TEXT NULL AFTER `included_items`');
CALL add_column_if_missing('services', 'aftercare', 'TEXT NULL AFTER `preparation`');
CALL add_column_if_missing('services', 'hero_image_url', 'VARCHAR(500) NULL AFTER `aftercare`');
CALL add_column_if_missing('services', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER `hero_image_url`');
CALL add_column_if_missing('services', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
CALL add_column_if_missing('services', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
CALL add_column_if_missing('services', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

UPDATE services
SET slug = CONCAT('service-', id)
WHERE slug IS NULL OR TRIM(slug) = '';

CALL add_index_if_missing('services', 'uq_services_slug', 'UNIQUE INDEX `uq_services_slug` (`slug`)');
CALL add_index_if_missing('services', 'idx_services_category_active', 'INDEX `idx_services_category_active` (`category_key`, `is_active`, `sort_order`)');

CREATE TABLE IF NOT EXISTS service_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  package_name VARCHAR(180) NOT NULL,
  package_description TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_prices_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE CASCADE,
  INDEX idx_service_prices_service (service_id, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_gallery_service
    FOREIGN KEY (service_id) REFERENCES services(id)
    ON DELETE CASCADE,
  INDEX idx_service_gallery_service (service_id, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL add_column_if_missing('bookings', 'email', 'VARCHAR(190) NULL AFTER `phone`');
CALL add_column_if_missing('bookings', 'confirmation_email_sent_at', 'DATETIME NULL');
CALL add_column_if_missing('bookings', 'confirmation_sms_sent_at', 'DATETIME NULL');
CALL add_column_if_missing('bookings', 'notification_error', 'TEXT NULL');
CALL add_index_if_missing('bookings', 'idx_bookings_status_created', 'INDEX `idx_bookings_status_created` (`status`, `created_at`)');
CALL add_index_if_missing('bookings', 'idx_bookings_branch_created', 'INDEX `idx_bookings_branch_created` (`branch_id`, `created_at`)');

CREATE TABLE IF NOT EXISTS admin_password_resets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE CASCADE,
  INDEX idx_password_reset_admin (admin_id),
  INDEX idx_password_reset_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS add_index_if_missing;

-- IMPORTANT:
-- Add a real email address to every admin account that should use forgot-password.
-- Example only:
-- UPDATE admins SET email = 'your-admin-email@example.com' WHERE username = 'admin';
