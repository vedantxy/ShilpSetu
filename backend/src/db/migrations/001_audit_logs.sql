-- ============================================================
-- Migration: 001_audit_logs
-- Creates the audit_logs table to record all sensitive admin
-- operations (verify artisan, reject product, change role, etc.)
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  -- Examples: 'verify_artisan', 'reject_product', 'change_user_role',
  --           'suspend_artisan', 'approve_product', 'archive_product',
  --           'feature_product', 'change_user_status', 'create_notification'

  target_type TEXT        NOT NULL,
  -- 'user' | 'product' | 'order' | 'category' | 'notification'

  target_id   TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast admin-specific lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id    ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_type  ON audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON audit_logs(created_at DESC);

-- Enable RLS — only admins (service role) can read/write
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS, so backend admin operations always work.
-- Optionally add a policy for frontend admin panel reads:
-- CREATE POLICY "Admins can view audit logs"
--   ON audit_logs FOR SELECT
--   USING (auth.jwt() ->> 'role' = 'admin');
