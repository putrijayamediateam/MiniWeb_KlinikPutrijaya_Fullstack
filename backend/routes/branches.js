const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/branches - list all branches (used to populate booking form dropdown)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM branches ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch branches.' });
  }
});

module.exports = router;
