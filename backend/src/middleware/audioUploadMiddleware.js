'use strict';

const multer = require('multer');
const ApiError = require('../utils/apiError');
const { env } = require('../config/env');

const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
];

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(
      ApiError.badRequest(
        `Invalid audio file type: ${file.mimetype}. Allowed formats: WAV, MP3, OGG, WebM, M4A, FLAC`
      ),
      false
    );
  }
};

const audioUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (env.AI_AUDIO_MAX_SIZE_MB || 25) * 1024 * 1024,
    files: 1,
  },
});

const uploadSingleAudio = audioUpload.single('audio');

module.exports = {
  uploadSingleAudio,
  ALLOWED_AUDIO_MIME_TYPES,
};
