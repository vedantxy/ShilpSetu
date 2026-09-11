-- ============================================================
-- Migration: 006_pricing_records
-- Stores every pricing analysis run for a seller.
-- Core math is deterministic; market signals are optional/labeled.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing_records (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who ran the analysis
  seller_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Optional product context
  product_id      UUID        REFERENCES products(id) ON DELETE SET NULL,

  -- ─── Cost Inputs (all in INR) ──────────────────────────────────────────────
  material_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  packaging_cost  NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- ─── Margin Inputs ────────────────────────────────────────────────────────
  desired_profit_margin NUMERIC(5,2),   -- percentage e.g. 30.00

  -- ─── Product Context ──────────────────────────────────────────────────────
  product_category TEXT,
  market_signals   JSONB DEFAULT '{}',
  -- { region, targetAudience, seasonality, competitorPriceRange, demandLevel }

  -- ─── Calculated Outputs ───────────────────────────────────────────────────
  recommended_price NUMERIC(12,2),
  minimum_price     NUMERIC(12,2),
  maximum_price     NUMERIC(12,2),
  profit_amount     NUMERIC(12,2),
  profit_margin_pct NUMERIC(5,2),

  -- ─── Market Analysis ──────────────────────────────────────────────────────
  market_analysis  JSONB DEFAULT '{}',
  -- { dataSource: 'estimated'|'live', signals: [...], confidence: 'low'|'medium'|'high' }

  currency         TEXT        NOT NULL DEFAULT 'INR',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_seller_id  ON pricing_records(seller_id);
CREATE INDEX IF NOT EXISTS idx_pricing_product_id ON pricing_records(product_id);
CREATE INDEX IF NOT EXISTS idx_pricing_created_at ON pricing_records(created_at DESC);

ALTER TABLE pricing_records ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pricing_records IS
  'Records of every pricing analysis run. Core cost math is always deterministic. '
  'Market signals are clearly labeled estimated/live depending on provider availability.';
