'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { requireSeller } = require('../middleware/roleMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { validateRequest } = require('../middleware/validateRequest');
const catalogController = require('../controllers/catalogController');
const {
  generateCatalogSchema,
  reviewCatalogSchema,
  translateCatalogSchema,
  applyCatalogSchema,
} = require('../validators/catalogValidator');

router.use(authMiddleware, requireSeller);

router.post('/generate', uploadSingle, validateRequest(generateCatalogSchema), catalogController.generate);
router.post('/translate', validateRequest(translateCatalogSchema), catalogController.translate);
router.patch('/:id/review', validateRequest(reviewCatalogSchema), catalogController.review);
router.patch('/:id/approve', catalogController.approve);
router.post('/:id/apply', validateRequest(applyCatalogSchema), catalogController.apply);
router.get('/:id', catalogController.getById);
router.get('/', catalogController.list);

module.exports = router;
