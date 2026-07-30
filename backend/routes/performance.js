'use strict';

const express = require('express');
const db = require('../db');
const {
  requireAdmin,
} = require('../middleware/auth');

const router = express.Router();

const ALLOWED_EVENT_TYPES = new Set([
  'website_visit',
  'call_click',
  'booking_success',
  'direction_click',
  'whatsapp_click',
]);

const ALLOWED_DEVICE_TYPES = new Set([
  'mobile',
  'desktop',
]);

function cleanText(value, maximumLength = 255) {
  const text = String(value ?? '').trim();

  if (!text) {
    return null;
  }

  return text.slice(0, maximumLength);
}

function positiveInteger(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function isValidDate(value) {
  const text = String(value || '');

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    return false;
  }

  const date = new Date(
    `${text}T00:00:00Z`
  );

  return !Number.isNaN(date.getTime());
}

function formatLocalDate(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getDateRange(query) {
  const today = new Date();

  const defaultEnd =
    formatLocalDate(today);

  const defaultStartDate =
    new Date(today);

  defaultStartDate.setDate(
    defaultStartDate.getDate() - 29
  );

  const defaultStart =
    formatLocalDate(defaultStartDate);

  const startDate =
    isValidDate(query.start_date)
      ? String(query.start_date)
      : defaultStart;

  const endDate =
    isValidDate(query.end_date)
      ? String(query.end_date)
      : defaultEnd;

  return {
    startDate,
    endDate,
  };
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

/* =========================================================
   PUBLIC: Record anonymous website event
   ========================================================= */

router.post('/events', async (req, res) => {
  try {
    const eventType = cleanText(
      req.body.event_type,
      50
    );

    if (
      !eventType ||
      !ALLOWED_EVENT_TYPES.has(eventType)
    ) {
      return res.status(400).json({
        message:
          'Invalid performance event type.',
      });
    }

    const requestedDeviceType =
  cleanText(
    req.body.device_type,
    20
  );

const deviceType =
  ALLOWED_DEVICE_TYPES.has(
    requestedDeviceType
  )
    ? requestedDeviceType
    : null;

    const branchId =
      positiveInteger(
        req.body.branch_id
      );

    const serviceId =
      positiveInteger(
        req.body.service_id
      );

    const sessionKey =
      cleanText(
        req.body.session_key,
        150
      );

    const eventKey =
      cleanText(
        req.body.event_key,
        191
      );

    const pagePath =
      cleanText(
        req.body.page_path,
        255
      ) || '/';

    if (!sessionKey) {
      return res.status(400).json({
        message:
          'A session key is required.',
      });
    }

    const [result] = await db.query(
      `
        INSERT INTO website_performance_events (
  event_type,
  device_type,
  branch_id,
  service_id,
  session_key,
  event_key,
  page_path
)
VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
  eventType,
  deviceType,
  branchId,
  serviceId,
  sessionKey,
  eventKey,
  pagePath,
]
    );

    return res.status(201).json({
      tracked: true,
      duplicate: false,
      id: result.insertId,
    });
  } catch (error) {
    if (
      error.code === 'ER_DUP_ENTRY'
    ) {
      return res.status(200).json({
        tracked: false,
        duplicate: true,
      });
    }

    if (
      error.code ===
      'ER_NO_REFERENCED_ROW_2'
    ) {
      return res.status(400).json({
        message:
          'The selected branch or service does not exist.',
      });
    }

    console.error(
      '[performance POST /events]',
      error
    );

    return res.status(500).json({
      message:
        'Unable to record website performance.',
    });
  }
});

/* =========================================================
   ADMIN: Website performance overview
   ========================================================= */

router.get(
  '/overview',
  requireAdmin,
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
      } = getDateRange(req.query);

      if (startDate > endDate) {
        return res.status(400).json({
          message:
            'Start date cannot be after end date.',
        });
      }

      const branchId =
        positiveInteger(
          req.query.branch_id
        );

      const eventConditions = [
        `
          e.created_at >=
          CONCAT(?, ' 00:00:00')
        `,
        `
          e.created_at <
          DATE_ADD(
            CONCAT(?, ' 00:00:00'),
            INTERVAL 1 DAY
          )
        `,
      ];

      const eventParameters = [
        startDate,
        endDate,
      ];

      if (branchId) {
        eventConditions.push(
          'e.branch_id = ?'
        );

        eventParameters.push(
          branchId
        );
      }

      const eventWhereSql = `
        WHERE
        ${eventConditions.join(
          ' AND '
        )}
      `;

      const summarySql = `
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'website_visit'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS website_visits,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'call_click'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS calls,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'booking_success'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS bookings,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'direction_click'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS directions,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'whatsapp_click'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS whatsapp_clicks,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type IN (
                  'call_click',
                  'booking_success',
                  'direction_click',
                  'whatsapp_click'
                )
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS total_interactions

        FROM
          website_performance_events e

        ${eventWhereSql}
      `;

      const dailySql = `
        SELECT
          DATE_FORMAT(
            e.created_at,
            '%Y-%m-%d'
          ) AS date,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'website_visit'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS website_visits,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type IN (
                  'call_click',
                  'booking_success',
                  'direction_click',
                  'whatsapp_click'
                )
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS total_interactions

        FROM
          website_performance_events e

        ${eventWhereSql}

        GROUP BY
          DATE_FORMAT(
            e.created_at,
            '%Y-%m-%d'
          )

        ORDER BY
          date ASC
      `;

      const branchWhereSql =
        branchId
          ? 'WHERE b.id = ?'
          : '';

      const branchParameters = [
        startDate,
        endDate,
      ];

      if (branchId) {
        branchParameters.push(
          branchId
        );
      }

      const branchesSql = `
        SELECT
          b.id AS branch_id,
          b.name AS branch_name,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'call_click'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS calls,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'booking_success'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS bookings,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'direction_click'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS directions,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type =
                  'whatsapp_click'
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS whatsapp_clicks,

          COALESCE(
            SUM(
              CASE
                WHEN e.event_type IN (
                  'call_click',
                  'booking_success',
                  'direction_click',
                  'whatsapp_click'
                )
                THEN 1
                ELSE 0
              END
            ),
            0
          ) AS total_interactions

        FROM
          branches b

        LEFT JOIN
          website_performance_events e
          ON e.branch_id = b.id

          AND e.created_at >=
            CONCAT(?, ' 00:00:00')

          AND e.created_at <
            DATE_ADD(
              CONCAT(?, ' 00:00:00'),
              INTERVAL 1 DAY
            )

        ${branchWhereSql}

        GROUP BY
          b.id,
          b.name

        ORDER BY
          b.id ASC
      `;

      const devicesSql = `
  SELECT
    e.device_type,

    COUNT(
      DISTINCT e.session_key
    ) AS users

  FROM
    website_performance_events e

  ${eventWhereSql}

  AND e.device_type IN (
    'mobile',
    'desktop'
  )

  GROUP BY
    e.device_type

  ORDER BY
    e.device_type ASC
`;

      const [
  summaryResult,
  dailyResult,
  branchesResult,
  devicesResult,
] = await Promise.all([
  db.query(
    summarySql,
    eventParameters
  ),

  db.query(
    dailySql,
    eventParameters
  ),

  db.query(
    branchesSql,
    branchParameters
  ),

  db.query(
    devicesSql,
    eventParameters
  ),
]);

      const summaryRows =
        summaryResult[0];

      const dailyRows =
        dailyResult[0];

      const branchRows =
        branchesResult[0];

      const summarySource =
        summaryRows[0] || {};

      const summary = {
        website_visits:
          numberValue(
            summarySource.website_visits
          ),

        calls:
          numberValue(
            summarySource.calls
          ),

        bookings:
          numberValue(
            summarySource.bookings
          ),

        directions:
          numberValue(
            summarySource.directions
          ),

        whatsapp_clicks:
          numberValue(
            summarySource.whatsapp_clicks
          ),

        total_interactions:
          numberValue(
            summarySource.total_interactions
          ),
      };

      const daily = dailyRows.map(
        (row) => ({
          date: row.date,

          website_visits:
            numberValue(
              row.website_visits
            ),

          total_interactions:
            numberValue(
              row.total_interactions
            ),
        })
      );

      const branches = branchRows.map(
        (row) => ({
          branch_id:
            numberValue(
              row.branch_id
            ),

          branch_name:
            row.branch_name,

          calls:
            numberValue(
              row.calls
            ),

          bookings:
            numberValue(
              row.bookings
            ),

          directions:
            numberValue(
              row.directions
            ),

          whatsapp_clicks:
            numberValue(
              row.whatsapp_clicks
            ),

          total_interactions:
            numberValue(
              row.total_interactions
            ),
        })
      );

      const devices =
  devicesResult[0].map(
    (row) => ({
      device_type:
        row.device_type,

      users:
        numberValue(
          row.users
        ),
    })
  );

      return res.json({
        filters: {
          start_date: startDate,
          end_date: endDate,
          branch_id:
            branchId || null,
        },

        summary,
        daily,
        branches,
        devices,
      });
    } catch (error) {
      console.error(
        '[performance GET /overview]',
        error
      );

      return res.status(500).json({
        message:
          'Unable to load website performance.',
      });
    }
  }
);

module.exports = router;