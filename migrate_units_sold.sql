-- ============================================================================
-- MIGRATE UNITS SOLD - SQL SCRIPT FOR SUPABASE
-- ============================================================================
-- This script calculates the total unitsSold for each product based on 
-- existing sales data and updates the products table.
--
-- INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- 4. Refresh your app (Ctrl+Shift+R) to see updated Units Sold values
-- ============================================================================

-- Step 1: Add unitsSold column if it doesn't exist (safe to run multiple times)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS "unitsSold" INTEGER DEFAULT 0;

-- Step 2: Calculate and update unitsSold for all products
-- This aggregates quantities from all non-voided sales
UPDATE products p
SET "unitsSold" = COALESCE(
    (
        SELECT SUM((item->>'quantity')::INTEGER)
        FROM sales s,
        LATERAL jsonb_array_elements(s.items) AS item
        WHERE item->>'productId' = p.id
        AND (s."isVoided" IS NULL OR s."isVoided" = false)
    ),
    0
);

-- Step 3: Verify the update (optional - shows products with sales)
SELECT 
    id,
    name,
    "unitsSold",
    stock,
    type
FROM products
WHERE "unitsSold" > 0
ORDER BY "unitsSold" DESC;

-- ============================================================================
-- EXPECTED OUTPUT:
-- You should see a list of products with their unitsSold values
-- Example:
--   id          | name           | unitsSold | stock | type
--   ------------|----------------|-----------|-------|------
--   123abc      | Tusker lite can|     7     |  17   | Beer
--   456def      | Heineken       |     5     |  12   | Beer
-- ============================================================================
