'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
  rateLimit,
} = require('express-rate-limit');
const {
  OAuth2Client,
} = require('google-auth-library');

const db = require('../db');

const {
  sendSignupVerification,
} = require(
  '../services/signupEmailService'
);

const router = express.Router();

/* =========================================================
   SIGNUP RATE LIMIT
   ========================================================= */

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    message:
      'Too many signup attempts. Please try again later.',
  },
});

router.use(signupLimiter);

/* =========================================================
   ADMIN TABLE COLUMN CACHE
   ========================================================= */

let adminColumnsCache = null;

async function getAdminColumns() {
  if (adminColumnsCache) {
    return adminColumnsCache;
  }

  const [rows] = await db.query(
    'SHOW COLUMNS FROM admins'
  );

  adminColumnsCache = new Set(
    rows.map((row) => row.Field)
  );

  return adminColumnsCache;
}

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}

function splitEnvList(name) {
  return String(
    process.env[name] || ''
  )
    .split(',')
    .map((item) =>
      item.trim().toLowerCase()
    )
    .filter(Boolean);
}

function isSignupEnabled() {
  return (
    String(
      process.env.PUBLIC_SIGNUP_ENABLED ||
        'false'
    ).toLowerCase() === 'true'
  );
}

function getFrontendUrl() {
  return String(
    process.env.FRONTEND_URL ||
      'http://127.0.0.1:5500'
  ).replace(/\/+$/, '');
}

function createVerificationToken() {
  const rawToken = crypto
    .randomBytes(32)
    .toString('hex');

  const tokenHash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  const expiresAt = new Date(
    Date.now() + 30 * 60 * 1000
  );

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

function createVerificationUrl(rawToken) {
  return (
    `${getFrontendUrl()}/verify-account.html` +
    `?token=${encodeURIComponent(rawToken)}`
  );
}

/* =========================================================
   SIGNUP PERMISSION
   ========================================================= */

function isEmailAllowed(email) {
  const allowedEmails = splitEnvList(
    'SIGNUP_ALLOWED_EMAILS'
  );

  const allowedDomains = splitEnvList(
    'SIGNUP_ALLOWED_DOMAINS'
  );

  const allowedKeywords = splitEnvList(
    'SIGNUP_ALLOWED_KEYWORDS'
  );

  const normalizedEmail =
    normalizeEmail(email);

  const [
    localPart = '',
    domain = '',
  ] = normalizedEmail.split('@');

  const exactEmailAllowed =
    allowedEmails.includes(
      normalizedEmail
    );

  const domainAllowed =
    allowedDomains.includes(domain);

  const keywordAllowed =
    allowedKeywords.some(
      (keyword) =>
        keyword.length > 0 &&
        localPart.includes(keyword)
    );

  /*
    If no whitelist is configured:
    - allow during development
    - deny during production
  */
  if (
    allowedEmails.length === 0 &&
    allowedDomains.length === 0 &&
    allowedKeywords.length === 0
  ) {
    return (
      process.env.NODE_ENV !==
      'production'
    );
  }

  return (
    exactEmailAllowed ||
    domainAllowed ||
    keywordAllowed
  );
}

/* =========================================================
   USERNAME AND JWT
   ========================================================= */

function createUsername(email) {
  const prefix =
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 28) ||
    'user';

  return (
    `${prefix}_` +
    crypto
      .randomBytes(3)
      .toString('hex')
  );
}

function createJwt(admin) {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not configured.'
    );
  }

  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: admin.role || 'admin',
    },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        '8h',
    }
  );
}

/* =========================================================
   DATABASE HELPERS
   ========================================================= */

async function insertAdmin(values) {
  const columns =
    await getAdminColumns();

  const insertColumns = [];
  const placeholders = [];
  const params = [];

  Object.entries(values).forEach(
    ([column, value]) => {
      if (!columns.has(column)) {
        return;
      }

      insertColumns.push(
        `\`${column}\``
      );

      placeholders.push('?');
      params.push(value);
    }
  );

  if (
    !insertColumns.includes(
      '`username`'
    ) ||
    !insertColumns.includes(
      '`email`'
    )
  ) {
    throw new Error(
      'admins.username and admins.email are required for signup.'
    );
  }

  const [result] = await db.query(
    `
      INSERT INTO admins (
        ${insertColumns.join(', ')}
      )
      VALUES (
        ${placeholders.join(', ')}
      )
    `,
    params
  );

  return result.insertId;
}

/* =========================================================
   EMAIL HELPERS
   ========================================================= */

async function sendVerificationEmail({
  email,
  verificationUrl,
}) {
  try {
    const result =
      await sendSignupVerification({
        email,
        verificationUrl,
      });

    if (!result.sent) {
      console.warn(
        'Signup verification email was not sent:',
        result.reason
      );

      if (
        process.env.NODE_ENV !==
        'production'
      ) {
        console.log(
          'Development signup verification URL:',
          verificationUrl
        );
      }

      return {
        sent: false,
        statusCode: 503,
        message:
          'The verification email could not be sent. Please try again shortly.',
      };
    }

    return {
      sent: true,
      messageId:
        result.messageId || null,
    };
  } catch (emailError) {
    console.error(
      'Signup verification email error:',
      emailError
    );

    if (
      process.env.NODE_ENV !==
      'production'
    ) {
      console.log(
        'Development signup verification URL:',
        verificationUrl
      );
    }

    return {
      sent: false,
      statusCode: 502,
      message:
        'Unable to send the verification email right now.',
    };
  }
}

/* =========================================================
   PUBLIC SIGNUP CONFIG
   ========================================================= */

router.get(
  '/signup-config',
  (req, res) => {
    return res.json({
      signupEnabled:
        isSignupEnabled(),

      googleClientId:
        process.env
          .GOOGLE_CLIENT_ID || '',
    });
  }
);

/* =========================================================
   LOCAL EMAIL/PASSWORD SIGNUP
   ========================================================= */

router.post(
  '/signup',
  async (req, res) => {
    try {
      if (!isSignupEnabled()) {
        return res
          .status(403)
          .json({
            message:
              'Account registration is currently disabled.',
          });
      }

      const email =
        normalizeEmail(
          req.body.email
        );

      const password =
        String(
          req.body.password || ''
        );

      if (!isValidEmail(email)) {
        return res
          .status(400)
          .json({
            message:
              'Enter a valid email address.',
          });
      }

      if (
        password.length < 10 ||
        password.length > 128
      ) {
        return res
          .status(400)
          .json({
            message:
              'Password must contain 10 to 128 characters.',
          });
      }

      if (
        !/[A-Za-z]/.test(password) ||
        !/\d/.test(password)
      ) {
        return res
          .status(400)
          .json({
            message:
              'Password must include at least one letter and one number.',
          });
      }

      if (!isEmailAllowed(email)) {
        return res
          .status(403)
          .json({
            message:
              'Only authorised Klinik Putrijaya management email addresses may create an account.',
          });
      }

      const [existingRows] =
        await db.query(
          `
            SELECT
              id,
              username,
              email,
              account_status,
              is_active
            FROM admins
            WHERE LOWER(TRIM(email)) = ?
            LIMIT 1
          `,
          [email]
        );

      /* =====================================================
         EXISTING ACCOUNT
         ===================================================== */

      if (
        existingRows.length > 0
      ) {
        const existingAdmin =
          existingRows[0];

        const status = String(
          existingAdmin
            .account_status || ''
        ).toLowerCase();

        /*
          Account exists, but verification
          has not been completed.

          Generate a new token and resend.
        */
        if (
          status ===
          'pending_verification'
        ) {
          const {
            rawToken,
            tokenHash,
            expiresAt,
          } =
            createVerificationToken();

          await db.query(
            `
              UPDATE admins
              SET
                email_verification_token_hash = ?,
                email_verification_expires_at = ?
              WHERE id = ?
            `,
            [
              tokenHash,
              expiresAt,
              existingAdmin.id,
            ]
          );

          const verificationUrl =
            createVerificationUrl(
              rawToken
            );

          const emailResult =
            await sendVerificationEmail({
              email,
              verificationUrl,
            });

          if (!emailResult.sent) {
            return res
              .status(
                emailResult.statusCode
              )
              .json({
                message:
                  emailResult.message,
              });
          }

          return res
            .status(200)
            .json({
              message:
                'A new verification link has been sent to your email address.',
            });
        }

        if (
          status ===
          'pending_approval'
        ) {
          return res
            .status(409)
            .json({
              message:
                'Your email is already verified. Your account is waiting for superadmin approval.',
            });
        }

        if (
          status === 'rejected'
        ) {
          return res
            .status(403)
            .json({
              message:
                'This account registration was rejected. Please contact the superadmin.',
            });
        }

        return res
          .status(409)
          .json({
            message:
              'An account already exists for this email. Please log in.',
          });
      }

      /* =====================================================
         NEW ACCOUNT
         ===================================================== */

      const username =
        createUsername(email);

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const {
        rawToken,
        tokenHash,
        expiresAt,
      } =
        createVerificationToken();

      const adminId =
        await insertAdmin({
          username,
          email,

          /*
            Support both possible password
            column names in the existing schema.
          */
          password:
            passwordHash,

          password_hash:
            passwordHash,

          is_active: 0,

          auth_provider:
            'local',

          account_status:
            'pending_verification',

          role: 'admin',

          email_verification_token_hash:
            tokenHash,

          email_verification_expires_at:
            expiresAt,

          email_verified_at:
            null,
        });

      const verificationUrl =
        createVerificationUrl(
          rawToken
        );

      const emailResult =
        await sendVerificationEmail({
          email,
          verificationUrl,
        });

      /*
        The account is kept in
        pending_verification state.

        A later signup attempt with the
        same email can resend the link.
      */
      if (!emailResult.sent) {
        console.warn(
          `Verification email failed for admin ID ${adminId}.`
        );

        return res
          .status(
            emailResult.statusCode
          )
          .json({
            message:
              emailResult.message,
          });
      }

      return res
        .status(201)
        .json({
          message:
            'Account created. Check your email to complete the signup process.',
        });
    } catch (error) {
      console.error(
        'Signup error:',
        error
      );

      if (
        error?.code ===
        'ER_DUP_ENTRY'
      ) {
        return res
          .status(409)
          .json({
            message:
              'An account already exists for this email address.',
          });
      }

      return res
        .status(500)
        .json({
          message:
            'Unable to create the account right now.',
        });
    }
  }
);

/* =========================================================
   VERIFY EMAIL
   ========================================================= */

router.post(
  '/verify-email',
  async (req, res) => {
    try {
      const token =
        String(
          req.body.token || ''
        ).trim();

      if (!token) {
        return res
          .status(400)
          .json({
            message:
              'Verification token is required.',
          });
      }

      const tokenHash =
        crypto
          .createHash('sha256')
          .update(token)
          .digest('hex');

      const [rows] =
        await db.query(
          `
            SELECT
              id,
              username,
              email
            FROM admins
            WHERE
              email_verification_token_hash = ?
              AND email_verification_expires_at > NOW()
              AND account_status = 'pending_verification'
            LIMIT 1
          `,
          [tokenHash]
        );

      const admin = rows[0];

      if (!admin) {
        return res
          .status(400)
          .json({
            message:
              'This verification link is invalid or has expired.',
          });
      }

      await db.query(
        `
          UPDATE admins
          SET
            email_verified_at = NOW(),
            email_verification_token_hash = NULL,
            email_verification_expires_at = NULL,
            account_status = 'pending_approval',
            is_active = 0
          WHERE id = ?
        `,
        [admin.id]
      );

      /*
        The next improvement will send
        a notification to SUPERADMIN_EMAIL
        here after verification succeeds.
      */

      return res.json({
        message:
          'Email verified. Your account is now waiting for superadmin approval.',
      });
    } catch (error) {
      console.error(
        'Verify-email error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            'Unable to verify the account right now.',
        });
    }
  }
);

/* =========================================================
   GOOGLE SIGNUP / LOGIN
   ========================================================= */

router.post(
  '/google',
  async (req, res) => {
    try {
      const credential =
        String(
          req.body.credential || ''
        ).trim();

      if (!credential) {
        return res
          .status(400)
          .json({
            message:
              'Google credential is required.',
          });
      }

      if (
        !process.env
          .GOOGLE_CLIENT_ID
      ) {
        return res
          .status(503)
          .json({
            message:
              'Google signup is not configured.',
          });
      }

      const client =
        new OAuth2Client(
          process.env
            .GOOGLE_CLIENT_ID
        );

      const ticket =
        await client.verifyIdToken({
          idToken: credential,
          audience:
            process.env
              .GOOGLE_CLIENT_ID,
        });

      const payload =
        ticket.getPayload();

      const email =
        normalizeEmail(
          payload?.email
        );

      const googleSub =
        String(
          payload?.sub || ''
        );

      if (
        !email ||
        !googleSub ||
        payload?.email_verified !==
          true
      ) {
        return res
          .status(401)
          .json({
            message:
              'Google could not verify this email account.',
          });
      }

      const [existingRows] =
        await db.query(
          `
            SELECT *
            FROM admins
            WHERE
              google_sub = ?
              OR LOWER(TRIM(email)) = ?
            LIMIT 1
          `,
          [
            googleSub,
            email,
          ]
        );

      let admin =
        existingRows[0];

      /* =====================================================
         NEW GOOGLE ACCOUNT
         ===================================================== */

      if (!admin) {
        if (!isSignupEnabled()) {
          return res
            .status(403)
            .json({
              message:
                'Account registration is currently disabled.',
            });
        }

        if (
          !isEmailAllowed(email)
        ) {
          return res
            .status(403)
            .json({
              message:
                'Only authorised Klinik Putrijaya management Google accounts may create an account.',
            });
        }

        const username =
          createUsername(email);

        const unusablePasswordHash =
          await bcrypt.hash(
            crypto
              .randomBytes(32)
              .toString('hex'),
            12
          );

        const id =
          await insertAdmin({
            username,
            email,

            password:
              unusablePasswordHash,

            password_hash:
              unusablePasswordHash,

            is_active: 0,

            auth_provider:
              'google',

            google_sub:
              googleSub,

            account_status:
              'pending_approval',

            role: 'admin',

            email_verified_at:
              new Date(),

            last_login_at:
              new Date(),
          });

        admin = {
          id,
          username,
          email,
          role: 'admin',
          is_active: 0,
          account_status:
            'pending_approval',
        };

        /*
          Google already confirms the email,
          therefore this account goes directly
          to pending superadmin approval.
        */
        return res
          .status(202)
          .json({
            pendingApproval:
              true,

            message:
              'Google account verified. Your account is waiting for superadmin approval.',
          });
      }

      /* =====================================================
         EXISTING GOOGLE / LINKED ACCOUNT
         ===================================================== */

      const status =
        String(
          admin.account_status ||
            'active'
        ).toLowerCase();

      if (
        status ===
        'pending_verification'
      ) {
        return res
          .status(403)
          .json({
            message:
              'Verify your email address before continuing.',
          });
      }

      if (
        status ===
        'pending_approval'
      ) {
        return res
          .status(403)
          .json({
            message:
              'Your account is waiting for superadmin approval.',
          });
      }

      if (
        status === 'rejected'
      ) {
        return res
          .status(403)
          .json({
            message:
              'Your administrator account request was rejected.',
          });
      }

      if (
        Number(admin.is_active) !==
          1 ||
        status !== 'active'
      ) {
        return res
          .status(403)
          .json({
            message:
              'This account is not active.',
          });
      }

      await db.query(
        `
          UPDATE admins
          SET
            google_sub = ?,
            auth_provider =
              CASE
                WHEN auth_provider = 'local'
                THEN 'both'
                ELSE 'google'
              END,
            email_verified_at =
              COALESCE(
                email_verified_at,
                NOW()
              ),
            last_login_at = NOW()
          WHERE id = ?
        `,
        [
          googleSub,
          admin.id,
        ]
      );

      const token =
        createJwt(admin);

      return res.json({
        token,
        username:
          admin.username,
        email,
      });
    } catch (error) {
      console.error(
        'Google signup/login error:',
        error
      );

      return res
        .status(401)
        .json({
          message:
            'Google signup could not be completed.',
        });
    }
  }
);

module.exports = router;