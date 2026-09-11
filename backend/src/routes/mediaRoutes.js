'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { optionalAuth } = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { uploadSingleAudio } = require('../middleware/audioUploadMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const mediaController = require('../controllers/mediaController');
const {
  uploadImageMediaSchema,
  uploadAudioMediaSchema,
} = require('../validators/mediaValidator');

// Upload image media
router.post(
  '/image',
  authMiddleware,
  uploadLimiter,
  uploadSingle,
  validateRequest(uploadImageMediaSchema),
  mediaController.uploadImage
);

// Upload audio media
router.post(
  '/audio',
  authMiddleware,
  uploadLimiter,
  uploadSingleAudio,
  validateRequest(uploadAudioMediaSchema),
  mediaController.uploadAudio
);

// Retrieve media by ID (supports public marketplace access or authenticated private access)
router.get('/:id', optionalAuth, mediaController.getById);

// Delete media asset
router.delete('/:id', authMiddleware, mediaController.deleteMedia);

module.exports = router;
