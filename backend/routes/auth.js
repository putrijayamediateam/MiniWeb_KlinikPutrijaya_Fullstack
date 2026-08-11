'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { sendPasswordReset } = require('../services/emailService');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

router.use(authLimiter);

let adminColumnsCache = null;

async function getAdminColumns() {
  if (adminColumnsCache) return adminColumnsCache;
  const [rows] = await db.query('SHOW COLUMNS FROM admins');
  adminColumnsCache = new Set(rows.map((row) => row.Field));
  return adminColumnsCache;
}

function getPasswordHash(admin) {
  return admin.password_hash || admin.password || null;
}

router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const columns = await getAdminColumns();
    const emailCondition = columns.has('email') ? ' OR email = ?' : '';
    const params = columns.has('email') ? [username, username] : [username];

    const [rows] = await db.query(
      `SELECT * FROM admins WHERE (username = ?${emailCondition}) LIMIT 1`,
      params
    );

    const admin = rows[0];
    const storedHash = admin ? getPasswordHash(admin) : null;

    if (!admin || !storedHash) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const accountStatus = String(admin.account_status || 'active');

    if (accountStatus === 'pending_verification') {
      return res.status(403).json({ message: 'Verify your email address before logging in.' });
    }

    if (accountStatus === 'pending_approval') {
      return res.status(403).json({ message: 'Your account is waiting for superadmin approval.' });
    }

    if (accountStatus === 'rejected') {
      return res.status(403).json({ message: 'Your administrator account request was rejected.' });
    }

    const active = !columns.has('is_active') || Number(admin.is_active) === 1;
    if (!active || accountStatus !== 'active') {
      return res.status(403).json({ message: 'This administrator account is not active.' });
    }

    const passwordMatches = await bcrypt.compare(password, storedHash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured.');
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role || 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    if (columns.has('last_login_at')) {
  await db.query(
    `
      UPDATE admins
      SET last_login_at = NOW()
      WHERE id = ?
    `,
    [admin.id]
  );
}

    return res.json({
      token,
      username: admin.username,
      email: admin.email || null,
      role: admin.role || 'admin',
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const genericMessage = 'If an admin account exists for that email, a reset link has been sent.';

  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const columns = await getAdminColumns();
    if (!columns.has('email')) {
      console.warn('Forgot password skipped because admins.email does not exist.');
      return res.json({ message: genericMessage });
    }

    const [rows] = await db.query(
      'SELECT id, username, email FROM admins WHERE LOWER(email) = ? LIMIT 1',
      [email]
    );

    const admin = rows[0];
    if (!admin) {
      return res.json({ message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.query(
      'DELETE FROM admin_password_resets WHERE admin_id = ? OR expires_at < NOW() OR used_at IS NOT NULL',
      [admin.id]
    );

    await db.query(
      `INSERT INTO admin_password_resets (admin_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [admin.id, tokenHash, expiresAt]
    );

    const frontendUrl = String(process.env.FRONTEND_URL || 'http://127.0.0.1:5500').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password.html?token=${encodeURIComponent(rawToken)}`;

    try {
      const result = await sendPasswordReset({
        email: admin.email,
        username: admin.username,
        resetUrl,
      });

      if (!result.sent) {
        console.warn('Password reset email was not sent:', result.reason);
        if (process.env.NODE_ENV !== 'production') {
          console.log('Development reset URL:', resetUrl);
        }
      }
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
      if (process.env.NODE_ENV !== 'production') {
        console.log('Development reset URL:', resetUrl);
      }
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot-password error:', error);
    return res.status(500).json({ message: 'Unable to process password reset right now.' });
  }
});

router.post('/reset-password', async (req, res) => {
  const connection = await db.getConnection();

  try {
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required.' });
    }

    if (newPassword.length < 10) {
      return res.status(400).json({ message: 'Password must contain at least 10 characters.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, admin_id
       FROM admin_password_resets
       WHERE token_hash = ?
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1
       FOR UPDATE`,
      [tokenHash]
    );

    const reset = rows[0];
    if (!reset) {
      await connection.rollback();
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }

    const columns = await getAdminColumns();
    const passwordColumn = columns.has('password_hash') ? 'password_hash' : 'password';
    if (!columns.has(passwordColumn)) {
      throw new Error('No admin password column is available.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await connection.query(
      `UPDATE admins SET ${passwordColumn} = ? WHERE id = ?`,
      [passwordHash, reset.admin_id]
    );

    await connection.query(
      'UPDATE admin_password_resets SET used_at = NOW() WHERE id = ?',
      [reset.id]
    );

    await connection.query(
      'UPDATE admin_password_resets SET used_at = NOW() WHERE admin_id = ? AND used_at IS NULL',
      [reset.admin_id]
    );

    await connection.commit();
    return res.json({ message: 'Password changed successfully. You may now log in.' });
  } catch (error) {
    await connection.rollback();
    console.error('Reset-password error:', error);
    return res.status(500).json({ message: 'Unable to reset the password.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
