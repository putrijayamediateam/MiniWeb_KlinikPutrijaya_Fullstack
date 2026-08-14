'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const {
  uploadRoot,
  ensureUploadRoot,
} = require('./config/uploadStorage');

const app = express();
const frontendImagesDirectory = path.resolve(
  __dirname,
  '..',
  'frontend',
  'images'
);

console.log(
  'Serving images from:',
  frontendImagesDirectory
);

app.use(
  '/images',
  express.static(frontendImagesDirectory)
);


const port = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === 'production';

/*
  Hide Express identification from response headers.
*/
app.disable('x-powered-by');

/*
  Production hosting platforms normally place the Node.js app
  behind a reverse proxy.

  Keep this for now. We will verify the correct proxy setting
  after the backend is deployed.
*/
if (isProduction) {
  app.set('trust proxy', 1);
}

/* =========================================================
   Security headers
   ========================================================= */

/*
  crossOriginResourcePolicy is set to cross-origin because this
  backend serves images that may be displayed by the frontend
  hosted on another domain.
*/
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

/* =========================================================
   CORS configuration
   ========================================================= */

function parseAllowedOrigins() {
  const configuredOrigins = String(
    process.env.CORS_ALLOWED_ORIGINS ||
      process.env.FRONTEND_URL ||
      ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  /*
    Local frontend origins are permitted automatically only
    during development.
  */
  const developmentOrigins = isProduction
    ? []
    : [
        'http://127.0.0.1:5500',
        'http://localhost:5500',
      ];

  return new Set([
    ...configuredOrigins,
    ...developmentOrigins,
  ]);
}

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      /*
        Requests without an Origin header include server-to-server
        calls, curl, health checks and some local tools.
      */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origin not allowed by CORS: ${origin}`)
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],

    maxAge: 86400,
  })
);

/* =========================================================
   Request parsing
   ========================================================= */

app.use(
  express.json({
    limit: '2mb',
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb',
  })
);

/*
  Prevent browser or intermediary caching of API responses
  that may contain admin or booking information.
*/
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/* =========================================================
   Public images
   ========================================================= */

ensureUploadRoot();

app.use(
  '/images/uploads',
  express.static(uploadRoot, {
    maxAge: isProduction ? '30d' : 0,
    immutable: isProduction,
    fallthrough: true,
  })
);

app.use(
  '/images',
  express.static(
    path.join(__dirname, '../frontend/images'),
    {
      maxAge: isProduction ? '7d' : 0,
      fallthrough: true,
    }
  )
);

/* =========================================================
   Health check
   ========================================================= */

/*
  Health checks are placed before the API rate limiter so the
  hosting platform can monitor the server reliably.
*/
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error(
      'Database health check failed:',
      error.message
    );

    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

/* =========================================================
   General API rate limiter
   ========================================================= */

/*
  This is intentionally generous so it does not interfere with
  normal admin dashboard usage.

  More restrictive limits will later be added specifically to:
  - login
  - signup
  - forgot password
  - public booking creation
*/
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,

  standardHeaders: true,
  legacyHeaders: false,

  skip(req) {
    return req.method === 'OPTIONS';
  },

  message: {
    message:
      'Too many requests. Please wait and try again.',
  },
});

app.use('/api', apiLimiter);

/* =========================================================
   Required API routes
   ========================================================= */

app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/signup'));

app.use(
  '/api/admin-users',
  require('./routes/adminUsers')
);

app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/doctors', require('./routes/doctors'));

app.use(
  '/api/service-categories',
  require('./routes/serviceCategories')
);

app.use(
  '/api/service-subcategories',
  require('./routes/serviceSubcategories')
);

app.use(
  '/api/service-catalog',
  require('./routes/serviceCatalog')
);

app.use('/api/services', require('./routes/services'));

app.use(
  '/api/performance/google-search',
  require('./routes/googleSearchPerformance')
);

app.use(
  '/api/performance',
  require('./routes/performance')
);

app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/feedback', require('./routes/feedback'));

/* =========================================================
   Optional API routes
   ========================================================= */

function mountOptional(apiPath, relativeModulePath) {
  const fullPath = path.join(
    __dirname,
    relativeModulePath
  );

  const jsPath = `${fullPath}.js`;

  if (fs.existsSync(jsPath)) {
    app.use(apiPath, require(fullPath));

    console.log(
      `Mounted optional route: ${apiPath}`
    );
  }
}

mountOptional('/api/branches', './routes/branches');
mountOptional(
  '/api/promotions',
  './routes/promotions'
);

mountOptional(
  '/api/activities',
  './routes/activities'
);

/* =========================================================
   Public search-engine resources
   ========================================================= */

app.use(
  '/sitemap-services.xml',
  require('./routes/serviceSitemap')
);

/* =========================================================
   API 404
   ========================================================= */

app.use((req, res) => {
  return res.status(404).json({
    message: 'API route not found.',
  });
});

/* =========================================================
   Global error handler
   ========================================================= */

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);

  if (
    String(error.message || '').startsWith(
      'Origin not allowed by CORS'
    )
  ) {
    return res.status(403).json({
      message: 'This website origin is not allowed.',
    });
  }

  return res.status(500).json({
    message: 'Unexpected server error.',
  });
});

/* =========================================================
   Start server
   ========================================================= */

async function start() {
  try {
    await db.query('SELECT 1');

    console.log(
      'Database connected successfully.'
    );

    app.listen(port, () => {
      console.log(
        `Klinik Putrijaya backend running on port ${port}`
      );

      console.log(
        `Environment: ${
          process.env.NODE_ENV || 'development'
        }`
      );
    });
  } catch (error) {
    console.error(
      'Unable to connect to MySQL:',
      error.message
    );

    process.exitCode = 1;
  }
}

start();
