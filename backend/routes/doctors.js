const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/doctors?branch=cheras&q=fatin
// Public: dynamic content for the "Resident Doctors" section + search/filter feature.
router.get('/', async (req, res) => {
  try {
    const { branch, q } = req.query;
    let sql = `
      SELECT d.*, b.name AS branch_name, b.slug AS branch_slug
      FROM doctors d
      JOIN branches b ON b.id = d.branch_id
      WHERE d.is_active = 1
    `;
    const params = [];

    if (branch) {
      sql += ' AND b.slug = ?';
      params.push(branch);
    }
    if (q) {
      sql += ' AND d.name LIKE ?';
      params.push(`%${q}%`);
    }
    sql += ' ORDER BY b.name, d.name';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch doctors.' });
  }
});

// ---- Admin CRUD (protected) ----

// POST /api/doctors
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { branch_id, name, qualification, reg_no, photo_url } = req.body;
    if (!branch_id || !name || !qualification || !reg_no) {
      return res.status(400).json({ error: 'branch_id, name, qualification and reg_no are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO doctors (branch_id, name, qualification, reg_no, photo_url) VALUES (?, ?, ?, ?, ?)',
      [branch_id, name, qualification, reg_no, photo_url || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create doctor.' });
  }
});

router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        d.*,
        b.name AS branch_name
      FROM doctors d
      LEFT JOIN branches b ON d.branch_id = b.id
      ORDER BY b.id ASC, d.name ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load admin doctors.' });
  }
});

// PUT /api/doctors/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { branch_id, name, qualification, reg_no, photo_url, is_active } = req.body;
    await pool.query(
      `UPDATE doctors SET
        branch_id = COALESCE(?, branch_id),
        name = COALESCE(?, name),
        qualification = COALESCE(?, qualification),
        reg_no = COALESCE(?, reg_no),
        photo_url = COALESCE(?, photo_url),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`,
      [branch_id, name, qualification, reg_no, photo_url, is_active, req.params.id]
    );
    res.json({ message: 'Doctor updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update doctor.' });
  }
});

// DELETE /api/doctors/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM doctors WHERE id = ?', [req.params.id]);
    res.json({ message: 'Doctor deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete doctor.' });
  }
});

module.exports = router;
