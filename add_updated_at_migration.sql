-- ============================================================================
-- MIGRATION: Add updatedAt timestamps to all tables for sync conflict resolution
-- Run this in your Supabase SQL Editor to add updatedAt columns everywhere
-- ============================================================================

-- Add updatedAt to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Add updatedAt to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Add updatedAt to business_settings table
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Add updatedAt to the remaining tables for multi-device conflict resolution
ALTER TABLE sales ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE void_requests ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE stock_change_requests ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE product_sale_logs ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- Create function to auto-update updatedAt timestamp on row updates
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- Create triggers to automatically update updatedAt on record updates
-- ============================================================================

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for business_settings table
DROP TRIGGER IF EXISTS update_business_settings_updated_at ON business_settings;
CREATE TRIGGER update_business_settings_updated_at
    BEFORE UPDATE ON business_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers for sales, shifts, audit_logs, void_requests, stock_change_requests, product_sale_logs
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shifts_updated_at ON shifts;
CREATE TRIGGER update_shifts_updated_at
    BEFORE UPDATE ON shifts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_audit_logs_updated_at ON audit_logs;
CREATE TRIGGER update_audit_logs_updated_at
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_void_requests_updated_at ON void_requests;
CREATE TRIGGER update_void_requests_updated_at
    BEFORE UPDATE ON void_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_change_requests_updated_at ON stock_change_requests;
CREATE TRIGGER update_stock_change_requests_updated_at
    BEFORE UPDATE ON stock_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_sale_logs_updated_at ON product_sale_logs;
CREATE TRIGGER update_product_sale_logs_updated_at
    BEFORE UPDATE ON product_sale_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Supabase Realtime for all sync tables so every device hears changes immediately
ALTER PUBLICATION supabase_realtime ADD TABLE products, sales, shifts, audit_logs,
    void_requests, stock_change_requests, product_sale_logs, users, business_settings;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration worked
-- ============================================================================

-- Check if updatedAt column exists in users table
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'users' AND column_name = 'updatedAt';

-- Check if updatedAt column exists in products table
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'products' AND column_name = 'updatedAt';

-- Check if updatedAt column exists in business_settings table
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'business_settings' AND column_name = 'updatedAt';

-- Check if triggers exist
-- SELECT trigger_name, event_object_table FROM information_schema.triggers 
-- WHERE trigger_name LIKE '%updated_at%';
