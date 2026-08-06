const { google } = require('googleapis');

function getEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`
    );
  }

  return value;
}

function createSearchConsoleClient() {
  const clientEmail =
    getEnv(
      'GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL'
    );

  const privateKey =
    getEnv(
      'GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY'
    ).replace(/\\n/g, '\n');

  const auth =
    new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        'https://www.googleapis.com/auth/webmasters.readonly'
      ]
    });

  return google.searchconsole({
    version: 'v1',
    auth
  });
}

async function querySearchConsole({
  startDate,
  endDate,
  dimensions = [],
  rowLimit = 500
}) {
  const siteUrl =
    getEnv(
      'GOOGLE_SEARCH_CONSOLE_SITE_URL'
    );

  const searchConsole =
    createSearchConsoleClient();

  const response =
    await searchConsole.searchanalytics.query({
      siteUrl,

      requestBody: {
        startDate,
        endDate,
        dimensions,
        type: 'web',
        rowLimit,
        dataState: 'final'
      }
    });

  return response.data;
}

async function fetchGoogleSearchPerformance({
  startDate,
  endDate
}) {
  const [
    summaryResponse,
    queryResponse,
    pageResponse
  ] = await Promise.all([
    querySearchConsole({
      startDate,
      endDate,
      dimensions: [],
      rowLimit: 1
    }),

    querySearchConsole({
      startDate,
      endDate,
      dimensions: [
        'query'
      ],
      rowLimit: 500
    }),

    querySearchConsole({
      startDate,
      endDate,
      dimensions: [
        'page'
      ],
      rowLimit: 500
    })
  ]);

  const summaryRow =
    summaryResponse.rows?.[0] || {};

  const queryRows =
    Array.isArray(queryResponse.rows)
      ? queryResponse.rows
      : [];

  const pageRows =
    Array.isArray(pageResponse.rows)
      ? pageResponse.rows
      : [];

  return {
    summary: {
      clicks:
        Number(summaryRow.clicks || 0),

      impressions:
        Number(summaryRow.impressions || 0),

      ctr:
        Number(summaryRow.ctr || 0),

      position:
        Number(summaryRow.position || 0)
    },

    queries: queryRows.map((row) => ({
      query:
        row.keys?.[0] || '',

      clicks:
        Number(row.clicks || 0),

      impressions:
        Number(row.impressions || 0),

      ctr:
        Number(row.ctr || 0),

      position:
        Number(row.position || 0)
    })),

    pages: pageRows.map((row) => ({
      page:
        row.keys?.[0] || '',

      clicks:
        Number(row.clicks || 0),

      impressions:
        Number(row.impressions || 0),

      ctr:
        Number(row.ctr || 0),

      position:
        Number(row.position || 0)
    }))
  };
}

module.exports = {
  fetchGoogleSearchPerformance
};