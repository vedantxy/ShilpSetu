'use strict';

const { z } = require('zod');

const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  isRead: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  type: z.string().optional(),
});

const registerPushTokenSchema = z.object({
  pushToken: z.string().min(5, 'Valid pushToken is required'),
  deviceId: z.string().optional(),
  platform: z.enum(['expo', 'ios', 'android', 'web']).default('expo'),
});

module.exports = {
  listNotificationsQuerySchema,
  registerPushTokenSchema,
};
