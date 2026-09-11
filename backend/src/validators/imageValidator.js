'use strict';

const { z } = require('zod');

const enhanceImageSchema = z.object({
  sharpen: z.coerce.number().min(0.1).max(5).default(1),
  brightness: z.coerce.number().min(0.5).max(2).default(1.05),
  saturation: z.coerce.number().min(0.5).max(3).default(1.2),
  contrast: z.coerce.number().min(0.5).max(2).default(1.1),
});

const cropImageSchema = z.object({
  width: z.coerce.number().int().positive('Width must be a positive integer'),
  height: z.coerce.number().int().positive('Height must be a positive integer'),
  fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('cover'),
  position: z.string().default('centre'),
});

const compressImageSchema = z.object({
  quality: z.coerce.number().int().min(1).max(100).default(75),
  maxWidthPx: z.coerce.number().int().min(100).max(4000).default(1920),
});

module.exports = {
  enhanceImageSchema,
  cropImageSchema,
  compressImageSchema,
};
