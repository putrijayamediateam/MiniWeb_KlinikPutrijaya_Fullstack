/*
  Klinik Putrijaya
  Services V2 database structure

  Created: 2026-07-28

  Adds:
  - service_categories
  - service_subcategories
  - service_branches
  - Services V2 columns and indexes

  Important:
  This migration has already been applied manually to the
  Railway production database.
*/

CREATE TABLE service_categories (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  short_description TEXT DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_categories_slug (slug),
  KEY idx_service_categories_active_sort (
    is_active,
    sort_order
  )
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;

CREATE TABLE service_subcategories (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  short_description TEXT DEFAULT NULL,
  image_url VARCHAR(500) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_subcategories_slug (slug),
  KEY idx_service_subcategories_category (
    category_id,
    is_active,
    sort_order
  ),
  CONSTRAINT fk_service_subcategories_category
    FOREIGN KEY (category_id)
    REFERENCES service_categories(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;

ALTER TABLE services
  ADD COLUMN subcategory_id INT DEFAULT NULL
    AFTER category_key,
  ADD COLUMN keywords VARCHAR(500) DEFAULT NULL
    AFTER hero_image_url,
  ADD COLUMN result_time VARCHAR(255) DEFAULT NULL
    AFTER keywords,
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0
    AFTER result_time,
  ADD KEY idx_services_subcategory_active_sort (
    subcategory_id,
    is_active,
    sort_order
  ),
  ADD KEY idx_services_featured_active (
    is_featured,
    is_active
  ),
  ADD CONSTRAINT fk_services_subcategory
    FOREIGN KEY (subcategory_id)
    REFERENCES service_subcategories(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;

CREATE TABLE service_branches (
  service_id INT NOT NULL,
  branch_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (service_id, branch_id),
  KEY idx_service_branches_branch (
    branch_id,
    service_id
  ),
  CONSTRAINT fk_service_branches_service
    FOREIGN KEY (service_id)
    REFERENCES services(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_service_branches_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_general_ci;