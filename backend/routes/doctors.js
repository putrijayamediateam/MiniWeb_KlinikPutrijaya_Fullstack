'use strict';

const express = require('express');
const db = require('../db');
const {
  requireAdmin,
} = require('../middleware/auth');

const {
  requireActiveAdmin,
  requireManagementAccess,
} = require('../middleware/roles');

const router = express.Router();

function toActive(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  return Number(value) === 1 ? 1 : 0;
}

router.get('/', async (req, res) => {
  try {
    const conditions = ['d.is_active = 1'];
    const params = [];

    if (req.query.q) {
      conditions.push('(d.name LIKE ? OR d.qualification LIKE ? OR d.reg_no LIKE ?)');
      const search = `%${String(req.query.q).trim()}%`;
      params.push(search, search, search);
    }

    if (req.query.branch) {
      const branch = String(req.query.branch).trim();
      if (/^\d+$/.test(branch)) {
        conditions.push('d.branch_id = ?');
        params.push(Number(branch));
      } else {
        conditions.push('b.name = ?');
        params.push(branch);
      }
    }

    const [rows] = await db.query(
      `SELECT
         d.id,
         d.branch_id,
         b.name AS branch_name,
         d.name,
         d.qualification,
         d.reg_no,
         d.photo_url,
         d.is_active
       FROM doctors d
       INNER JOIN branches b ON b.id = d.branch_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY b.id, d.name`,
      params
    );

    return res.json(rows);
  } catch (error) {
    console.error('Public doctors error:', error);
    return res.status(500).json({ message: 'Unable to load doctors.' });
  }
});

router.get(
  '/admin/all',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         d.id,
         d.branch_id,
         b.name AS branch_name,
         d.name,
         d.qualification,
         d.reg_no,
         d.photo_url,
         d.is_active
       FROM doctors d
       INNER JOIN branches b ON b.id = d.branch_id
       ORDER BY b.id, d.name`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Admin doctors error:', error);
    return res.status(500).json({ message: 'Unable to load doctors.' });
  }
});

router.post(
  '/',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const branchId = Number(req.body.branch_id);
    const name = String(req.body.name || '').trim();
    const qualification = String(req.body.qualification || '').trim();
    const regNo = String(req.body.reg_no || '').trim();
    const photoUrl = String(req.body.photo_url || '').trim() || null;
    const isActive = toActive(req.body.is_active, 1);

    if (!branchId || !name || !qualification || !regNo) {
      return res.status(400).json({
        message: 'Branch, name, qualification and registration number are required.',
      });
    }

    const [result] = await db.query(
      `INSERT INTO doctors
       (branch_id, name, qualification, reg_no, photo_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [branchId, name, qualification, regNo, photoUrl, isActive]
    );

    return res.status(201).json({
      message: 'Doctor created successfully.',
      id: result.insertId,
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    return res.status(500).json({ message: 'Unable to create doctor.' });
  }
});

router.put(
  '/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const id = Number(req.params.id);
    const branchId = Number(req.body.branch_id);
    const name = String(req.body.name || '').trim();
    const qualification = String(req.body.qualification || '').trim();
    const regNo = String(req.body.reg_no || '').trim();
    const photoUrl = String(req.body.photo_url || '').trim() || null;
    const isActive = toActive(req.body.is_active, 1);

    if (!id || !branchId || !name || !qualification || !regNo) {
      return res.status(400).json({ message: 'Invalid doctor information.' });
    }

    const [result] = await db.query(
      `UPDATE doctors
       SET branch_id = ?, name = ?, qualification = ?, reg_no = ?, photo_url = ?, is_active = ?
       WHERE id = ?`,
      [branchId, name, qualification, regNo, photoUrl, isActive, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }

    return res.json({ message: 'Doctor updated successfully.' });
  } catch (error) {
    console.error('Update doctor error:', error);
    return res.status(500).json({ message: 'Unable to update doctor.' });
  }
});

router.delete(
  '/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [result] = await db.query('DELETE FROM doctors WHERE id = ?', [id]);

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Doctor not found.' });
    }

    return res.json({ message: 'Doctor deleted successfully.' });
  } catch (error) {
    console.error('Delete doctor error:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        message: 'This doctor is linked to bookings. Set the doctor as inactive instead of deleting.',
      });
    }

    return res.status(500).json({ message: 'Unable to delete doctor.' });
  }
});

module.exports = router;
