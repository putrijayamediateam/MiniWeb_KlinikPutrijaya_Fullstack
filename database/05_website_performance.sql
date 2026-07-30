CREATE TABLE IF NOT EXISTS website_performance_events (
  id BIGINT NOT NULL AUTO_INCREMENT,

  event_type VARCHAR(40) NOT NULL,

  branch_id INT(11) DEFAULT NULL,
  service_id INT(11) DEFAULT NULL,

  session_key VARCHAR(80) DEFAULT NULL,

  /*
    Digunakan untuk mengelakkan rekod berulang,
    contohnya satu website visit bagi satu session
    dan satu booking event bagi satu booking reference.
  */
  event_key VARCHAR(150) DEFAULT NULL,

  page_path VARCHAR(255) DEFAULT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  UNIQUE KEY uq_performance_event_key (
    event_key
  ),

  KEY idx_performance_created_at (
    created_at
  ),

  KEY idx_performance_event_type_created (
    event_type,
    created_at
  ),

  KEY idx_performance_branch_created (
    branch_id,
    created_at
  ),

  KEY idx_performance_service_created (
    service_id,
    created_at
  ),

  CONSTRAINT fk_performance_branch
    FOREIGN KEY (branch_id)
    REFERENCES branches (id)
    ON DELETE SET NULL,

  CONSTRAINT fk_performance_service
    FOREIGN KEY (service_id)
    REFERENCES services (id)
    ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;