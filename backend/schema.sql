-- ============================================================
-- Klinik Putrijaya Mini Website - Database Schema
-- Run with: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS klinik_putrijaya
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE klinik_putrijaya;

-- ------------------------------------------------------------
-- Branches
-- ------------------------------------------------------------
CREATE TABLE branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(30) NOT NULL,
  whatsapp_link VARCHAR(255),
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO branches (name, slug, phone, whatsapp_link) VALUES
  ('Klinik Putrijaya Cheras',       'cheras',      '018-314 4588', 'https://wa.link/ohje1h'),
  ('Klinik Putrijaya Sungai Besi',  'sungai-besi', '019-347 0448', 'https://wa.link/edexo9'),
  ('Klinik Putrijaya Puchong',      'puchong',     '019-387 0448', 'https://wa.link/c6jnt3');

-- ------------------------------------------------------------
-- Doctors  (feeds the "Resident Doctors" section + dynamic content + search)
-- ------------------------------------------------------------
CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  qualification VARCHAR(255) NOT NULL,
  reg_no VARCHAR(50) NOT NULL,
  photo_url VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

INSERT INTO doctors (branch_id, name, qualification, reg_no, photo_url) VALUES
  (1, 'Dr Fatin Adilah',      'Bachelor of Medicine & Bachelor of Surgery — Jordan University of Science & Technology (JUST), Irbid', 'Provisional Reg. No. 58083', 'images/dr-fatin.png'),
  (1, 'Dr Emilia Shahira',    'MD — Universiti Kebangsaan Malaysia', 'Provisional Reg. No. 75549', 'images/dr-emilia.png'),
  (1, 'Dr Nurul Hadhanah',    'Bachelor of Medicine & Bachelor of Surgery — Universiti Teknologi MARA', 'Reg. No. 37669', 'images/dr-nurul-hadhanah.png'),
  (3, 'Dr Nurul Fathana',     'Bachelor of Medicine & Bachelor of Surgery — Rajiv Gandhi University of Health Sciences, Bangalore', 'Provisional Reg. No. 84259', 'images/dr-nurul-fathana.png'),
  (3, 'Dr Husna Drahman',     'MBBCh — Mansoura University', 'Provisional Reg. No. 56069', 'images/dr-husna.png');

-- ------------------------------------------------------------
-- Services (feeds "Services" section + used as a dropdown in bookings)
-- ------------------------------------------------------------
CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_key VARCHAR(50) NOT NULL,   -- women / general / treatment / special
  kicker VARCHAR(100),
  title VARCHAR(150) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO services (category_key, kicker, title, description) VALUES
  ('women',     'Women’s Health',   'Women’s & Maternity Care',     'Antenatal, ultrasound scans, pap smear and reproductive health support.'),
  ('general',   'General Care',     'Family & General Medicine',    'Daily healthcare, consultation, vaccination, checkups and basic screening.'),
  ('treatment', 'Treatments',       'Procedures & Minor Care',       'Wound care, asthma treatment, suction and minor procedures.'),
  ('special',   'Special Services', 'Wellness & Certification',     'Mounjaro, travel checkup, license renewal and special health needs.');

-- ------------------------------------------------------------
-- Bookings (Appointment Booking System)
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NOT NULL,
  doctor_id INT NULL,
  service_id INT NULL,
  patient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  ic_number VARCHAR(20),
  preferred_date DATE NOT NULL,
  preferred_time TIME NOT NULL,
  reason TEXT,
  status ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- ------------------------------------------------------------
-- Feedback (Feedback / Review system)
-- ------------------------------------------------------------
CREATE TABLE feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  branch_id INT NULL,
  patient_name VARCHAR(150) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL,
  is_approved TINYINT(1) DEFAULT 0,   -- moderated before public display
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- ------------------------------------------------------------
-- Admin users (Authentication for Admin Panel)
-- ------------------------------------------------------------
CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PROMOTIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
  id INT NOT NULL AUTO_INCREMENT,
  badge VARCHAR(80) DEFAULT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT DEFAULT NULL,
  details TEXT DEFAULT NULL,
  cta_label VARCHAR(80) DEFAULT NULL,
  cta_link VARCHAR(255) DEFAULT NULL,
  image_url VARCHAR(255) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Default admin: username "admin" / password "admin123"
-- (hash generated with bcryptjs, cost 10 — CHANGE THIS PASSWORD after first login)
INSERT INTO admin_users (username, password_hash) VALUES
  ('admin', '$2a$10$D.3ZvVmGEVLhZQ9InjNE9.O5Q/8oMtYh/XBZgKPBG8e.fo0.DIg5e');
