'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function parsePagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 200);
  return { page, limit, offset: (page - 1) * limit };
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         f.id,
         f.patient_name,
         f.rating,
         f.message,
         f.created_at,
         b.name AS branch_name
       FROM feedback f
       LEFT JOIN branches b ON b.id = f.branch_id
       WHERE f.is_approved = 1
       ORDER BY f.created_at DESC, f.id DESC`
    );
    return res.json(rows);
  } catch (error) {
    console.error('Public feedback error:', error);
    return res.status(500).json({ message: 'Unable to load feedback.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const patientName = String(req.body.patient_name || '').trim();
    const branchId = req.body.branch_id ? Number(req.body.branch_id) : null;
    const rating = Number(req.body.rating);
    const message = String(req.body.message || '').trim();

    if (!patientName || !branchId || !message || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Name, branch, rating and feedback message are required.',
      });
    }

    const [result] = await db.query(
      `INSERT INTO feedback
       (patient_name, branch_id, rating, message, is_approved)
       VALUES (?, ?, ?, ?, 0)`,
      [patientName, branchId, rating, message]
    );

    return res.status(201).json({
      message: 'Thank you. Your feedback will appear after review.',
      id: result.insertId,
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    return res.status(500).json({ message: 'Unable to submit feedback.' });
  }
});

async function adminListHandler(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const conditions = [];
    const params = [];

    if (req.query.status === 'approved') {
      conditions.push('f.is_approved = 1');
    } else if (req.query.status === 'pending') {
      conditions.push('f.is_approved = 0');
    }

    if (req.query.q) {
      const q = `%${String(req.query.q).trim()}%`;
      conditions.push('(f.patient_name LIKE ? OR f.message LIKE ? OR b.name LIKE ?)');
      params.push(q, q, q);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT
         f.id,
         f.patient_name,
         f.branch_id,
         f.rating,
         f.message,
         f.is_approved,
         f.created_at,
         b.name AS branch_name
       FROM feedback f
       LEFT JOIN branches b ON b.id = f.branch_id
       ${whereSql}
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM feedback f
       LEFT JOIN branches b ON b.id = f.branch_id
       ${whereSql}`,
      params
    );

    const total = Number(countRows[0].total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error('Admin feedback error:', error);
    return res.status(500).json({ message: 'Unable to load feedback.' });
  }
}

router.get('/admin/all', requireAdmin, adminListHandler);
router.get('/admin', requireAdmin, adminListHandler);
router.get('/all', requireAdmin, adminListHandler);

router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query(
      'UPDATE feedback SET is_approved = 1 WHERE id = ?',
      [Number(req.params.id)]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Feedback not found.' });
    }

    return res.json({ message: 'Feedback approved.' });
  } catch (error) {
    console.error('Approve feedback error:', error);
    return res.status(500).json({ message: 'Unable to approve feedback.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM feedback WHERE id = ?', [Number(req.params.id)]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Feedback not found.' });
    }
    return res.json({ message: 'Feedback deleted.' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    return res.status(500).json({ message: 'Unable to delete feedback.' });
  }
});

module.exports = router;
