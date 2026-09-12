'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');

router.use(authMiddleware);

router.get('/', cartController.getSavedProducts);
router.post('/:productId', cartController.saveProduct);

module.exports = router;
