'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const inquiryController = require('../controllers/inquiryController');

router.use(authMiddleware);

router.post('/', inquiryController.create);
router.get('/', inquiryController.getMyInquiries);
router.get('/:id', inquiryController.getById);
router.post('/:id/respond', inquiryController.respond);
router.patch('/:id/close', inquiryController.close);

module.exports = router;
