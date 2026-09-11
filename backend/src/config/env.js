const dotenv = require('dotenv');
const path = require('path');

// Load .env from the backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

/**
 * Validate that all required environment variables are present.
 * Throws on missing variables so the server fails fast at startup.
 */
function validateEnv() {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  AUTH_RATE_LIMIT_MAX: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20,
  UPLOAD_RATE_LIMIT_MAX: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX, 10) || 30,

  // Upload limits
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  MAX_FILES_PER_UPLOAD: parseInt(process.env.MAX_FILES_PER_UPLOAD, 10) || 5,

  // ─── AI Image Processing ──────────────────────────────────────────────────
  // Local sharp processing — always available (no API key needed)
  AI_IMAGE_MAX_SIZE_MB: parseInt(process.env.AI_IMAGE_MAX_SIZE_MB, 10) || 10,

  // Background removal provider: 'removebg' | 'none'
  IMAGE_BG_REMOVAL_PROVIDER: process.env.IMAGE_BG_REMOVAL_PROVIDER || 'none',
  REMOVEBG_API_KEY: process.env.REMOVEBG_API_KEY || '',

  // ─── AI Voice / Speech-to-Text ────────────────────────────────────────────
  // Provider: 'google' | 'none'
  VOICE_PROVIDER: process.env.VOICE_PROVIDER || 'none',
  GOOGLE_SPEECH_API_KEY: process.env.GOOGLE_SPEECH_API_KEY || '',
  // Comma-separated BCP-47 language codes
  GOOGLE_SPEECH_LANGUAGE_CODES: process.env.GOOGLE_SPEECH_LANGUAGE_CODES || 'hi-IN,gu-IN,en-IN',
  AI_AUDIO_MAX_SIZE_MB: parseInt(process.env.AI_AUDIO_MAX_SIZE_MB, 10) || 25,
  AI_AUDIO_MAX_DURATION_SEC: parseInt(process.env.AI_AUDIO_MAX_DURATION_SEC, 10) || 300,

  // ─── AI Catalog / Description (Google Gemini) ─────────────────────────────
  // Provider: 'gemini' | 'none'
  CATALOG_PROVIDER: process.env.CATALOG_PROVIDER || 'none',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-1.5-flash',

  // ─── Market Price Data ────────────────────────────────────────────────────
  // Provider: 'none' (extendable — plug in a market API later)
  MARKET_DATA_PROVIDER: process.env.MARKET_DATA_PROVIDER || 'none',
  MARKET_DATA_API_KEY: process.env.MARKET_DATA_API_KEY || '',

  get isProduction() {
    return this.NODE_ENV === 'production';
  },
  get isDevelopment() {
    return this.NODE_ENV === 'development';
  },
};

module.exports = { env, validateEnv };
