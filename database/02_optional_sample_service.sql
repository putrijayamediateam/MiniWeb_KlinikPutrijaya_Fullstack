USE klinik_putrijaya;

-- OPTIONAL SAMPLE ONLY.
-- Edit names/descriptions/prices before running. Do not run if you already have service records.

INSERT INTO services
(category_key, slug, kicker, title, description, full_description, suitable_for,
 included_items, preparation, aftercare, hero_image_url, sort_order, is_active)
VALUES
(
  'women',
  'anomaly-scan',
  'Pregnancy Scan',
  'Anomaly Scan',
  'A detailed pregnancy scan usually performed during the second trimester.',
  'The anomaly scan reviews selected fetal structures and growth markers. The doctor will explain the findings and advise whether further assessment is needed.',
  'Pregnant mothers who have been advised to arrange a detailed fetal assessment.\nPatients should follow the timing recommended by their doctor.',
  'Ultrasound assessment\nDoctor explanation\nPrinted or digital report where applicable',
  'Bring previous antenatal records and scan reports. Follow any branch-specific preparation instructions.',
  'Keep the report for your antenatal follow-up. Seek medical attention if you have pain, bleeding or other urgent symptoms.',
  NULL,
  10,
  1
)
ON DUPLICATE KEY UPDATE title = VALUES(title);

SET @service_id = (SELECT id FROM services WHERE slug = 'anomaly-scan' LIMIT 1);

INSERT INTO service_prices
(service_id, package_name, package_description, price, original_price, sort_order, is_active)
SELECT @service_id, 'Anomaly Scan', 'Replace this sample price with the clinic-approved price.', 0.00, NULL, 1, 1
WHERE @service_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM service_prices WHERE service_id = @service_id
  );
