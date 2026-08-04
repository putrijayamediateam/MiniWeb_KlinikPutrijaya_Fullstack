'use strict';

const db = require('../db');

const VALID_ROLES = new Set([
  'admin',
  'manager',
  'superadmin',
]);

function normalizeRole(value) {
  const role = String(
    value || 'admin'
  )
    .trim()
    .toLowerCase();

  return VALID_ROLES.has(role)
    ? role
    : 'admin';
}

/**
 * Load the latest administrator record from
 * the database and verify that the account
 * is active.
 *
 * Use requireAdmin before this middleware.
 */
async function requireActiveAdmin(
  req,
  res,
  next
) {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({
        message:
          'Authentication is required.',
      });
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          username,
          email,
          role,
          account_status,
          is_active,
          auth_provider,
          last_login_at
        FROM admins
        WHERE id = ?
        LIMIT 1
      `,
      [req.admin.id]
    );

    const admin = rows[0];

    if (!admin) {
      return res.status(401).json({
        message:
          'Administrator account was not found.',
      });
    }

    const accountStatus =
      String(
        admin.account_status || ''
      )
        .trim()
        .toLowerCase();

    if (
      Number(admin.is_active) !== 1 ||
      accountStatus !== 'active'
    ) {
      return res.status(403).json({
        message:
          'This administrator account is not active.',
      });
    }

    admin.role =
      normalizeRole(admin.role);

    /*
      Replace JWT data with the latest
      database values.
    */
    req.admin = admin;

    return next();
  } catch (error) {
    console.error(
      'Active admin authorization error:',
      error
    );

    return res.status(500).json({
      message:
        'Unable to verify administrator access.',
    });
  }
}

/**
 * Allow only selected roles.
 *
 * Example:
 * requireRole('manager', 'superadmin')
 */
function requireRole(...allowedRoles) {
  const normalizedAllowed =
    allowedRoles.map(normalizeRole);

  return function roleMiddleware(
    req,
    res,
    next
  ) {
    const currentRole =
      normalizeRole(
        req.admin?.role
      );

    if (
      !normalizedAllowed.includes(
        currentRole
      )
    ) {
      return res.status(403).json({
        message:
          'You do not have permission to access this function.',
      });
    }

    return next();
  };
}

/**
 * Bookings:
 * admin, manager and superadmin may view/edit.
 */
const requireBookingAccess =
  requireRole(
    'admin',
    'manager',
    'superadmin'
  );

/**
 * Performance:
 * admin, manager and superadmin may view.
 */
const requirePerformanceAccess =
  requireRole(
    'admin',
    'manager',
    'superadmin'
  );

/**
 * Operational management modules:
 * manager and superadmin only.
 */
const requireManagementAccess =
  requireRole(
    'manager',
    'superadmin'
  );

/**
 * User approval and role management:
 * superadmin only.
 */
const requireSuperadminRole =
  requireRole('superadmin');

module.exports = {
  VALID_ROLES,
  normalizeRole,
  requireActiveAdmin,
  requireRole,
  requireBookingAccess,
  requirePerformanceAccess,
  requireManagementAccess,
  requireSuperadminRole,
};