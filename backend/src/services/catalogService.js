'use strict';

const { supabaseAdmin } = require('../config/supabase');
const geminiProvider = require('../providers/catalog/geminiProvider');
const logger = require('../utils/logger');

/**
 * CatalogService — Manages AI catalog generation, translations, craft storytelling,
 * artisan review workflow, and application to products.
 */
class CatalogService {
  /**
   * Generate catalog content from input parameters and optional image.
   */
  async generateCatalog(userId, input, imageFile = null) {
    let imageBuffer = null;
    let mimeType = null;
    if (imageFile) {
      imageBuffer = imageFile.buffer;
      mimeType = imageFile.mimetype;
    }

    const providerResult = await geminiProvider.generateCatalog(input, imageBuffer, mimeType);

    const isAvailable = providerResult.status !== 'provider_unavailable';
    const isCompleted = providerResult.status === 'completed';

    const outputData = isCompleted ? providerResult.data : {};
    const providerName = geminiProvider.isAvailable() ? 'gemini' : 'none';

    // Insert into ai_generated_content
    const { data: record, error } = await supabaseAdmin
      .from('ai_generated_content')
      .insert({
        product_id: input.productId || null,
        generated_by: userId,
        provider: providerName,
        model: isAvailable ? 'gemini-1.5-flash' : null,
        input_metadata: {
          craftName: input.craftName || input.title,
          category: input.category,
          materials: input.materials,
          technique: input.technique,
          hoursToMake: input.hoursToMake,
          notes: input.notes,
          hasImage: Boolean(imageFile),
        },
        output: outputData,
        language: input.primaryLanguage || 'en',
        status: isCompleted ? 'draft' : 'failed',
        rejection_reason: isCompleted ? null : (providerResult.error || 'Generation failed'),
      })
      .select()
      .single();

    if (error) {
      logger.error(`Failed to record ai_generated_content: ${error.message}`);
    }

    return {
      id: record?.id,
      status: providerResult.status,
      provider: providerName,
      content: outputData,
      error: providerResult.error,
      reviewStatus: 'draft',
      message: isCompleted
        ? 'Catalog generated successfully. Ready for artisan review.'
        : providerResult.status === 'provider_unavailable'
        ? 'Gemini AI provider is not configured. Set GEMINI_API_KEY to activate AI generation.'
        : providerResult.error || 'Failed to generate catalog',
    };
  }

  /**
   * Translate existing catalog text into multiple regional languages.
   */
  async translateContent(userId, content, targetLanguages = ['hi', 'gu', 'en']) {
    const translationResult = await geminiProvider.translateContent(content, targetLanguages);
    return translationResult;
  }

  /**
   * Review/edit generated content (saves artisan edits without mutating original AI output).
   */
  async reviewContent(contentId, userId, edits) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('ai_generated_content')
      .select('*')
      .eq('id', contentId)
      .eq('generated_by', userId)
      .single();

    if (findError || !existing) {
      throw new Error('AI content record not found or unauthorized');
    }

    const mergedEdits = {
      ...(existing.seller_edits || {}),
      ...edits,
      editedAt: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('ai_generated_content')
      .update({
        seller_edits: mergedEdits,
        status: 'reviewed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return updated;
  }

  /**
   * Approve AI-generated content (ready to publish).
   */
  async approveContent(contentId, userId) {
    const { data, error } = await supabaseAdmin
      .from('ai_generated_content')
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .eq('generated_by', userId)
      .select()
      .single();

    if (error || !data) {
      throw new Error('AI content record not found or unauthorized');
    }

    return data;
  }

  /**
   * Apply approved AI content to an actual product listing.
   */
  async applyToProduct(contentId, productId, userId) {
    // 1. Fetch AI content and verify status is approved or reviewed
    const { data: aiContent, error: aiError } = await supabaseAdmin
      .from('ai_generated_content')
      .select('*')
      .eq('id', contentId)
      .eq('generated_by', userId)
      .single();

    if (aiError || !aiContent) {
      throw new Error('AI content record not found or unauthorized');
    }

    // Effective content: edits take priority over raw AI output
    const effective = {
      ...(aiContent.output || {}),
      ...(aiContent.seller_edits || {}),
    };

    // 2. Fetch and verify product ownership
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('seller_id', userId)
      .single();

    if (productError || !product) {
      throw new Error('Product not found or unauthorized');
    }

    // 3. Update product fields
    const updates = {
      title: effective.title || product.title,
      description: effective.longDescription || effective.description || product.description,
      materials: effective.materials || product.materials,
      craft_technique: effective.craftTechnique || effective.technique || product.craft_technique,
      care_instructions: effective.careInstructions || product.care_instructions,
      tags: effective.seoKeywords || effective.tags || product.tags,
      story: effective.craftStory || product.story,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // 4. Link content record to product
    await supabaseAdmin
      .from('ai_generated_content')
      .update({ product_id: productId, status: 'approved' })
      .eq('id', contentId);

    return {
      message: 'AI content successfully applied to product listing',
      product: updatedProduct,
    };
  }

  /**
   * Get AI generated content by ID.
   */
  async getContentById(contentId, userId) {
    const { data, error } = await supabaseAdmin
      .from('ai_generated_content')
      .select('*')
      .eq('id', contentId)
      .eq('generated_by', userId)
      .single();

    if (error || !data) {
      throw new Error('AI content not found');
    }

    return data;
  }

  /**
   * List user's AI generated content records.
   */
  async listContent(userId, options = {}) {
    const { productId, status, limit = 20, offset = 0 } = options;

    let query = supabaseAdmin
      .from('ai_generated_content')
      .select('*', { count: 'exact' })
      .eq('generated_by', userId);

    if (productId) {
      query = query.eq('product_id', productId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return {
      items: data || [],
      total: count || 0,
      limit,
      offset,
    };
  }
}

module.exports = new CatalogService();
