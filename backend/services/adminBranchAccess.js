'use strict';

const db = require('../db');

/*
  Branch-scoped booking access.

  An admin or manager with no admin_branch_access rows may see every
  branch (the behaviour before branch scoping existed). Superadmins
  always see every branch. A missing table means the migration has
  not been applied yet, so no account has restrictions.
*/

const MAX_BRANCHES_PER_ADMIN = 50;

function isMissingTableError(error) {
  return error?.code === 'ER_NO_SUCH_TABLE';
}

async function getAdminBranchIds(adminId) {
  try {
    const [rows] = await db.query(
      `SELECT branch_id
       FROM admin_branch_access
       WHERE admin_id = ?
       ORDER BY branch_id`,
      [adminId]
    );

    return rows.map((row) => Number(row.branch_id));
  } catch (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }
}

/**
 * Branch IDs the admin may see bookings for, or null when the admin
 * may see every branch. Expects req.admin from requireActiveAdmin.
 */
async function getBookingBranchScope(admin) {
  if (String(admin?.role || '').toLowerCase() === 'superadmin') {
    return null;
  }

  const branchIds = await getAdminBranchIds(admin.id);

  return branchIds.length ? branchIds : null;
}

/**
 * Map of admin ID to assigned branch IDs, for the user list.
 */
async function getBranchIdsByAdmin() {
  const byAdmin = new Map();

  try {
    const [rows] = await db.query(
      `SELECT admin_id, branch_id
       FROM admin_branch_access
       ORDER BY admin_id, branch_id`
    );

    rows.forEach((row) => {
      const adminId = Number(row.admin_id);

      if (!byAdmin.has(adminId)) {
        byAdmin.set(adminId, []);
      }

      byAdmin.get(adminId).push(Number(row.branch_id));
    });
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }

  return byAdmin;
}

/**
 * Parse a request value into unique positive branch IDs.
 * Returns null when the value is not a valid list.
 */
function parseBranchIds(value) {
  if (!Array.isArray(value) || value.length > MAX_BRANCHES_PER_ADMIN) {
    return null;
  }

  const ids = value.map(Number);

  if (!ids.every((id) => Number.isInteger(id) && id > 0)) {
    return null;
  }

  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Replace the admin's branch list. An empty list restores access to
 * every branch.
 */
async function setAdminBranchIds(adminId, branchIds) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      'DELETE FROM admin_branch_access WHERE admin_id = ?',
      [adminId]
    );

    if (branchIds.length) {
      await connection.query(
        'INSERT INTO admin_branch_access (admin_id, branch_id) VALUES ?',
        [branchIds.map((branchId) => [adminId, branchId])]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getAdminBranchIds,
  getBookingBranchScope,
  getBranchIdsByAdmin,
  isMissingTableError,
  parseBranchIds,
  setAdminBranchIds,
};
