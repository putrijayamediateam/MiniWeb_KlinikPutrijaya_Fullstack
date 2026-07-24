'use strict';

require('dotenv').config();

const db = require('./db');

// Pastikan email ini betul sebelum jalankan.
const email = 'amniaqilah.putrijaya@gmail.com'
  .trim()
  .toLowerCase();

async function main() {
  const [accounts] = await db.query(
    `SELECT
       id,
       username,
       email,
       account_status,
       is_active
     FROM admins
     WHERE LOWER(TRIM(email)) = ?`,
    [email]
  );

  if (!accounts.length) {
    console.log('No matching account found. Nothing deleted.');
    return;
  }

  console.log('Account that will be deleted:');
  console.table(accounts);

  const [result] = await db.query(
    `DELETE FROM admins
     WHERE LOWER(TRIM(email)) = ?`,
    [email]
  );

  console.log(`Deleted account count: ${result.affectedRows}`);
}

main()
  .catch((error) => {
    console.error('Account deletion failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof db.end === 'function') {
      await db.end();
    }
  });