-- ============================================================
-- Migration: 004_ai_generated_content
-- Stores ALL AI-generated catalog content.
-- Content flows: draft → reviewed → approved / rejected
-- Only 'approved' content can be applied to product listings.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_generated_content (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Which product this content belongs to (nullable if pre-product generation)
  product_id      UUID        REFERENCES products(id) ON DELETE SET NULL,

  -- Which seller/user triggered the generation
  generated_by    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Provider info (never expose secrets — store only name/model)
  provider        TEXT        NOT NULL DEFAULT 'none',
  -- e.g. 'gemini', 'openai', 'none'
  model           TEXT,
  -- e.g. 'gemini-1.5-flash'

  -- What was sent to the AI (for audit/debugging — no secrets)
  input_metadata  JSONB       NOT NULL DEFAULT '{}',
  -- { category, language, keywords, transcription, craftDetails, ... }

  -- The full AI-generated output
  output          JSONB       NOT NULL DEFAULT '{}',
  -- {
  --   title, description, shortDescription,
  --   seoTitle, seoDescription, tags, materials,
  --   craftTechnique, careInstructions,
  --   translations: { en: {...}, hi: {...}, gu: {...} }
  -- }

  -- Primary language of this generation
  language        TEXT        NOT NULL DEFAULT 'en',

  -- AI Safety review lifecycle
  status          TEXT        NOT NULL DEFAULT 'draft',
  -- 'draft' | 'reviewed' | 'approved' | 'rejected'

  -- Seller edits to AI output (stored separately so original is preserved)
  seller_edits    JSONB,

  -- Rejection reason (if admin/seller rejects the output)
  rejection_reason TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_content_product_id   ON ai_generated_content(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_generated_by ON ai_generated_content(generated_by);
CREATE INDEX IF NOT EXISTS idx_ai_content_status       ON ai_generated_content(status);
CREATE INDEX IF NOT EXISTS idx_ai_content_provider     ON ai_generated_content(provider);
CREATE INDEX IF NOT EXISTS idx_ai_content_created_at   ON ai_generated_content(created_at DESC);

ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ai_generated_content IS
  'AI-generated catalog content with full safety review lifecycle (draft→reviewed→approved/rejected). '
  'Content is NEVER auto-published — requires explicit seller approval.';

COMMENT ON COLUMN ai_generated_content.output IS
  'Full AI output stored as JSONB. Seller may edit via seller_edits column; original is always preserved.';
