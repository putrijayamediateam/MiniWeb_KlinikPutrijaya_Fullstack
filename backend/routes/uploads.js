'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const allowedFolders = new Set(['general', 'doctors', 'services', 'promotions']);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function resolveFolder(req) {
  const requested = String(req.query.folder || 'general').toLowerCase();
  return allowedFolders.has(requested) ? requested : 'general';
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const folder = resolveFolder(req);
    const destination = path.join(
      __dirname,
      '..',
      '..',
      'frontend',
      'images',
      'uploads',
      folder
    );

    fs.mkdirSync(destination, { recursive: true });
    callback(null, destination);
  },
  filename(req, file, callback) {
    const extensionByMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };

    const extension = extensionByMime[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const baseName = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image';

    const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    callback(null, `${baseName}-${unique}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    }
    return callback(null, true);
  },
});

router.post('/', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please select an image file.' });
  }

  const folder = resolveFolder(req);
  return res.status(201).json({
    message: 'Image uploaded successfully.',
    url: `/images/uploads/${folder}/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size,
  });
});

router.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) return next(error);

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Image must be 5 MB or smaller.' });
  }

  return res.status(400).json({
    message: 'Only JPEG, PNG and WebP images are allowed.',
  });
});

module.exports = router;
