# 🔧 CRITICAL: Database Migration Required

## The Problem
Your existing products don't have the `unitsSold` field, and your browser cache has the old database schema (v5).

## ✅ SOLUTION (Do This Now!)

### Step 1: Clear Browser Cache & Storage
1. Open your POS app in the browser
2. Press **F12** to open DevTools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Under **Storage**, click **"Clear site data"** or **"Clear all"**
5. Check these boxes:
   - ✅ Local and session storage
   - ✅ IndexedDB
   - ✅ Cache storage
6. Click **"Clear site data"**
7. **Close the browser completely** (not just the tab)
8. Reopen the browser and go to your POS app

### Step 2: Verify Database Upgrade
1. Open DevTools (F12)
2. Go to **Application** → **IndexedDB** → **GrabBottlePOS_DB**
3. Check the version - it should say **"6"** (not 5)
4. Click on **products** store
5. Look at any product - it should have `unitsSold: 0`

### Step 3: Update Supabase (If Not Done)
Run this SQL in your Supabase SQL Editor:

```sql
-- Add unitsSold column to existing products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitsSold" INTEGER NULL DEFAULT 0;

-- Update all existing products to have unitsSold = 0
UPDATE products SET "unitsSold" = 0 WHERE "unitsSold" IS NULL;

-- Create product_sale_logs table (if not exists)
CREATE TABLE IF NOT EXISTS product_sale_logs (
    id TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    "priceAtSale" NUMERIC(10, 2) NOT NULL,
    "costAtSale" NUMERIC(10, 2) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_sale_logs_product_id ON product_sale_logs("productId");
CREATE INDEX IF NOT EXISTS idx_product_sale_logs_timestamp ON product_sale_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_product_sale_logs_sale_id ON product_sale_logs("saleId");
```

### Step 4: Test the Fix
1. Go to **POS** page
2. Add a product to cart (note its current stock)
3. Complete the sale
4. Go to **Inventory** page
5. **Verify stock reduced** by the quantity sold
6. Click on the product
7. **Verify analytics shows** the sale

---

## 🚨 If Stock STILL Doesn't Reduce

### Debug Steps:
1. Open browser console (F12 → Console tab)
2. Make a sale
3. Look for errors like:
   - `"Transaction failed"`
   - `"Product not found"`
   - `"Insufficient stock"`

### Common Issues:

**A) Error: "Cannot read property 'stock' of undefined"**
- **Cause:** Product not found in state
- **Fix:** Refresh the page to reload products

**B) Stock reduces in UI but reverts after refresh**
- **Cause:** Sync queue not processing
- **Fix:** Check internet connection, verify Supabase credentials

**C) Error: "Column 'unitsSold' does not exist"**
- **Cause:** Supabase schema not updated
- **Fix:** Run the SQL migration above

---

## ✅ Verification Checklist

After migration, verify:
- [ ] IndexedDB version is **6** (not 5)
- [ ] All products have `unitsSold: 0` field
- [ ] Stock reduces immediately after sale
- [ ] Analytics dashboard shows sales data
- [ ] Supabase has `product_sale_logs` table
- [ ] Supabase products table has `unitsSold` column

---

## 📞 Still Having Issues?

Run this in browser console to check database:
```javascript
// Check database version
indexedDB.databases().then(dbs => console.log('Databases:', dbs));

// Check a product
const db = await indexedDB.open('GrabBottlePOS_DB', 6);
const tx = db.transaction('products', 'readonly');
const products = await tx.objectStore('products').getAll();
console.log('First product:', products[0]);
```

Expected output should show `unitsSold: 0` in the product object.
