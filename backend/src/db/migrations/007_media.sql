-- ============================================================
-- Migration: 007_media
-- Stores all uploaded media assets (images, audio, video, documents).
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS media (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Media Owner (User / Artisan)
  owner_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Associated Product (Optional)
  product_id      UUID        REFERENCES products(id) ON DELETE SET NULL,

  -- Media Classification
  type            TEXT        NOT NULL,
  -- 'image' | 'audio' | 'video' | 'document'

  -- Delivery & Storage Keys
  url             TEXT        NOT NULL,
  storage_key     TEXT        NOT NULL,
  bucket          TEXT        NOT NULL DEFAULT 'product-images',

  -- File Details
  mime_type       TEXT        NOT NULL,
  size            BIGINT      NOT NULL,

  -- Dimensional & Media Metadata (Optional)
  width           INTEGER,
  height          INTEGER,
  duration        NUMERIC(8,2),

  -- Processing State
  status          TEXT        NOT NULL DEFAULT 'active',
  -- 'processing' | 'active' | 'failed' | 'deleted'

  metadata        JSONB       DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_owner_id   ON media(owner_id);
CREATE INDEX IF NOT EXISTS idx_media_product_id ON media(product_id);
CREATE INDEX IF NOT EXISTS idx_media_type       ON media(type);
CREATE INDEX IF NOT EXISTS idx_media_status     ON media(status);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE media IS
  'Media library records with ownership, dimensional metadata, and storage keys.';
