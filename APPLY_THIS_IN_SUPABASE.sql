-- ============================================================================
-- APPLY THIS WHOLE FILE IN THE SUPABASE SQL EDITOR
-- 1. Go to Supabase Dashboard → SQL Editor → New Query
-- 2. Paste EVERYTHING below, click RUN
-- 3. It's idempotent — safe to re-run.
-- ============================================================================
-- This fixes the reason writes stopped reaching the cloud around Apr 11/13:
--   • decrement_stock RPC pointed at snake_case columns that don't exist
--   • SPLIT payments were rejected by the sales CHECK constraint
--   • Product payloads carried columns (updatedAt, version, lastModifiedBy…)
--     that were never added to the table
--   • updatedAt + auto-update triggers were missing on every table that needs
--     multi-device conflict resolution
--   • Supabase Realtime publication was missing these tables so other devices
--     never received UPDATE events live
-- ============================================================================

-- ─── 1. Widen sales CHECK to include SPLIT + add the splitPayment JSONB ─────
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_paymentMethod_check;
ALTER TABLE sales ADD CONSTRAINT sales_paymentMethod_check
    CHECK ("paymentMethod" IN ('CASH', 'CARD', 'MOBILE', 'SPLIT'));

ALTER TABLE sales ADD COLUMN IF NOT EXISTS "splitPayment" JSONB NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "isVoided" BOOLEAN DEFAULT FALSE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "voidedBy" TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "voidReason" TEXT;

-- ─── 2. Add missing product metadata columns ────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitsSold" INTEGER NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lastModifiedBy" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lastModifiedByName" TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "priceHistory" JSONB DEFAULT '[]'::jsonb;

-- ─── 2b. Stock change requests: the TS StockChangeRequest type carries
--        supplierName (set during RECEIVE flow), but the column was never
--        added to the table. Every auto-approved receive from 4/11 onward
--        42703'd out and got stranded in failedSyncQueue with "Unknown error".
ALTER TABLE stock_change_requests ADD COLUMN IF NOT EXISTS "supplierName" TEXT NULL;

-- ─── 3. Add updatedAt on every sync'd table ─────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_change_requests ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE product_sale_logs ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- ─── 4. Auto-update updatedAt on every UPDATE ───────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','products','business_settings','sales','shifts',
    'audit_logs','void_requests','stock_change_requests','product_sale_logs'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();', t, t);
  END LOOP;
END $$;

-- ─── 5. The decrement_stock RPC (fixed to camelCase columns) ────────────────
-- This is the exact bug that stopped sales from syncing on Apr 11/13: the old
-- RPC tried to update units_sold / updated_at, neither of which exists on the
-- products table (the columns are quoted camelCase).
CREATE OR REPLACE FUNCTION decrement_stock(p_id TEXT, delta_qty INT)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock = stock - delta_qty,
      "unitsSold" = COALESCE("unitsSold", 0) + delta_qty,
      "updatedAt" = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- ─── 6. Realtime publication — wake up every device when a row changes ─────
-- Skips tables that are already in the publication.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','products','business_settings','sales','shifts',
    'audit_logs','void_requests','stock_change_requests','product_sale_logs'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    EXCEPTION WHEN duplicate_object THEN
      -- already added — fine
      NULL;
    END;
  END LOOP;
END $$;

-- ─── 7. Sanity check queries (uncomment to run) ─────────────────────────────
-- SELECT 'decrement_stock exists' AS check, COUNT(*) = 1 AS ok
--   FROM pg_proc WHERE proname = 'decrement_stock';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'products' AND column_name IN ('unitsSold','updatedAt','priceHistory');
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
