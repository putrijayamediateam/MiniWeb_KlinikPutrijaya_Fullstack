'use strict';

const db = require('../db');

async function requireSuperAdmin(req, res, next) {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ message: 'Authentication is required.' });
    }

    const [rows] = await db.query(
      `SELECT id, username, email, role, account_status, is_active
       FROM admins
       WHERE id = ?
       LIMIT 1`,
      [req.admin.id]
    );

    const admin = rows[0];

    if (
      !admin ||
      Number(admin.is_active) !== 1 ||
      String(admin.account_status || '') !== 'active'
    ) {
      return res.status(403).json({ message: 'This administrator account is not active.' });
    }

    if (String(admin.role || '').toLowerCase() !== 'superadmin') {
      return res.status(403).json({ message: 'Superadmin access is required.' });
    }

    req.superadmin = admin;
    return next();
  } catch (error) {
    console.error('Superadmin authorization error:', error);
    return res.status(500).json({ message: 'Unable to verify superadmin access.' });
  }
}

module.exports = { requireSuperAdmin };
