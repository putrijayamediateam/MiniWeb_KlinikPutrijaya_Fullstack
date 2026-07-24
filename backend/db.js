'use strict';

const mysql = require('mysql2/promise');

const isProduction =
  process.env.NODE_ENV === 'production';

/**
 * Read an environment variable.
 *
 * During production, required database variables must exist.
 * During development, local fallback values are permitted.
 */
function getDatabaseValue(name, developmentFallback = '') {
  const value = String(process.env[name] ?? '').trim();

  if (value) {
    return value;
  }

  if (isProduction) {
    throw new Error(
      `${name} is required when NODE_ENV=production.`
    );
  }

  return developmentFallback;
}

/**
 * Convert an environment variable into a valid positive number.
 */
function getPositiveNumber(name, fallback) {
  const rawValue = process.env[name];

  if (
    rawValue === undefined ||
    rawValue === null ||
    String(rawValue).trim() === ''
  ) {
    return fallback;
  }

  const numberValue = Number(rawValue);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    throw new Error(
      `${name} must be a positive number.`
    );
  }

  return numberValue;
}

const poolOptions = {
  host: getDatabaseValue(
    'DB_HOST',
    'localhost'
  ),

  port: getPositiveNumber(
    'DB_PORT',
    3306
  ),

  user: getDatabaseValue(
    'DB_USER',
    'root'
  ),

  password: getDatabaseValue(
    'DB_PASSWORD',
    ''
  ),

  database: getDatabaseValue(
    'DB_NAME',
    'klinik_putrijaya'
  ),

  waitForConnections: true,

  connectionLimit: getPositiveNumber(
    'DB_CONNECTION_LIMIT',
    10
  ),

  queueLimit: 0,

  /*
    Preserve DATE and DATETIME values as strings instead of
    automatically converting them into JavaScript Date objects.
  */
  dateStrings: true,

  charset: 'utf8mb4',

  /*
    Keep pooled TCP connections alive when supported.
  */
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

/* =========================================================
   Optional database SSL
   ========================================================= */

/*
  Local MariaDB and Railway's private database connection
  will initially use DB_SSL=false.

  For another provider that requires TLS, set:
  DB_SSL=true
  DB_SSL_CA=<provider certificate>
*/
const databaseSslEnabled =
  String(process.env.DB_SSL || '')
    .trim()
    .toLowerCase() === 'true';

if (databaseSslEnabled) {
  const caCertificate = String(
    process.env.DB_SSL_CA || ''
  )
    .replaceAll('\\n', '\n')
    .trim();

  poolOptions.ssl = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  };

  if (caCertificate) {
    poolOptions.ssl.ca = caCertificate;
  }
}

const pool = mysql.createPool(poolOptions);

module.exports = pool;