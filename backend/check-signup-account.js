'use strict';

require('dotenv').config();

const db = require('./db');

// Tukar kepada email yang bermasalah.
const email = 'amniaqilah.putrijaya@gmail.com'
  .trim()
  .toLowerCase();

async function main() {
  const [[databaseInfo]] = await db.query(`
    SELECT
      DATABASE() AS database_name,
      @@hostname AS database_host,
      @@port AS database_port
  `);

  const [accounts] = await db.query(
    `SELECT
       id,
       username,
       email,
       account_status,
       is_active,
       email_verified_at,
       email_verification_expires_at
     FROM admins
     WHERE LOWER(TRIM(email)) = ?
     LIMIT 10`,
    [email]
  );

  console.log('\nDatabase used by backend:');
  console.table([databaseInfo]);

  console.log('\nMatching admin account:');

  if (!accounts.length) {
    console.log('No matching account found.');
    return;
  }

  console.table(accounts);
}

main()
  .catch((error) => {
    console.error('Account check failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof db.end === 'function') {
      await db.end();
    }
  });