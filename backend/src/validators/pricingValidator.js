'use strict';

const { z } = require('zod');

const calculatePriceSchema = z.object({
  materialCost: z.coerce.number().min(0, 'Material cost cannot be negative').default(0),
  laborCost: z.coerce.number().min(0).optional(),
  laborHours: z.coerce.number().min(0).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  packagingCost: z.coerce.number().min(0).default(0),
  shippingCost: z.coerce.number().min(0).default(0),
  otherCost: z.coerce.number().min(0).default(0),
  desiredProfitMargin: z.coerce.number().min(0).max(500).optional(),
  category: z.string().optional(),
  productId: z.string().uuid().optional(),
  platformFeePct: z.coerce.number().min(0).max(50).default(5),
  gstRatePct: z.coerce.number().min(0).max(50).default(5),
});

module.exports = {
  calculatePriceSchema,
};
