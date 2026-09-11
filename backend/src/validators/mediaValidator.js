'use strict';

const { z } = require('zod');

const uploadImageMediaSchema = z.object({
  productId: z.string().uuid().optional(),
  bucket: z.string().default('product-images'),
});

const uploadAudioMediaSchema = z.object({
  productId: z.string().uuid().optional(),
  duration: z.coerce.number().positive().optional(),
  bucket: z.string().default('product-images'),
});

module.exports = {
  uploadImageMediaSchema,
  uploadAudioMediaSchema,
};
