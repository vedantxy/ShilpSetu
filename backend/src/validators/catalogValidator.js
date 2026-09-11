'use strict';

const { z } = require('zod');

const generateCatalogSchema = z.object({
  craftName: z.string().min(2, 'Craft name must be at least 2 characters').max(200).optional(),
  title: z.string().min(2).max(200).optional(),
  artisanName: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  materials: z.union([z.string(), z.array(z.string())]).optional(),
  technique: z.string().max(300).optional(),
  hoursToMake: z.coerce.number().positive().optional(),
  duration: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  rawDescription: z.string().max(2000).optional(),
  productId: z.string().uuid().optional(),
  primaryLanguage: z.string().default('en'),
  languages: z.array(z.string()).default(['en', 'hi', 'gu']),
});

const reviewCatalogSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  shortDescription: z.string().max(1000).optional(),
  longDescription: z.string().max(5000).optional(),
  craftStory: z.string().max(5000).optional(),
  materials: z.array(z.string()).optional(),
  careInstructions: z.array(z.string()).optional(),
  seoKeywords: z.array(z.string()).optional(),
});

const translateCatalogSchema = z.object({
  title: z.string().optional(),
  shortDescription: z.string().optional(),
  craftStory: z.string().optional(),
  careInstructions: z.union([z.string(), z.array(z.string())]).optional(),
  targetLanguages: z.array(z.string()).min(1).default(['hi', 'gu', 'en']),
});

const applyCatalogSchema = z.object({
  productId: z.string().uuid('Valid product UUID is required'),
});

module.exports = {
  generateCatalogSchema,
  reviewCatalogSchema,
  translateCatalogSchema,
  applyCatalogSchema,
};
