'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/superadmin');

const router = express.Router();

router.get('/me', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, email, role, account_status, is_active, auth_provider,
              email_verified_at, approved_at, last_login_at
       FROM admins
       WHERE id = ?
       LIMIT 1`,
      [req.admin.id]
    );

    const admin = rows[0];
    if (!admin) {
      return res.status(404).json({ message: 'Administrator account was not found.' });
    }

    return res.json(admin);
  } catch (error) {
    console.error('Read admin profile error:', error);
    return res.status(500).json({ message: 'Unable to load administrator profile.' });
  }
});

router.use(requireAdmin, requireSuperAdmin);

router.get('/pending', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, email, auth_provider, role, account_status,
              email_verified_at, created_at
       FROM admins
       WHERE account_status = 'pending_approval'
         AND is_active = 0
       ORDER BY COALESCE(email_verified_at, created_at) ASC, id ASC`
    );

    return res.json({ data: rows, total: rows.length });
  } catch (error) {
    console.error('Load pending admins error:', error);
    return res.status(500).json({ message: 'Unable to load pending administrator accounts.' });
  }
});

router.put('/:id/approve', async (req, res) => {
  const connection = await db.getConnection();

  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ message: 'A valid administrator ID is required.' });
    }

    if (targetId === Number(req.superadmin.id)) {
      return res.status(400).json({ message: 'You cannot approve your own account.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, email, role, account_status, is_active, email_verified_at
       FROM admins
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [targetId]
    );

    const target = rows[0];
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ message: 'Administrator account was not found.' });
    }

    if (String(target.role || '').toLowerCase() === 'superadmin') {
      await connection.rollback();
      return res.status(400).json({ message: 'A superadmin account cannot be approved through this screen.' });
    }

    if (String(target.account_status) !== 'pending_approval') {
      await connection.rollback();
      return res.status(409).json({ message: 'This account is no longer waiting for approval.' });
    }

    if (!target.email_verified_at) {
      await connection.rollback();
      return res.status(409).json({ message: 'The email address must be verified before approval.' });
    }

    await connection.query(
      `UPDATE admins
       SET account_status = 'active',
           is_active = 1,
           role = 'admin',
           approved_by = ?,
           approved_at = NOW(),
           rejection_reason = NULL
       WHERE id = ?`,
      [req.superadmin.id, targetId]
    );

    await connection.commit();

    return res.json({
      message: `${target.email} has been approved and may now log in.`,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Approve admin error:', error);
    return res.status(500).json({ message: 'Unable to approve this administrator account.' });
  } finally {
    connection.release();
  }
});

router.put('/:id/reject', async (req, res) => {
  const connection = await db.getConnection();

  try {
    const targetId = Number(req.params.id);
    const reason = String(req.body.reason || '').trim().slice(0, 255);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ message: 'A valid administrator ID is required.' });
    }

    if (targetId === Number(req.superadmin.id)) {
      return res.status(400).json({ message: 'You cannot reject your own account.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, email, role, account_status
       FROM admins
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [targetId]
    );

    const target = rows[0];
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ message: 'Administrator account was not found.' });
    }

    if (String(target.role || '').toLowerCase() === 'superadmin') {
      await connection.rollback();
      return res.status(400).json({ message: 'A superadmin account cannot be rejected.' });
    }

    if (String(target.account_status) !== 'pending_approval') {
      await connection.rollback();
      return res.status(409).json({ message: 'This account is no longer waiting for approval.' });
    }

    await connection.query(
      `UPDATE admins
       SET account_status = 'rejected',
           is_active = 0,
           approved_by = ?,
           approved_at = NOW(),
           rejection_reason = ?
       WHERE id = ?`,
      [req.superadmin.id, reason || null, targetId]
    );

    await connection.commit();

    return res.json({ message: `${target.email} has been rejected.` });
  } catch (error) {
    await connection.rollback();
    console.error('Reject admin error:', error);
    return res.status(500).json({ message: 'Unable to reject this administrator account.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
