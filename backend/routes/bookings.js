'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { sendBookingConfirmation: sendEmailConfirmation } = require('../services/emailService');
const { sendBookingConfirmation: sendSmsConfirmation } = require('../services/smsService');

const router = express.Router();
const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled']);

function parsePagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 500);
  return { page, limit, offset: (page - 1) * limit };
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function buildAdminFilters(query) {
  const conditions = [];
  const params = [];

  if (query.status && allowedStatuses.has(String(query.status))) {
    conditions.push('bk.status = ?');
    params.push(String(query.status));
  }

  if (query.branch) {
    const branch = String(query.branch).trim();
    if (/^\d+$/.test(branch)) {
      conditions.push('bk.branch_id = ?');
      params.push(Number(branch));
    } else {
      conditions.push('b.name = ?');
      params.push(branch);
    }
  }

  if (query.q) {
    const q = `%${String(query.q).trim()}%`;
    conditions.push(`(
      bk.patient_name LIKE ? OR
      bk.phone LIKE ? OR
      bk.email LIKE ? OR
      bk.reason LIKE ? OR
      b.name LIKE ? OR
      d.name LIKE ? OR
      s.title LIKE ?
    )`);
    params.push(q, q, q, q, q, q, q);
  }

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

router.post('/', async (req, res) => {
  try {
    const branchId = Number(req.body.branch_id);
    const doctorId = req.body.doctor_id ? Number(req.body.doctor_id) : null;
    const serviceId = req.body.service_id ? Number(req.body.service_id) : null;
    const patientName = String(req.body.patient_name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = cleanText(req.body.email);
    const icNumber = cleanText(req.body.ic_number);
    const preferredDate = String(req.body.preferred_date || '').trim();
    const preferredTime = String(req.body.preferred_time || '').trim();
    const reason = cleanText(req.body.reason);

    if (!branchId || !patientName || !phone || !preferredDate || !preferredTime) {
      return res.status(400).json({
        message: 'Branch, patient name, phone, preferred date and preferred time are required.',
      });
    }

    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    const [result] = await db.query(
      `INSERT INTO bookings
       (branch_id, doctor_id, service_id, patient_name, phone, email, ic_number,
        preferred_date, preferred_time, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        branchId,
        doctorId,
        serviceId,
        patientName,
        phone,
        email,
        icNumber,
        preferredDate,
        preferredTime,
        reason,
      ]
    );

    return res.status(201).json({
      message: 'Appointment request sent successfully.',
      id: result.insertId,
      reference: `KP-APT-${String(result.insertId).padStart(5, '0')}`,
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return res.status(500).json({ message: 'Unable to create booking.' });
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const { whereSql, params } = buildAdminFilters(req.query);

    const [rows] = await db.query(
      `SELECT
         bk.id,
         bk.branch_id,
         bk.doctor_id,
         bk.service_id,
         bk.patient_name,
         bk.phone,
         bk.email,
         bk.ic_number,
         bk.preferred_date,
         bk.preferred_time,
         bk.reason,
         bk.status,
         bk.confirmation_email_sent_at,
         bk.confirmation_sms_sent_at,
         bk.notification_error,
         bk.created_at,
         b.name AS branch_name,
         d.name AS doctor_name,
         s.title AS service_title
       FROM bookings bk
       INNER JOIN branches b ON b.id = bk.branch_id
       LEFT JOIN doctors d ON d.id = bk.doctor_id
       LEFT JOIN services s ON s.id = bk.service_id
       ${whereSql}
       ORDER BY bk.created_at DESC, bk.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
       FROM bookings bk
       INNER JOIN branches b ON b.id = bk.branch_id
       LEFT JOIN doctors d ON d.id = bk.doctor_id
       LEFT JOIN services s ON s.id = bk.service_id
       ${whereSql}`,
      params
    );

    const [summaryRows] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'pending') AS pending,
         SUM(status = 'confirmed') AS confirmed,
         SUM(status = 'completed') AS completed,
         SUM(status = 'cancelled') AS cancelled
       FROM bookings`
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
      summary: {
        total: Number(summaryRows[0].total || 0),
        pending: Number(summaryRows[0].pending || 0),
        confirmed: Number(summaryRows[0].confirmed || 0),
        completed: Number(summaryRows[0].completed || 0),
        cancelled: Number(summaryRows[0].cancelled || 0),
      },
    });
  } catch (error) {
    console.error('Admin bookings error:', error);
    return res.status(500).json({ message: 'Unable to load bookings.' });
  }
});

router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const newStatus = String(req.body.status || '').trim();

    if (!id || !allowedStatuses.has(newStatus)) {
      return res.status(400).json({ message: 'A valid booking status is required.' });
    }

    const [rows] = await db.query(
      `SELECT
         bk.*,
         b.name AS branch_name,
         d.name AS doctor_name,
         s.title AS service_title
       FROM bookings bk
       INNER JOIN branches b ON b.id = bk.branch_id
       LEFT JOIN doctors d ON d.id = bk.doctor_id
       LEFT JOIN services s ON s.id = bk.service_id
       WHERE bk.id = ?
       LIMIT 1`,
      [id]
    );

    const booking = rows[0];
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    const oldStatus = booking.status;
    await db.query('UPDATE bookings SET status = ? WHERE id = ?', [newStatus, id]);

    const notification = {
      email: { sent: false, reason: 'not_triggered' },
      sms: { sent: false, reason: 'not_triggered' },
    };

    if (oldStatus !== 'confirmed' && newStatus === 'confirmed') {
      const [emailResult, smsResult] = await Promise.allSettled([
        sendEmailConfirmation(booking),
        sendSmsConfirmation(booking),
      ]);

      const errors = [];

      if (emailResult.status === 'fulfilled') {
        notification.email = emailResult.value;
        if (emailResult.value.sent) {
          await db.query(
            'UPDATE bookings SET confirmation_email_sent_at = NOW() WHERE id = ?',
            [id]
          );
        }
      } else {
        notification.email = { sent: false, reason: 'send_failed' };
        errors.push(`Email: ${emailResult.reason?.message || 'Unknown error'}`);
      }

      if (smsResult.status === 'fulfilled') {
        notification.sms = smsResult.value;
        if (smsResult.value.sent) {
          await db.query(
            'UPDATE bookings SET confirmation_sms_sent_at = NOW() WHERE id = ?',
            [id]
          );
        }
      } else {
        notification.sms = { sent: false, reason: 'send_failed' };
        errors.push(`SMS: ${smsResult.reason?.message || 'Unknown error'}`);
      }

      await db.query(
        'UPDATE bookings SET notification_error = ? WHERE id = ?',
        [errors.length ? errors.join(' | ') : null, id]
      );
    }

    return res.json({
      message: 'Booking status updated successfully.',
      status: newStatus,
      notification,
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    return res.status(500).json({ message: 'Unable to update booking status.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM bookings WHERE id = ?', [Number(req.params.id)]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    return res.json({ message: 'Booking deleted successfully.' });
  } catch (error) {
    console.error('Delete booking error:', error);
    return res.status(500).json({ message: 'Unable to delete booking.' });
  }
});

module.exports = router;
