const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/bookings - public, patient submits an appointment request
router.post('/', async (req, res) => {
  try {
    const {
      branch_id, doctor_id, service_id,
      patient_name, phone, ic_number,
      preferred_date, preferred_time, reason,
    } = req.body;

    if (!branch_id || !patient_name || !phone || !preferred_date || !preferred_time) {
      return res.status(400).json({
        error: 'branch_id, patient_name, phone, preferred_date and preferred_time are required.',
      });
    }

    // Basic sanity checks
    const phonePattern = /^[0-9+\-\s]{7,20}$/;
    if (!phonePattern.test(phone)) {
      return res.status(400).json({ error: 'Please provide a valid phone number.' });
    }

    const requestedDate = new Date(`${preferred_date}T${preferred_time}`);
    if (isNaN(requestedDate.getTime()) || requestedDate < new Date()) {
      return res.status(400).json({ error: 'Preferred date/time must be a valid future date.' });
    }

    const [result] = await pool.query(
      `INSERT INTO bookings
        (branch_id, doctor_id, service_id, patient_name, phone, ic_number, preferred_date, preferred_time, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branch_id, doctor_id || null, service_id || null,
        patient_name, phone, ic_number || null,
        preferred_date, preferred_time, reason || null,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      message: 'Appointment request received. Our clinic will contact you to confirm.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit booking.' });
  }
});

// ---- Admin only ----

// GET /api/bookings?status=pending - list all bookings, optionally filtered
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT bk.*, b.name AS branch_name, d.name AS doctor_name, s.title AS service_title
      FROM bookings bk
      JOIN branches b ON b.id = bk.branch_id
      LEFT JOIN doctors d ON d.id = bk.doctor_id
      LEFT JOIN services s ON s.id = bk.service_id
    `;
    const params = [];
    if (status) {
      sql += ' WHERE bk.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY bk.preferred_date, bk.preferred_time';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

// PUT /api/bookings/:id/status  { status: 'confirmed' }
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }
    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Booking status updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update booking.' });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ message: 'Booking deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete booking.' });
  }
});

module.exports = router;
