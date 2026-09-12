'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

router.use(authMiddleware);

router.post('/', orderController.create);
router.get('/', orderController.getMyOrders);
router.get('/:id', orderController.getById);
router.patch('/:id/cancel', orderController.cancel);

module.exports = router;
