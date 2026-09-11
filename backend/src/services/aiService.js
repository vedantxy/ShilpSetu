'use strict';

const geminiProvider = require('../providers/catalog/geminiProvider');
const marketPriceService = require('./marketPriceService');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * AI Service — Bridge & Legacy adapter.
 * Connects previous endpoints to the new provider-backed AI services.
 * Real AI providers are invoked if configured; otherwise returns explicit provider_unavailable/status.
 */
const aiService = {
  /**
   * Enhance a product image.
   */
  async enhanceImage(imageUrl, userId, productId = null) {
    const result = {
      imageUrl,
      message: 'Use POST /api/ai/image/enhance with multipart image file for sharp AI enhancement.',
      status: 'redirect_to_new_endpoint',
    };
    await this._saveGeneration(userId, productId, 'image_enhancement', result);
    return result;
  },

  /**
   * Convert speech to text.
   */
  async speechToText(audioData, userId, productId = null) {
    const result = {
      message: 'Use POST /api/ai/voice/transcribe with multipart audio file for speech-to-text.',
      status: 'redirect_to_new_endpoint',
    };
    await this._saveGeneration(userId, productId, 'speech_to_text', result);
    return result;
  },

  /**
   * Generate a product description from keywords using Gemini.
   */
  async generateDescription({ language = 'en', category, keywords }, userId, productId = null) {
    if (geminiProvider.isAvailable()) {
      const genResult = await geminiProvider.generateCatalog({
        category,
        notes: Array.isArray(keywords) ? keywords.join(', ') : keywords,
        primaryLanguage: language,
      });

      if (genResult.status === 'completed' && genResult.data) {
        const out = genResult.data;
        const result = {
          title: out.title,
          description: out.longDescription || out.shortDescription,
          craftStory: out.craftStory,
          language,
          provider: 'gemini',
          status: 'completed',
        };
        await this._saveGeneration(userId, productId, 'description_generation', result);
        return result;
      }
    }

    const keywordStr = Array.isArray(keywords) ? keywords.join(', ') : keywords || '';
    const result = {
      title: `Traditional ${category || 'Artisan'} - ${keywords?.[0] || 'Handcrafted'} Craft`,
      description: `Authentic handcrafted ${category || 'artisan product'} featuring ${keywordStr}. Created using traditional techniques by Indian artisans.`,
      language,
      provider: 'template_fallback',
      status: geminiProvider.isAvailable() ? 'completed' : 'provider_not_configured',
    };

    await this._saveGeneration(userId, productId, 'description_generation', result);
    return result;
  },

  /**
   * Suggest a price for a product based on category market intelligence.
   */
  async suggestPrice({ category, description, materials }, userId, productId = null) {
    const signals = marketPriceService.getCategorySignals(category || 'handicrafts');
    const { min, max } = signals.benchmarks.priceRange;
    const avgPrice = Math.round((min + max) / 2);

    const result = {
      suggestedPrice: avgPrice,
      minPrice: min,
      maxPrice: max,
      currency: 'INR',
      dataSource: signals.dataSource,
      demandLevel: signals.benchmarks.demandLevel,
      seasonality: signals.benchmarks.seasonality,
      status: 'completed',
    };

    await this._saveGeneration(userId, productId, 'price_suggestion', result);
    return result;
  },

  /**
   * Save an AI generation record for audit / analytics.
   * @private
   */
  async _saveGeneration(userId, productId, type, response) {
    try {
      await supabaseAdmin
        .from('ai_generations')
        .insert({
          user_id: userId,
          product_id: productId,
          type,
          response,
        });
    } catch (err) {
      logger.warn(`Failed to save AI generation record: ${err.message}`);
    }
  },
};

module.exports = aiService;
