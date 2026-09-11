'use strict';

const https = require('https');
const { env } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Google Cloud Speech Provider — Speech-to-Text via Google Cloud Speech REST API.
 *
 * Designed to support Indian languages: Hindi (hi-IN), Gujarati (gu-IN), English (en-IN),
 * Tamil (ta-IN), Bengali (bn-IN), Marathi (mr-IN), etc.
 *
 * If GOOGLE_SPEECH_API_KEY is not configured, returns provider_unavailable
 * without crashing or exposing credentials.
 */
class GoogleSpeechProvider {
  constructor() {
    this.name = 'google';
  }

  isAvailable() {
    return Boolean(env.GOOGLE_SPEECH_API_KEY && env.VOICE_PROVIDER === 'google');
  }

  /**
   * Transcribe an audio buffer into text.
   *
   * @param {Buffer} audioBuffer - Raw audio file buffer
   * @param {Object} options
   * @param {string} [options.languageCode='hi-IN'] - Primary language (e.g., 'hi-IN', 'gu-IN', 'en-IN')
   * @param {string[]} [options.alternativeLanguageCodes] - Alternative language codes for auto-detection
   * @param {string} [options.encoding='LINEAR16'] - Audio encoding (LINEAR16, MP3, FLAC, OGG_OPUS, etc.)
   * @param {number} [options.sampleRateHertz] - Sample rate if needed
   * @returns {Promise<{
   *   status: string,
   *   transcript: string,
   *   confidence: number,
   *   languageCode: string,
   *   words?: Array<{ word: string, startTime: string, endTime: string }>,
   *   rawResponse?: any
   * }>}
   */
  async transcribe(audioBuffer, options = {}) {
    if (!this.isAvailable()) {
      return {
        status: 'provider_unavailable',
        transcript: '',
        confidence: 0,
        languageCode: options.languageCode || 'hi-IN',
        error: 'Google Cloud Speech provider is not configured. Set GOOGLE_SPEECH_API_KEY and VOICE_PROVIDER=google.',
      };
    }

    const languageCode = options.languageCode || 'hi-IN';
    const altLanguages = options.alternativeLanguageCodes || ['gu-IN', 'en-IN', 'mr-IN', 'hi-IN'].filter(l => l !== languageCode);

    const base64Audio = audioBuffer.toString('base64');

    const requestBody = JSON.stringify({
      config: {
        encoding: options.encoding || 'ENCODING_UNSPECIFIED',
        sampleRateHertz: options.sampleRateHertz || undefined,
        languageCode: languageCode,
        alternativeLanguageCodes: altLanguages,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        model: 'default',
      },
      audio: {
        content: base64Audio,
      },
    });

    return new Promise((resolve, reject) => {
      const url = new URL(`https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(env.GOOGLE_SPEECH_API_KEY)}`);

      const req = https.request(
        {
          hostname: url.hostname,
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          },
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });

          res.on('end', () => {
            try {
              const data = JSON.parse(rawData);

              if (res.statusCode >= 400 || data.error) {
                const errMsg = data.error?.message || `Speech API error ${res.statusCode}`;
                logger.error(`Google Speech API error: ${errMsg}`);
                return resolve({
                  status: 'failed',
                  transcript: '',
                  confidence: 0,
                  languageCode,
                  error: errMsg,
                });
              }

              if (!data.results || data.results.length === 0) {
                return resolve({
                  status: 'completed',
                  transcript: '',
                  confidence: 0,
                  languageCode,
                  words: [],
                  message: 'No speech detected in audio',
                });
              }

              // Aggregate transcripts and calculate average confidence
              let fullTranscript = '';
              let totalConfidence = 0;
              let count = 0;
              const allWords = [];
              let detectedLang = languageCode;

              for (const result of data.results) {
                if (result.languageCode) {
                  detectedLang = result.languageCode;
                }
                const bestAlt = result.alternatives?.[0];
                if (bestAlt) {
                  fullTranscript += (fullTranscript ? ' ' : '') + (bestAlt.transcript || '').trim();
                  if (bestAlt.confidence !== undefined) {
                    totalConfidence += bestAlt.confidence;
                    count++;
                  }
                  if (bestAlt.words) {
                    for (const w of bestAlt.words) {
                      allWords.push({
                        word: w.word,
                        startTime: w.startTime || '0s',
                        endTime: w.endTime || '0s',
                      });
                    }
                  }
                }
              }

              const avgConfidence = count > 0 ? parseFloat((totalConfidence / count).toFixed(3)) : 0.85;

              return resolve({
                status: 'completed',
                transcript: fullTranscript,
                confidence: avgConfidence,
                languageCode: detectedLang,
                words: allWords,
              });
            } catch (err) {
              logger.error(`Failed to parse Google Speech response: ${err.message}`);
              return resolve({
                status: 'failed',
                transcript: '',
                confidence: 0,
                languageCode,
                error: 'Invalid response from speech recognition provider',
              });
            }
          });
        }
      );

      req.on('error', (err) => {
        logger.error(`Google Speech request error: ${err.message}`);
        resolve({
          status: 'failed',
          transcript: '',
          confidence: 0,
          languageCode,
          error: `Network error connecting to speech recognition service: ${err.message}`,
        });
      });

      req.write(requestBody);
      req.end();
    });
  }
}

module.exports = new GoogleSpeechProvider();
