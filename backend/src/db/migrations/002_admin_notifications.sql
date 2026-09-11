-- ============================================================
-- Migration: 002_admin_notifications
-- Creates the admin_notifications table for system-wide
-- announcements, product alerts, and system messages.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by  UUID        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  type        TEXT        NOT NULL,
  -- 'announcement' | 'product_alert' | 'system_message'

  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL,
  target_role TEXT        NOT NULL DEFAULT 'all',
  -- 'all' | 'buyer' | 'seller' | 'admin'

  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifs_type        ON admin_notifications(type);
CREATE INDEX IF NOT EXISTS idx_admin_notifs_target_role ON admin_notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_admin_notifs_is_active   ON admin_notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_notifs_created_at  ON admin_notifications(created_at DESC);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_notifications IS
  'System-wide notifications created by admins (announcements, alerts, system messages).';
