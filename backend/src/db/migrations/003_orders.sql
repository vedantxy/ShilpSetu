-- ============================================================
-- Migration: 003_orders
-- Creates the orders table.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  seller_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  product_id       UUID        REFERENCES products(id) ON DELETE SET NULL,
  quantity         INT         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount           NUMERIC(12, 2),

  status           TEXT        NOT NULL DEFAULT 'pending',
  -- pending | confirmed | shipped | delivered | cancelled | disputed

  payment_status   TEXT        NOT NULL DEFAULT 'unpaid',
  -- unpaid | paid | refunded | failed

  shipping_address JSONB,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id       ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id      ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id     ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at     ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE orders IS
  'Order records for buyer-seller transactions on the ShilpSetu marketplace.';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_orders_updated_at();
