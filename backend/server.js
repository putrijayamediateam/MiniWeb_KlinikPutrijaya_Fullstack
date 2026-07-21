// ============================================================
// Klinik Putrijaya - Backend Server
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 4000;

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

const allowedOrigins = (
  process.env.CORS_ORIGIN || ''
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length
      ? allowedOrigins
      : '*',
  })
);

// ------------------------------------------------------------
// Request parsers
// ------------------------------------------------------------

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ------------------------------------------------------------
// Public image folder
// ------------------------------------------------------------

// Physical folder:
// frontend/images
//
// Public URL:
// http://localhost:4000/images/filename.jpg

const imagesDirectory = path.resolve(
  __dirname,
  '../frontend/images'
);

app.use(
  '/images',
  express.static(imagesDirectory)
);

// ------------------------------------------------------------
// API routes
// ------------------------------------------------------------

app.use(
  '/api/auth',
  require('./routes/auth')
);

app.use(
  '/api/uploads',
  require('./routes/uploads')
);

app.use(
  '/api/branches',
  require('./routes/branches')
);

app.use(
  '/api/doctors',
  require('./routes/doctors')
);

app.use(
  '/api/services',
  require('./routes/services')
);

app.use(
  '/api/bookings',
  require('./routes/bookings')
);

app.use(
  '/api/feedback',
  require('./routes/feedback')
);

app.use(
  '/api/promotions',
  require('./routes/promotions')
);

// ------------------------------------------------------------
// Health check
// ------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    imagesDirectory,
  });
});

// ------------------------------------------------------------
// API not found handler
// ------------------------------------------------------------

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found.',
  });
});

// ------------------------------------------------------------
// Unexpected error handler
// ------------------------------------------------------------

app.use((error, req, res, next) => {
  console.error('Unexpected server error:', error);

  res.status(500).json({
    error: 'Unexpected server error.',
  });
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `Klinik Putrijaya API running on http://localhost:${PORT}`
  );

  console.log(
    `Public images available at http://localhost:${PORT}/images`
  );

  console.log(
    `Image folder: ${imagesDirectory}`
  );
});