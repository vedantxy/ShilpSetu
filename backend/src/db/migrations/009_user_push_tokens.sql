-- ============================================================
-- Migration: 009_user_push_tokens
-- Stores push notification tokens for mobile/web devices.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_push_tokens (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx] or FCM/APNS token
  push_token      TEXT        NOT NULL,

  device_id       TEXT,
  platform        TEXT        NOT NULL DEFAULT 'expo',
  -- 'expo' | 'ios' | 'android' | 'web'

  active          BOOLEAN     NOT NULL DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_push_token UNIQUE (user_id, push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active  ON user_push_tokens(active);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_push_tokens IS
  'Device push notification tokens supporting Expo and mobile platforms.';
