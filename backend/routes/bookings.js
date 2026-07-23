'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const allowedStatuses = new Set([
  'pending',
  'confirmed',
  'completed',
  'cancelled',
]);

function parsePagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(
    Math.max(Number(query.limit) || 20, 1),
    500
  );

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function buildAdminFilters(query) {
  const conditions = [];
  const params = [];

  if (
    query.status &&
    allowedStatuses.has(String(query.status))
  ) {
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
      bk.reason LIKE ? OR
      b.name LIKE ? OR
      d.name LIKE ? OR
      s.title LIKE ?
    )`);

    params.push(q, q, q, q, q, q);
  }

  return {
    whereSql: conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '',
    params,
  };
}

/* =========================================================
   PUBLIC: Create booking
   ========================================================= */

router.post('/', async (req, res) => {
  try {
    const branchId = Number(req.body.branch_id);

    const doctorId = req.body.doctor_id
      ? Number(req.body.doctor_id)
      : null;

    const serviceId = req.body.service_id
      ? Number(req.body.service_id)
      : null;

    const patientName = String(
      req.body.patient_name || ''
    ).trim();

    const phone = String(
      req.body.phone || ''
    ).trim();

    const icNumber = cleanText(req.body.ic_number);

    const preferredDate = String(
      req.body.preferred_date || ''
    ).trim();

    const preferredTime = String(
      req.body.preferred_time || ''
    ).trim();

    const reason = cleanText(req.body.reason);

    if (
      !branchId ||
      !patientName ||
      !phone ||
      !preferredDate ||
      !preferredTime
    ) {
      return res.status(400).json({
        message:
          'Branch, patient name, phone, preferred date ' +
          'and preferred time are required.',
      });
    }

    const [result] = await db.query(
      `INSERT INTO bookings (
        branch_id,
        doctor_id,
        service_id,
        patient_name,
        phone,
        ic_number,
        preferred_date,
        preferred_time,
        reason,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        branchId,
        doctorId,
        serviceId,
        patientName,
        phone,
        icNumber,
        preferredDate,
        preferredTime,
        reason,
      ]
    );

    return res.status(201).json({
      message: 'Appointment request sent successfully.',
      id: result.insertId,
      reference:
        `KP-APT-${String(result.insertId).padStart(5, '0')}`,
    });
  } catch (error) {
    console.error('Create booking error:', error);

    return res.status(500).json({
      message: 'Unable to create booking.',
    });
  }
});

/* =========================================================
   ADMIN: Get bookings
   ========================================================= */

router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      page,
      limit,
      offset,
    } = parsePagination(req.query);

    const {
      whereSql,
      params,
    } = buildAdminFilters(req.query);

    const [rows] = await db.query(
      `SELECT
        bk.id,
        bk.branch_id,
        bk.doctor_id,
        bk.service_id,
        bk.patient_name,
        bk.phone,
        bk.ic_number,
        bk.preferred_date,
        bk.preferred_time,
        bk.reason,
        bk.status,
        bk.created_at,
        b.name AS branch_name,
        d.name AS doctor_name,
        s.title AS service_title
      FROM bookings bk
      INNER JOIN branches b
        ON b.id = bk.branch_id
      LEFT JOIN doctors d
        ON d.id = bk.doctor_id
      LEFT JOIN services s
        ON s.id = bk.service_id
      ${whereSql}
      ORDER BY bk.created_at DESC, bk.id DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total
      FROM bookings bk
      INNER JOIN branches b
        ON b.id = bk.branch_id
      LEFT JOIN doctors d
        ON d.id = bk.doctor_id
      LEFT JOIN services s
        ON s.id = bk.service_id
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
    const totalPages = Math.max(
      Math.ceil(total / limit),
      1
    );

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
        confirmed: Number(
          summaryRows[0].confirmed || 0
        ),
        completed: Number(
          summaryRows[0].completed || 0
        ),
        cancelled: Number(
          summaryRows[0].cancelled || 0
        ),
      },
    });
  } catch (error) {
    console.error('Admin bookings error:', error);

    return res.status(500).json({
      message: 'Unable to load bookings.',
    });
  }
});

/* =========================================================
   ADMIN: Update booking status
   ========================================================= */

router.put(
  '/:id/status',
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const newStatus = String(
        req.body.status || ''
      ).trim();

      if (
        !id ||
        !allowedStatuses.has(newStatus)
      ) {
        return res.status(400).json({
          message:
            'A valid booking status is required.',
        });
      }

      const [result] = await db.query(
        `UPDATE bookings
         SET status = ?
         WHERE id = ?`,
        [newStatus, id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: 'Booking not found.',
        });
      }

      return res.json({
        message:
          'Booking status updated successfully.',
        id,
        status: newStatus,
      });
    } catch (error) {
      console.error(
        'Update booking status error:',
        error
      );

      return res.status(500).json({
        message:
          'Unable to update booking status.',
      });
    }
  }
);

/* =========================================================
   ADMIN: Delete booking
   ========================================================= */

router.delete(
  '/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: 'A valid booking ID is required.',
        });
      }

      const [result] = await db.query(
        'DELETE FROM bookings WHERE id = ?',
        [id]
      );

      if (!result.affectedRows) {
        return res.status(404).json({
          message: 'Booking not found.',
        });
      }

      return res.json({
        message: 'Booking deleted successfully.',
      });
    } catch (error) {
      console.error('Delete booking error:', error);

      return res.status(500).json({
        message: 'Unable to delete booking.',
      });
    }
  }
);

module.exports = router;