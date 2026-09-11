'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireSeller } = require('../middleware/roleMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadSingleAudio } = require('../middleware/audioUploadMiddleware');
const voiceController = require('../controllers/voiceController');

router.use(authMiddleware, requireSeller);

router.post('/transcribe', uploadLimiter, uploadSingleAudio, voiceController.transcribe);
router.get('/:id', voiceController.getById);
router.get('/', voiceController.list);

module.exports = router;
