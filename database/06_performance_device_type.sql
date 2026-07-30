SET @current_database = DATABASE();

SET @device_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @current_database
    AND TABLE_NAME = 'website_performance_events'
    AND COLUMN_NAME = 'device_type'
);

SET @add_device_column_sql = IF(
  @device_column_exists = 0,
  'ALTER TABLE website_performance_events
   ADD COLUMN device_type VARCHAR(20) NULL AFTER event_type',
  'SELECT ''device_type column already exists'''
);

PREPARE add_device_column_statement
FROM @add_device_column_sql;

EXECUTE add_device_column_statement;

DEALLOCATE PREPARE add_device_column_statement;


SET @device_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @current_database
    AND TABLE_NAME = 'website_performance_events'
    AND INDEX_NAME = 'idx_performance_device_type'
);

SET @add_device_index_sql = IF(
  @device_index_exists = 0,
  'CREATE INDEX idx_performance_device_type
   ON website_performance_events (device_type)',
  'SELECT ''device index already exists'''
);

PREPARE add_device_index_statement
FROM @add_device_index_sql;

EXECUTE add_device_index_statement;

DEALLOCATE PREPARE add_device_index_statement;