const express = require('express');
const pool = require('../db');
const {
  requireAdmin,
} = require('../middleware/auth');

const {
  requireActiveAdmin,
  requireManagementAccess,
} = require('../middleware/roles');

const router = express.Router();

function normaliseActive(
  value,
  defaultValue = 1
) {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return defaultValue;
  }

  if (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true'
  ) {
    return 1;
  }

  if (
    value === false ||
    value === 0 ||
    value === '0' ||
    value === 'false'
  ) {
    return 0;
  }

  return defaultValue;
}

// GET /api/promotions - public promotion carousel
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, badge, title, description, details, cta_label, cta_link, image_url, sort_order
      FROM promotions
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch promotions.' });
  }
});

// GET /api/promotions/admin/all - admin view
router.get(
  '/admin/all',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, badge, title, description, details, cta_label, cta_link, image_url, sort_order, is_active
      FROM promotions
      ORDER BY sort_order ASC, id ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load promotions.' });
  }
});

// POST /api/promotions
router.post(
  '/',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const {
      badge,
      title,
      description,
      details,
      cta_label,
      cta_link,
      image_url,
      sort_order,
      is_active,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO promotions (badge, title, description, details, cta_label, cta_link, image_url, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        badge || null,
        title,
        description || null,
        details || null,
        cta_label || null,
        cta_link || null,
        image_url || null,
        sort_order ?? 0,
        normaliseActive(is_active, 1),
      ]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create promotion.' });
  }
});

// PUT /api/promotions/:id
router.put(
  '/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    const {
      badge,
      title,
      description,
      details,
      cta_label,
      cta_link,
      image_url,
      sort_order,
      is_active,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    await pool.query(
      `UPDATE promotions SET
        badge = ?,
        title = ?,
        description = ?,
        details = ?,
        cta_label = ?,
        cta_link = ?,
        image_url = ?,
        sort_order = ?,
        is_active = ?
      WHERE id = ?`,
      [
        badge || null,
        title,
        description || null,
        details || null,
        cta_label || null,
        cta_link || null,
        image_url || null,
        sort_order ?? 0,
        normaliseActive(is_active, 1),
        req.params.id,
      ]
    );

    res.json({ message: 'Promotion updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update promotion.' });
  }
});

// DELETE /api/promotions/:id
router.delete(
  '/:id',
  requireAdmin,
  requireActiveAdmin,
  requireManagementAccess,
  async (req, res) => {
  try {
    await pool.query('DELETE FROM promotions WHERE id = ?', [req.params.id]);
    res.json({ message: 'Promotion deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete promotion.' });
  }
});

module.exports = router;
