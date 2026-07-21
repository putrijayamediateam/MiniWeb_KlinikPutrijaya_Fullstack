// ============================================================
// Klinik Putrijaya - Services API
// ============================================================

const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ------------------------------------------------------------
// Public services
// GET /api/services
// ------------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        category_key,
        kicker,
        title,
        description,
        details,
        sort_order,
        is_active
      FROM services
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Fetch public services error:', error);

    res.status(500).json({
      error: 'Failed to fetch services.',
    });
  }
});

// ------------------------------------------------------------
// Admin: Get all services, including inactive
// GET /api/services/admin/all
// ------------------------------------------------------------

router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id,
        category_key,
        kicker,
        title,
        description,
        details,
        sort_order,
        is_active,
        created_at
      FROM services
      ORDER BY sort_order ASC, id ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Fetch admin services error:', error);

    res.status(500).json({
      error: 'Failed to fetch admin services.',
    });
  }
});

// ------------------------------------------------------------
// Admin: Create service category
// POST /api/services
// ------------------------------------------------------------

router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      category_key,
      kicker,
      title,
      description,
      details,
      sort_order,
      is_active,
    } = req.body;

    const cleanCategoryKey = String(category_key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    const cleanTitle = String(title || '').trim();

    if (!cleanCategoryKey || !cleanTitle) {
      return res.status(400).json({
        error: 'Category key and title are required.',
      });
    }

    const [existingRows] = await pool.query(
      `
        SELECT id
        FROM services
        WHERE category_key = ?
        LIMIT 1
      `,
      [cleanCategoryKey]
    );

    if (existingRows.length) {
      return res.status(409).json({
        error: 'A service category with this category key already exists.',
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO services (
          category_key,
          kicker,
          title,
          description,
          details,
          sort_order,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        cleanCategoryKey,
        String(kicker || '').trim() || null,
        cleanTitle,
        String(description || '').trim() || null,
        String(details || '').trim() || null,
        Number(sort_order) || 0,
        Number(is_active) === 0 ? 0 : 1,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Service category created.',
    });
  } catch (error) {
    console.error('Create service error:', error);

    res.status(500).json({
      error: 'Failed to create service.',
    });
  }
});

// ------------------------------------------------------------
// Admin: Update service category
// PUT /api/services/:id
// ------------------------------------------------------------

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const serviceId = Number(req.params.id);

    const {
      category_key,
      kicker,
      title,
      description,
      details,
      sort_order,
      is_active,
    } = req.body;

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({
        error: 'Invalid service ID.',
      });
    }

    const cleanCategoryKey = String(category_key || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    const cleanTitle = String(title || '').trim();

    if (!cleanCategoryKey || !cleanTitle) {
      return res.status(400).json({
        error: 'Category key and title are required.',
      });
    }

    const [duplicateRows] = await pool.query(
      `
        SELECT id
        FROM services
        WHERE category_key = ?
          AND id <> ?
        LIMIT 1
      `,
      [cleanCategoryKey, serviceId]
    );

    if (duplicateRows.length) {
      return res.status(409).json({
        error: 'Another service category already uses this category key.',
      });
    }

    const [result] = await pool.query(
      `
        UPDATE services
        SET
          category_key = ?,
          kicker = ?,
          title = ?,
          description = ?,
          details = ?,
          sort_order = ?,
          is_active = ?
        WHERE id = ?
      `,
      [
        cleanCategoryKey,
        String(kicker || '').trim() || null,
        cleanTitle,
        String(description || '').trim() || null,
        String(details || '').trim() || null,
        Number(sort_order) || 0,
        Number(is_active) === 1 ? 1 : 0,
        serviceId,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        error: 'Service category not found.',
      });
    }

    res.json({
      message: 'Service category updated.',
    });
  } catch (error) {
    console.error('Update service error:', error);

    res.status(500).json({
      error: 'Failed to update service.',
    });
  }
});

// ------------------------------------------------------------
// Admin: Delete service category
// DELETE /api/services/:id
// ------------------------------------------------------------

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const serviceId = Number(req.params.id);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({
        error: 'Invalid service ID.',
      });
    }

    const [result] = await pool.query(
      'DELETE FROM services WHERE id = ?',
      [serviceId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        error: 'Service category not found.',
      });
    }

    res.json({
      message: 'Service category deleted.',
    });
  } catch (error) {
    console.error('Delete service error:', error);

    res.status(500).json({
      error: 'Failed to delete service.',
    });
  }
});

module.exports = router;