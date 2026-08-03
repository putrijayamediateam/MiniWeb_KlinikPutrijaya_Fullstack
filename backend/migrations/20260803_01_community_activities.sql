/*
  Klinik Putrijaya
  Community Activities & CSR

  Created: 2026-08-03

  Structure:
  - community_activities
  - community_activity_gallery

  Purpose:
  Stores completed community, CSR, sponsorship,
  health outreach and staff activities displayed
  on the public Activities page.
*/

SET NAMES utf8mb4;

START TRANSACTION;

/* =========================================================
   Community activities
   ========================================================= */

CREATE TABLE IF NOT EXISTS community_activities
(
  id BIGINT UNSIGNED
    NOT NULL AUTO_INCREMENT,

  slug VARCHAR(180)
    NOT NULL,

  category VARCHAR(100)
    NOT NULL,

  title VARCHAR(255)
    NOT NULL,

  short_description TEXT
    NULL,

  /*
    Optional actual date for sorting.

    meta_text remains available for flexible public text,
    for example:
    "March 2026 · Bandar Sri Permaisuri, Cheras"
  */
  event_date DATE
    NULL,

  meta_text VARCHAR(255)
    NULL,

  location VARCHAR(255)
    NULL,

  cta_label VARCHAR(100)
    NULL,

  cta_link VARCHAR(1000)
    NULL,

  cover_image_url VARCHAR(1000)
    NULL,

  sort_order INT
    NOT NULL DEFAULT 0,

  is_featured TINYINT(1)
    NOT NULL DEFAULT 0,

  is_active TINYINT(1)
    NOT NULL DEFAULT 1,

  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_community_activities_slug
    (slug),

  KEY idx_community_activities_active_order
    (
      is_active,
      sort_order
    ),

  KEY idx_community_activities_event_date
    (event_date),

  KEY idx_community_activities_category
    (category),

  KEY idx_community_activities_featured
    (
      is_featured,
      is_active
    )
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

/* =========================================================
   Community activity gallery
   ========================================================= */

CREATE TABLE IF NOT EXISTS community_activity_gallery
(
  id BIGINT UNSIGNED
    NOT NULL AUTO_INCREMENT,

  activity_id BIGINT UNSIGNED
    NOT NULL,

  image_url VARCHAR(1000)
    NOT NULL,

  caption VARCHAR(255)
    NULL,

  alt_text VARCHAR(255)
    NULL,

  sort_order INT
    NOT NULL DEFAULT 0,

  is_active TINYINT(1)
    NOT NULL DEFAULT 1,

  created_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP
    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  KEY idx_activity_gallery_activity
    (
      activity_id,
      is_active,
      sort_order
    ),

  CONSTRAINT fk_activity_gallery_activity
    FOREIGN KEY (activity_id)
    REFERENCES community_activities (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;

COMMIT;