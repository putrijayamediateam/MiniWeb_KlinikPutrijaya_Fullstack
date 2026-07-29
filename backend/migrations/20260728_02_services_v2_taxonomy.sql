/*
  Klinik Putrijaya
  Services V2 official taxonomy

  Created: 2026-07-28

  Structure:
  - 4 service categories
  - 24 service subcategories

  Important:
  This migration has already been applied manually to the
  Railway production database.
*/

SET NAMES utf8mb4;

START TRANSACTION;

/* =========================================================
   Official categories
   ========================================================= */

INSERT INTO service_categories
(
  name,
  slug,
  short_description,
  image_url,
  sort_order,
  is_active
)
VALUES
(
  'Family & General Medicine',
  'family-general-medicine',
  'General consultations, preventive care, screening, rapid testing and healthcare services for individuals and families.',
  NULL,
  1,
  1
),
(
  'Women & Maternity Care',
  'womens-maternity-care',
  'Women''s health, pregnancy care, maternity monitoring, ultrasound and reproductive screening services.',
  NULL,
  2,
  1
),
(
  'Procedures & Minor Care',
  'procedures-minor-care',
  'Minor procedures, wound management and clinic-based treatments provided following medical assessment.',
  NULL,
  3,
  1
),
(
  'Wellness & Certification',
  'wellness-certification',
  'Medical wellness programmes, health screening, employment examinations and travel health services.',
  NULL,
  4,
  1
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  short_description = VALUES(short_description),
  sort_order = VALUES(sort_order),
  is_active = 1;

/* =========================================================
   Resolve category IDs
   ========================================================= */

SET @family_category_id = (
  SELECT id
  FROM service_categories
  WHERE slug = 'family-general-medicine'
  LIMIT 1
);

SET @women_category_id = (
  SELECT id
  FROM service_categories
  WHERE slug = 'womens-maternity-care'
  LIMIT 1
);

SET @procedures_category_id = (
  SELECT id
  FROM service_categories
  WHERE slug = 'procedures-minor-care'
  LIMIT 1
);

SET @wellness_category_id = (
  SELECT id
  FROM service_categories
  WHERE slug = 'wellness-certification'
  LIMIT 1
);

/* =========================================================
   Official subcategories
   ========================================================= */

INSERT INTO service_subcategories
(
  category_id,
  name,
  slug,
  short_description,
  image_url,
  sort_order,
  is_active
)
VALUES

/* Family & General Medicine */

(
  @family_category_id,
  'General Consultation',
  'general-consultation',
  NULL,
  NULL,
  1,
  1
),
(
  @family_category_id,
  'Vaccination & Preventive Care',
  'vaccination-preventive-care',
  NULL,
  NULL,
  2,
  1
),
(
  @family_category_id,
  'Blood Tests & Health Screening',
  'blood-tests-health-screening',
  NULL,
  NULL,
  3,
  1
),
(
  @family_category_id,
  'Infection & Rapid Tests',
  'infection-rapid-tests',
  NULL,
  NULL,
  4,
  1
),
(
  @family_category_id,
  'Child Health & Jaundice Screening',
  'child-health-jaundice-screening',
  NULL,
  NULL,
  5,
  1
),
(
  @family_category_id,
  'ECG & General Medical Checkup',
  'ecg-general-medical-checkup',
  NULL,
  NULL,
  6,
  1
),

/* Women & Maternity Care */

(
  @women_category_id,
  'Antenatal Care',
  'antenatal-care',
  NULL,
  NULL,
  1,
  1
),
(
  @women_category_id,
  'Pregnancy Ultrasound',
  'pregnancy-ultrasound',
  NULL,
  NULL,
  2,
  1
),
(
  @women_category_id,
  'NT & Detail Scan',
  'nt-detail-scan',
  NULL,
  NULL,
  3,
  1
),
(
  @women_category_id,
  'Gender Reveal Scan',
  'gender-reveal-scan',
  NULL,
  NULL,
  4,
  1
),
(
  @women_category_id,
  'Gynae Scan & Transvaginal Scan',
  'gynae-transvaginal-scan',
  NULL,
  NULL,
  5,
  1
),
(
  @women_category_id,
  'Pap Smear & Reproductive Screening',
  'pap-smear-reproductive-screening',
  NULL,
  NULL,
  6,
  1
),

/* Procedures & Minor Care */

(
  @procedures_category_id,
  'Wound Dressing',
  'wound-dressing',
  NULL,
  NULL,
  1,
  1
),
(
  @procedures_category_id,
  'Suturing & Suture Removal',
  'suturing-suture-removal',
  NULL,
  NULL,
  2,
  1
),
(
  @procedures_category_id,
  'Incision & Drainage',
  'incision-drainage',
  NULL,
  NULL,
  3,
  1
),
(
  @procedures_category_id,
  'Nail Bed Treatment',
  'nail-bed-treatment',
  NULL,
  NULL,
  4,
  1
),
(
  @procedures_category_id,
  'Ear, Eye & Sinus Wash',
  'ear-eye-sinus-wash',
  NULL,
  NULL,
  5,
  1
),
(
  @procedures_category_id,
  'Nebuliser, Asthma Treatment & Phlegm Suction',
  'nebuliser-asthma-phlegm-suction',
  NULL,
  NULL,
  6,
  1
),

/* Wellness & Certification */

(
  @wellness_category_id,
  'Medical Weight Management',
  'medical-weight-management',
  NULL,
  NULL,
  1,
  1
),
(
  @wellness_category_id,
  'InBody Body Composition Analysis',
  'inbody-body-composition-analysis',
  NULL,
  NULL,
  2,
  1
),
(
  @wellness_category_id,
  'Health Screening Packages',
  'health-screening-packages',
  NULL,
  NULL,
  3,
  1
),
(
  @wellness_category_id,
  'FOMEMA & Employment Medicals',
  'fomema-employment-medicals',
  NULL,
  NULL,
  4,
  1
),
(
  @wellness_category_id,
  'GDL & PSV Medical Examination',
  'gdl-psv-medical-examination',
  NULL,
  NULL,
  5,
  1
),
(
  @wellness_category_id,
  'Hajj, Umrah & Travel Health',
  'hajj-umrah-travel-health',
  NULL,
  NULL,
  6,
  1
)

ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_active = 1;

COMMIT;