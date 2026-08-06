const express = require('express');

const {
  fetchGoogleSearchPerformance
} = require(
  '../services/googleSearchConsole'
);

const {
  requireAdmin
} = require('../middleware/auth');

const {
  requireActiveAdmin,
  requirePerformanceAccess
} = require('../middleware/roles');

const router =
  express.Router();

router.use(
  requireAdmin,
  requireActiveAdmin,
  requirePerformanceAccess
);

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || '')
  );
}

function round(value, decimals = 2) {
  const factor =
    10 ** decimals;

  return Math.round(
    Number(value || 0) * factor
  ) / factor;
}

router.get('/', async (req, res) => {
  try {
    const startDate =
      req.query.start_date;

    const endDate =
      req.query.end_date;

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate)
    ) {
      return res.status(400).json({
        error:
          'Valid start_date and end_date are required.'
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error:
          'start_date cannot be after end_date.'
      });
    }

    const result =
      await fetchGoogleSearchPerformance({
        startDate,
        endDate
      });

    return res.json({
      date_range: {
        start_date: startDate,
        end_date: endDate
      },

      summary: {
        clicks:
          result.summary.clicks,

        impressions:
          result.summary.impressions,

        ctr_percentage:
          round(
            result.summary.ctr * 100
          ),

        average_position:
          round(
            result.summary.position
          )
      },

      rows: result.rows.map((row) => ({
        ...row,

        ctr_percentage:
          round(row.ctr * 100),

        position:
          round(row.position)
      }))
    });
  } catch (error) {
    console.error(
      'Google Search Console error:',
      error?.response?.data ||
      error?.message ||
      error
    );

    const statusCode =
      Number(
        error?.response?.status ||
        error?.code
      );

    if (statusCode === 403) {
      return res.status(403).json({
        error:
          'Google Search Console access denied.'
      });
    }

    if (statusCode === 401) {
      return res.status(401).json({
        error:
          'Google Search Console authentication failed.'
      });
    }

    return res.status(500).json({
      error:
        'Unable to retrieve Google Search Console data.'
    });
  }
});

module.exports = router;