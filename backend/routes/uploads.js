'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const {
  normalizeUploadFolder,
  getUploadFolderPath,
} = require('../config/uploadStorage');

const {
  requireAdmin,
} = require('../middleware/auth');

const router = express.Router();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function resolveFolder(req) {
  return normalizeUploadFolder(
    req.query.folder || 'general'
  );
}

function getBackendPublicUrl(req) {
  const configuredUrl = String(
    process.env.BACKEND_PUBLIC_URL || ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (configuredUrl) {
    return configuredUrl;
  }

  return `${req.protocol}://${req.get('host')}`;
}

const storage = multer.diskStorage({
  destination(req, file, callback) {
    try {
      const folder = resolveFolder(req);
      const destination =
        getUploadFolderPath(folder);

      return callback(null, destination);
    } catch (error) {
      return callback(error);
    }
  },

  filename(req, file, callback) {
    const extensionByMime = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };

    const extension =
      extensionByMime[file.mimetype] ||
      path.extname(file.originalname).toLowerCase();

    const baseName =
      path
        .basename(
          file.originalname,
          path.extname(file.originalname)
        )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'image';

    const unique = [
      Date.now(),
      crypto.randomBytes(4).toString('hex'),
    ].join('-');

    return callback(
      null,
      `${baseName}-${unique}${extension}`
    );
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
      return callback(
        new multer.MulterError(
          'LIMIT_UNEXPECTED_FILE',
          'file'
        )
      );
    }

    return callback(null, true);
  },
});

router.post(
  '/',
  requireAdmin,
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: 'Please select an image file.',
      });
    }

    const folder = resolveFolder(req);

    /*
      Keep the relative path in the database so records remain
      portable between local development and production.
    */
    const relativeUrl =
      `/images/uploads/${folder}/${req.file.filename}`;

    return res.status(201).json({
      message: 'Image uploaded successfully.',

      /*
        Existing admin code can continue using "url".
      */
      url: relativeUrl,

      /*
        Additional full URL is available when needed.
      */
      absoluteUrl:
        `${getBackendPublicUrl(req)}${relativeUrl}`,

      filename: req.file.filename,
      size: req.file.size,
    });
  }
);

router.use((error, req, res, next) => {
  if (!(error instanceof multer.MulterError)) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'Image must be 5 MB or smaller.',
    });
  }

  return res.status(400).json({
    message:
      'Only JPEG, PNG and WebP images are allowed.',
  });
});

module.exports = router;