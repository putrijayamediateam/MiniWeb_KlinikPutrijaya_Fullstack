// ============================================================
// Klinik Putrijaya - Image Upload Route
// Saves uploaded images into frontend/images
// Endpoint: POST /api/uploads
// ============================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Final destination:
// MiniWeb_KlinikPutrijaya_Fullstack/frontend/images
const uploadDir = path.resolve(
  __dirname,
  '../../frontend/images'
);

// Create the folder automatically if it does not exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const allowedExtensions = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
];

const allowedMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },

  filename: (req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const originalBaseName = path.basename(
      file.originalname,
      extension
    );

    const safeBaseName =
      originalBaseName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'image';

    const timestamp = Date.now();

    const randomNumber = Math.round(
      Math.random() * 1e9
    );

    const finalFilename =
      `${safeBaseName}-${timestamp}-${randomNumber}${extension}`;

    callback(null, finalFilename);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const extensionAllowed =
      allowedExtensions.includes(extension);

    const mimeTypeAllowed =
      allowedMimeTypes.includes(file.mimetype);

    if (!extensionAllowed || !mimeTypeAllowed) {
      return callback(
        new Error(
          'Invalid image type. Please upload PNG, JPG, JPEG, GIF or WEBP.'
        )
      );
    }

    callback(null, true);
  },
});

router.post('/', (req, res) => {
  upload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Image size must not exceed 5MB.',
        });
      }

      return res.status(400).json({
        error: error.message,
      });
    }

    if (error) {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No image was uploaded.',
      });
    }

    // This URL is stored in promotions.image_url
    const publicImageUrl =
      `/images/${req.file.filename}`;

    return res.status(201).json({
      message: 'Image uploaded successfully.',
      filename: req.file.filename,
      url: publicImageUrl,
    });
  });
});

module.exports = router;