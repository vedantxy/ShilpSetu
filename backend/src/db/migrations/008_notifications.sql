-- ============================================================
-- Migration: 008_notifications
-- Stores user-facing in-app notifications.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Target recipient
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Notification category
  type            TEXT        NOT NULL,
  -- 'product_published' | 'product_rejected' | 'artisan_verified' |
  -- 'artisan_rejected'  | 'order_created'    | 'order_updated'    |
  -- 'payment_updated'   | 'system'           | 'inquiry'

  title           TEXT        NOT NULL,
  message         TEXT        NOT NULL,

  -- Structured payload (e.g. { productId, orderId, deepLink })
  data            JSONB       NOT NULL DEFAULT '{}',

  is_read         BOOLEAN     NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type       ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE notifications IS
  'In-app user notifications triggered by asynchronous domain events.';
