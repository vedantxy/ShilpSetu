'use strict';

const { z } = require('zod');

const trackEventSchema = z.object({
  eventName: z.enum([
    'USER_REGISTERED',
    'USER_LOGIN',
    'PRODUCT_CREATED',
    'PRODUCT_VIEWED',
    'PRODUCT_SAVED',
    'PRODUCT_PUBLISHED',
    'CART_ADDED',
    'ORDER_CREATED',
    'ORDER_COMPLETED',
    'AI_CATALOG_GENERATED',
    'PRICE_ANALYZED',
  ]),
  entityType: z.string().max(50).optional(),
  entityId: z.string().max(100).optional(),
  metadata: z.record(z.any()).default({}),
});

module.exports = {
  trackEventSchema,
};
