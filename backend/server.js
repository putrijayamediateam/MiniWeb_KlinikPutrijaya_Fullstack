'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const port = Number(process.env.PORT || 4000);

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  'http://127.0.0.1:5500',
  'http://localhost:5500',
].filter(Boolean));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(
  '/images',
  express.static(path.join(__dirname, '../frontend/images'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  })
);

app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    return res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/services', require('./routes/services'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/feedback', require('./routes/feedback'));

function mountOptional(apiPath, relativeModulePath) {
  const fullPath = path.join(__dirname, relativeModulePath);
  const jsPath = `${fullPath}.js`;

  if (fs.existsSync(jsPath)) {
    app.use(apiPath, require(fullPath));
    console.log(`Mounted optional route: ${apiPath}`);
  }
}

mountOptional('/api/branches', './routes/branches');
mountOptional('/api/promotions', './routes/promotions');

app.use((req, res) => {
  return res.status(404).json({ message: 'API route not found.' });
});

app.use((error, req, res, next) => {
  console.error('Unhandled server error:', error);

  if (String(error.message || '').startsWith('Origin not allowed by CORS')) {
    return res.status(403).json({ message: error.message });
  }

  return res.status(500).json({ message: 'Unexpected server error.' });
});

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('Database connected successfully.');

    app.listen(port, () => {
      console.log(`Klinik Putrijaya backend running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Unable to connect to MySQL:', error.message);
    process.exitCode = 1;
  }
}

start();
