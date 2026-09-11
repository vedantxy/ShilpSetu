-- ============================================================
-- Migration: 005_voice_transcriptions
-- Stores audio file uploads and transcription results.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS voice_transcriptions (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Uploader
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Optional product context
  product_id      UUID        REFERENCES products(id) ON DELETE SET NULL,

  -- Stored audio file location (Supabase Storage)
  audio_url       TEXT        NOT NULL,
  audio_path      TEXT        NOT NULL,   -- bucket path for deletion
  audio_format    TEXT        NOT NULL,   -- 'wav', 'mp3', 'ogg', etc.
  audio_size_bytes BIGINT,
  audio_duration_sec NUMERIC(8,2),       -- estimated/actual duration

  -- Transcription output
  transcript      TEXT,                  -- raw transcript text
  detected_language TEXT,               -- BCP-47 code: 'hi-IN', 'gu-IN', 'en-IN'
  language_confidence NUMERIC(4,3),     -- 0.000 to 1.000
  confidence      NUMERIC(4,3),         -- overall transcription confidence

  -- Optional translation
  translated_text TEXT,
  translated_language TEXT,

  -- Provider info
  provider        TEXT        NOT NULL DEFAULT 'none',
  -- 'google' | 'none'

  -- Processing status
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'completed' | 'failed' | 'provider_unavailable'

  error_message   TEXT,                  -- if status='failed'

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_user_id    ON voice_transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_product_id ON voice_transcriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_voice_status     ON voice_transcriptions(status);
CREATE INDEX IF NOT EXISTS idx_voice_created_at ON voice_transcriptions(created_at DESC);

ALTER TABLE voice_transcriptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE voice_transcriptions IS
  'Audio upload records and their transcription results. '
  'Supports Gujarati, Hindi, and English via configurable providers.';
