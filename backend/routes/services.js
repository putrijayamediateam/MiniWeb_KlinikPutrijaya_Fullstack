const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/services - public, feeds the Services section + booking form dropdown
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM services WHERE is_active = 1 ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch services.' });
  }
});

// ---- Admin CRUD ----

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { category_key, kicker, title, description } = req.body;
    if (!category_key || !title) {
      return res.status(400).json({ error: 'category_key and title are required.' });
    }
    const [result] = await pool.query(
      'INSERT INTO services (category_key, kicker, title, description) VALUES (?, ?, ?, ?)',
      [category_key, kicker || null, title, description || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { category_key, kicker, title, description, is_active } = req.body;
    await pool.query(
      `UPDATE services SET
        category_key = COALESCE(?, category_key),
        kicker = COALESCE(?, kicker),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`,
      [category_key, kicker, title, description, is_active, req.params.id]
    );
    res.json({ message: 'Service updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ message: 'Service deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete service.' });
  }
});

module.exports = router;
