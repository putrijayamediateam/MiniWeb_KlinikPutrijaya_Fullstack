USE klinik_putrijaya;

ALTER TABLE bookings
  ADD COLUMN gender VARCHAR(10) NULL
    AFTER patient_name,
  ADD COLUMN identity_type VARCHAR(20) NULL
    AFTER phone,
  ADD COLUMN identity_number VARCHAR(50) NULL
    AFTER identity_type;

UPDATE bookings
SET
  identity_type = 'ic',
  identity_number = NULLIF(
    TRIM(ic_number),
    ''
  )
WHERE
  NULLIF(TRIM(ic_number), '') IS NOT NULL
  AND (
    identity_type IS NULL
    OR identity_number IS NULL
  );