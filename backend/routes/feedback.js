const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/feedback - public, patient submits feedback (goes into moderation queue)
router.post('/', async (req, res) => {
  try {
    const { branch_id, patient_name, rating, message } = req.body;

    if (!patient_name || !rating || !message) {
      return res.status(400).json({ error: 'patient_name, rating and message are required.' });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
    }

    const [result] = await pool.query(
      'INSERT INTO feedback (branch_id, patient_name, rating, message) VALUES (?, ?, ?, ?)',
      [branch_id || null, patient_name, ratingNum, message]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Thank you! Your feedback has been submitted and will appear after review.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
});

// GET /api/feedback - public, only approved feedback (for display on the site)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.patient_name, f.rating, f.message, f.created_at, b.name AS branch_name
       FROM feedback f
       LEFT JOIN branches b ON b.id = f.branch_id
       WHERE f.is_approved = 1
       ORDER BY f.created_at DESC
       LIMIT 20`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch feedback.' });
  }
});

// ---- Admin moderation ----

// GET /api/feedback/all - admin sees pending + approved
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, b.name AS branch_name
       FROM feedback f
       LEFT JOIN branches b ON b.id = f.branch_id
       ORDER BY f.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch feedback.' });
  }
});

// PUT /api/feedback/:id/approve
router.put('/:id/approve', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE feedback SET is_approved = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Feedback approved and now visible on the site.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve feedback.' });
  }
});

// DELETE /api/feedback/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM feedback WHERE id = ?', [req.params.id]);
    res.json({ message: 'Feedback deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete feedback.' });
  }
});

module.exports = router;
