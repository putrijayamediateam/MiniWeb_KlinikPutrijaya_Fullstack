'use strict';

const fs = require('fs');
const path = require('path');

const isProduction =
  process.env.NODE_ENV === 'production';

const allowedUploadFolders = new Set([
  'general',
  'doctors',
  'services',
  'promotions',
]);

function normalizeUploadFolder(value = 'general') {
  const requested = String(value || 'general')
    .trim()
    .toLowerCase();

  return allowedUploadFolders.has(requested)
    ? requested
    : 'general';
}

/*
  Railway automatically supplies RAILWAY_VOLUME_MOUNT_PATH
  when a persistent Volume is attached to the backend service.

  UPLOAD_DIR remains available for another hosting provider
  or a manually configured storage directory.
*/
const configuredUploadRoot = String(
  process.env.UPLOAD_DIR ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    ''
).trim();

/*
  Do not allow production to silently save files to temporary
  container storage. This prevents uploaded images from being
  lost after a redeployment.
*/
if (isProduction && !configuredUploadRoot) {
  throw new Error(
    'Persistent upload storage is not configured. ' +
      'Attach a Railway Volume or set UPLOAD_DIR.'
  );
}

/*
  Local development continues using:
  frontend/images/uploads
*/
const localUploadRoot = path.resolve(
  __dirname,
  '..',
  '..',
  'frontend',
  'images',
  'uploads'
);

const uploadRoot = path.resolve(
  configuredUploadRoot || localUploadRoot
);

function ensureUploadRoot() {
  fs.mkdirSync(uploadRoot, {
    recursive: true,
  });

  return uploadRoot;
}

function getUploadFolderPath(folder) {
  const safeFolder = normalizeUploadFolder(folder);

  const destination = path.join(
    uploadRoot,
    safeFolder
  );

  fs.mkdirSync(destination, {
    recursive: true,
  });

  return destination;
}

module.exports = {
  uploadRoot,
  ensureUploadRoot,
  normalizeUploadFolder,
  getUploadFolderPath,
};