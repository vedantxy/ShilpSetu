'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireSeller } = require('../middleware/roleMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const imageController = require('../controllers/imageController');

// All image transformation routes require seller authentication and upload rate limiting
router.use(authMiddleware, requireSeller, uploadLimiter);

router.post('/upload', uploadSingle, imageController.upload);
router.post('/background-remove', uploadSingle, imageController.removeBackground);
router.post('/enhance', uploadSingle, imageController.enhance);
router.post('/crop', uploadSingle, imageController.crop);
router.post('/compress', uploadSingle, imageController.compress);
router.post('/before-after', uploadSingle, imageController.beforeAfter);

module.exports = router;
