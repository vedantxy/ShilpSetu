'use strict';

const { z } = require('zod');

const transcribeVoiceSchema = z.object({
  languageCode: z.string().default('hi-IN'),
  productId: z.string().uuid().optional(),
});

module.exports = {
  transcribeVoiceSchema,
};
