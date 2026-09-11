'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const { validateRequest, validateQuery } = require('../middleware/validateRequest');
const notificationController = require('../controllers/notificationController');
const {
  listNotificationsQuerySchema,
  registerPushTokenSchema,
} = require('../validators/notificationValidator');

// All notification routes require authenticated user
router.use(authMiddleware);

router.get('/', validateQuery(listNotificationsQuerySchema), notificationController.list);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);
router.post('/push-token', validateRequest(registerPushTokenSchema), notificationController.registerPushToken);
router.delete('/push-token/:token', notificationController.removePushToken);

module.exports = router;
