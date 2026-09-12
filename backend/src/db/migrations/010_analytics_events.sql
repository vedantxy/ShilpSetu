-- ============================================================
-- Migration: 010_analytics_events
-- Stores telemetry and domain events for analytics & reporting.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Event name (e.g. USER_REGISTERED, PRODUCT_VIEWED, ORDER_CREATED)
  event_name      TEXT        NOT NULL,

  -- Associated user (nullable for anonymous visitors)
  user_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Entity classification
  entity_type     TEXT,       -- 'product', 'order', 'user', 'ai', 'category'
  entity_id       TEXT,       -- ID of target entity

  -- Structured metadata (no sensitive credentials/PII)
  metadata        JSONB       NOT NULL DEFAULT '{}',

  -- Anonymized IP hash / client details
  ip_hash         TEXT,
  user_agent      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_user_id    ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_entity     ON analytics_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_composite  ON analytics_events(event_name, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE analytics_events IS
  'Domain telemetry and analytics event records with indexed timestamps for high-performance aggregations.';
