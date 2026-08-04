'use strict';

const express = require('express');

const db = require('../db');

const {
  requireAdmin,
} = require('../middleware/auth');

const {
  requireSuperAdmin,
} = require(
  '../middleware/superadmin'
);

const {
  sendAccountApproved,
  sendAccountRejected,
} = require(
  '../services/adminAccountEmailService'
);

const router = express.Router();

/* =========================================================
   CURRENT ADMIN PROFILE
   ========================================================= */

router.get(
  '/me',
  requireAdmin,
  async (req, res) => {
    try {
      const [rows] =
        await db.query(
          `
            SELECT
              id,
              username,
              email,
              role,
              account_status,
              is_active,
              auth_provider,
              email_verified_at,
              approved_at,
              last_login_at
            FROM admins
            WHERE id = ?
            LIMIT 1
          `,
          [req.admin.id]
        );

      const admin = rows[0];

      if (!admin) {
        return res
          .status(404)
          .json({
            message:
              'Administrator account was not found.',
          });
      }

      return res.json(admin);
    } catch (error) {
      console.error(
        'Read admin profile error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            'Unable to load administrator profile.',
        });
    }
  }
);

/*
  All routes below require an authenticated
  superadmin account.
*/
router.use(
  requireAdmin,
  requireSuperAdmin
);

/* =========================================================
   PENDING ADMIN ACCOUNTS
   ========================================================= */

router.get(
  '/pending',
  async (req, res) => {
    try {
      const [rows] =
        await db.query(
          `
            SELECT
              id,
              username,
              email,
              auth_provider,
              role,
              account_status,
              email_verified_at,
              created_at
            FROM admins
            WHERE
              account_status = 'pending_approval'
              AND is_active = 0
            ORDER BY
              COALESCE(
                email_verified_at,
                created_at
              ) ASC,
              id ASC
          `
        );

      return res.json({
        data: rows,
        total: rows.length,
      });
    } catch (error) {
      console.error(
        'Load pending admins error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            'Unable to load pending administrator accounts.',
        });
    }
  }
);

/* =========================================================
   APPROVE ADMIN ACCOUNT
   ========================================================= */

router.put(
  '/:id/approve',
  async (req, res) => {
    const connection =
      await db.getConnection();

    let approvedAdmin = null;

    try {
      const targetId =
        Number(req.params.id);

      if (
        !Number.isInteger(targetId) ||
        targetId <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'A valid administrator ID is required.',
          });
      }

      if (
        targetId ===
        Number(req.superadmin.id)
      ) {
        return res
          .status(400)
          .json({
            message:
              'You cannot approve your own account.',
          });
      }

      await connection
        .beginTransaction();

      const [rows] =
        await connection.query(
          `
            SELECT
              id,
              username,
              email,
              role,
              account_status,
              is_active,
              email_verified_at
            FROM admins
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
          `,
          [targetId]
        );

      const target = rows[0];

      if (!target) {
        await connection.rollback();

        return res
          .status(404)
          .json({
            message:
              'Administrator account was not found.',
          });
      }

      if (
        String(
          target.role || ''
        ).toLowerCase() ===
        'superadmin'
      ) {
        await connection.rollback();

        return res
          .status(400)
          .json({
            message:
              'A superadmin account cannot be approved through this screen.',
          });
      }

      if (
        String(
          target.account_status || ''
        ).toLowerCase() !==
        'pending_approval'
      ) {
        await connection.rollback();

        return res
          .status(409)
          .json({
            message:
              'This account is no longer waiting for approval.',
          });
      }

      if (
        !target.email_verified_at
      ) {
        await connection.rollback();

        return res
          .status(409)
          .json({
            message:
              'The email address must be verified before approval.',
          });
      }

      await connection.query(
        `
          UPDATE admins
          SET
            account_status = 'active',
            is_active = 1,
            role = 'admin',
            approved_by = ?,
            approved_at = NOW(),
            rejection_reason = NULL
          WHERE id = ?
        `,
        [
          req.superadmin.id,
          targetId,
        ]
      );

      await connection.commit();

      approvedAdmin = {
        id: target.id,
        username:
          target.username,
        email:
          target.email,
      };
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Approve rollback error:',
          rollbackError
        );
      }

      console.error(
        'Approve admin error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            'Unable to approve this administrator account.',
        });
    } finally {
      connection.release();
    }

    /*
      Send the email only after the database
      transaction is successfully committed.

      Email failure must not undo approval.
    */
    let emailSent = false;
    let emailWarning = null;

    try {
      const emailResult =
        await sendAccountApproved({
          email:
            approvedAdmin.email,

          username:
            approvedAdmin.username,
        });

      emailSent =
        Boolean(
          emailResult.sent
        );

      if (!emailResult.sent) {
        emailWarning =
          emailResult.reason ||
          'email_not_sent';

        console.warn(
          'Approval email was not sent:',
          emailWarning
        );
      }
    } catch (emailError) {
      emailWarning =
        'email_send_failed';

      console.error(
        'Approval email error:',
        emailError
      );
    }

    return res.json({
      message:
        `${approvedAdmin.email} has been approved and may now log in.`,

      emailSent,

      emailWarning,
    });
  }
);

/* =========================================================
   REJECT ADMIN ACCOUNT
   ========================================================= */

router.put(
  '/:id/reject',
  async (req, res) => {
    const connection =
      await db.getConnection();

    let rejectedAdmin = null;

    try {
      const targetId =
        Number(req.params.id);

      const reason =
        String(
          req.body.reason || ''
        )
          .trim()
          .slice(0, 255);

      if (
        !Number.isInteger(targetId) ||
        targetId <= 0
      ) {
        return res
          .status(400)
          .json({
            message:
              'A valid administrator ID is required.',
          });
      }

      if (
        targetId ===
        Number(req.superadmin.id)
      ) {
        return res
          .status(400)
          .json({
            message:
              'You cannot reject your own account.',
          });
      }

      await connection
        .beginTransaction();

      const [rows] =
        await connection.query(
          `
            SELECT
              id,
              username,
              email,
              role,
              account_status
            FROM admins
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
          `,
          [targetId]
        );

      const target = rows[0];

      if (!target) {
        await connection.rollback();

        return res
          .status(404)
          .json({
            message:
              'Administrator account was not found.',
          });
      }

      if (
        String(
          target.role || ''
        ).toLowerCase() ===
        'superadmin'
      ) {
        await connection.rollback();

        return res
          .status(400)
          .json({
            message:
              'A superadmin account cannot be rejected.',
          });
      }

      if (
        String(
          target.account_status || ''
        ).toLowerCase() !==
        'pending_approval'
      ) {
        await connection.rollback();

        return res
          .status(409)
          .json({
            message:
              'This account is no longer waiting for approval.',
          });
      }

      await connection.query(
        `
          UPDATE admins
          SET
            account_status = 'rejected',
            is_active = 0,
            approved_by = ?,
            approved_at = NOW(),
            rejection_reason = ?
          WHERE id = ?
        `,
        [
          req.superadmin.id,
          reason || null,
          targetId,
        ]
      );

      await connection.commit();

      rejectedAdmin = {
        id: target.id,
        username:
          target.username,
        email:
          target.email,
        reason,
      };
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          'Reject rollback error:',
          rollbackError
        );
      }

      console.error(
        'Reject admin error:',
        error
      );

      return res
        .status(500)
        .json({
          message:
            'Unable to reject this administrator account.',
        });
    } finally {
      connection.release();
    }

    /*
      Send the rejection email after the
      database transaction is committed.
    */
    let emailSent = false;
    let emailWarning = null;

    try {
      const emailResult =
        await sendAccountRejected({
          email:
            rejectedAdmin.email,

          username:
            rejectedAdmin.username,

          reason:
            rejectedAdmin.reason,
        });

      emailSent =
        Boolean(
          emailResult.sent
        );

      if (!emailResult.sent) {
        emailWarning =
          emailResult.reason ||
          'email_not_sent';

        console.warn(
          'Rejection email was not sent:',
          emailWarning
        );
      }
    } catch (emailError) {
      emailWarning =
        'email_send_failed';

      console.error(
        'Rejection email error:',
        emailError
      );
    }

    return res.json({
      message:
        `${rejectedAdmin.email} has been rejected.`,

      emailSent,

      emailWarning,
    });
  }
);

module.exports = router;