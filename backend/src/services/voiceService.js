'use strict';

const { supabaseAdmin } = require('../config/supabase');
const googleSpeechProvider = require('../providers/voice/googleSpeechProvider');
const storageService = require('./storageService');
const logger = require('../utils/logger');
const path = require('path');

/**
 * VoiceService — Audio upload, speech transcription, language detection, and craft intent extraction.
 */
class VoiceService {
  /**
   * Upload audio, transcribe speech, and record results in DB.
   *
   * @param {Buffer} audioBuffer
   * @param {string} originalName
   * @param {string} mimeType
   * @param {string} userId
   * @param {Object} [options]
   * @param {string} [options.languageCode='hi-IN']
   * @param {string} [options.productId]
   */
  async processAudio(audioBuffer, originalName, mimeType, userId, options = {}) {
    const ext = path.extname(originalName).replace('.', '').toLowerCase() || 'wav';

    // 1. Upload audio to storage
    let audioUrl = '';
    let audioPath = '';
    try {
      // Use 'product-images' bucket which exists in Supabase by default
      const uploadResult = await storageService.upload(
        'product-images',
        audioBuffer,
        `audio-${originalName}`,
        mimeType,
        userId
      );
      audioUrl = uploadResult.url;
      audioPath = uploadResult.path;
    } catch (err) {
      logger.warn(`Storage upload for audio failed, using inline placeholder: ${err.message}`);
      audioUrl = `https://storage.shilpsetu.internal/audio/${userId}/${Date.now()}.${ext}`;
      audioPath = `${userId}/audio-${Date.now()}.${ext}`;
    }

    // 2. Insert initial pending record
    const { data: record, error: insertError } = await supabaseAdmin
      .from('voice_transcriptions')
      .insert({
        user_id: userId,
        product_id: options.productId || null,
        audio_url: audioUrl,
        audio_path: audioPath,
        audio_format: ext,
        audio_size_bytes: audioBuffer.length,
        provider: googleSpeechProvider.isAvailable() ? 'google' : 'none',
        status: 'processing',
      })
      .select()
      .single();

    if (insertError) {
      logger.error(`Failed to insert voice_transcriptions record: ${insertError.message}`);
    }

    const recordId = record?.id;

    // 3. Call Speech Provider
    const speechResult = await googleSpeechProvider.transcribe(audioBuffer, {
      languageCode: options.languageCode || 'hi-IN',
    });

    let status = speechResult.status;
    let transcript = speechResult.transcript || '';
    let confidence = speechResult.confidence || 0;
    let detectedLanguage = speechResult.languageCode || options.languageCode || 'hi-IN';
    let errorMessage = speechResult.error || null;

    // 4. Update transcription record
    if (recordId) {
      await supabaseAdmin
        .from('voice_transcriptions')
        .update({
          transcript,
          confidence,
          detected_language: detectedLanguage,
          status,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordId);
    }

    // 5. Extract craft keywords from transcript
    const extractedKeywords = this._extractKeywords(transcript);

    return {
      id: recordId,
      status,
      transcript,
      confidence,
      detectedLanguage,
      audioUrl,
      extractedKeywords,
      words: speechResult.words || [],
      message: speechResult.message || (status === 'provider_unavailable' ? 'Voice provider is not configured' : 'Transcription processed successfully'),
    };
  }

  /**
   * Helper to extract common artisan / craft terms from transcript.
   */
  _extractKeywords(text) {
    if (!text) return [];
    const craftKeywords = [
      'terracotta', 'clay', 'pottery', 'handloom', 'cotton', 'silk', 'embroidery',
      'wood', 'carving', 'brass', 'metal', 'leather', 'jute', 'bamboo', 'chanderi',
      'bandhani', 'kalamkari', 'madhubani', 'patachitra', 'warli', 'dhokra',
      'saree', 'dupatta', 'shawl', 'vase', 'statue', 'sculpture', 'painting',
      'handmade', 'organic', 'natural dye', 'artisan', 'craft',
      // Hindi/Gujarati terms in Roman or Devanagari
      'मिट्टी', 'हाथकरघा', 'सिल्क', 'कढ़ाई', 'लकड़ी', 'पीतल', 'साड़ी', 'दुपट्टा',
      'માટી', 'હાથવણાટ', 'રેશમ', 'ભરતકામ', 'લાકડું', 'પિત્તળ', 'સાડી'
    ];

    const lower = text.toLowerCase();
    const matched = [];
    for (const kw of craftKeywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push(kw);
      }
    }
    return matched;
  }

  /**
   * Get transcription by ID.
   */
  async getTranscription(id, userId) {
    const { data, error } = await supabaseAdmin
      .from('voice_transcriptions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Transcription not found');
    }

    return data;
  }

  /**
   * List user's transcriptions.
   */
  async listUserTranscriptions(userId, limit = 20) {
    const { data, error } = await supabaseAdmin
      .from('voice_transcriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  }
}

module.exports = new VoiceService();
