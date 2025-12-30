-- ============================================================================
-- SUPABASE SCHEMA FOR POS LIQUOR SYSTEM
-- Run this SQL in your Supabase SQL Editor to create the required tables.
-- ============================================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- Stores staff members with their roles and permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER')),
    pin TEXT NOT NULL,
    permissions TEXT[] DEFAULT ARRAY['POS']
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (adjust for your auth setup)
CREATE POLICY "Allow all for anon" ON users FOR ALL USING (true);

-- ============================================================================
-- PRODUCTS TABLE
-- Inventory items with pricing and stock levels
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    size TEXT NULL,
    brand TEXT NULL,
    sku TEXT NULL,
    barcode TEXT NULL,
    "costPrice" NUMERIC(10, 2) NULL,
    "sellingPrice" NUMERIC(10, 2) NULL,
    supplier TEXT NULL,
    stock INTEGER NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NULL DEFAULT 5
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON products FOR ALL USING (true);

-- IF YOUR TABLE ALREADY EXISTS, RUN THIS TO ADD THE MISSING COLUMNS:
ALTER TABLE products ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT NULL;

-- ============================================================================
-- SALES TABLE
-- Completed transactions with line items stored as JSONB
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "totalAmount" NUMERIC(10, 2) NOT NULL,
    "totalCost" NUMERIC(10, 2) NOT NULL,
    "paymentMethod" TEXT NOT NULL CHECK ("paymentMethod" IN ('CASH', 'CARD', 'MOBILE')),
    items JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON sales FOR ALL USING (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sales_cashier ON sales("cashierId");

-- ============================================================================
-- SHIFTS TABLE
-- Cash drawer sessions for accountability
-- ============================================================================
CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ,
    "openingCash" NUMERIC(10, 2) NOT NULL DEFAULT 0,
    "closingCash" NUMERIC(10, 2),
    "expectedCash" NUMERIC(10, 2),
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED'))
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON shifts FOR ALL USING (true);

-- ============================================================================
-- AUDIT_LOGS TABLE
-- Security and activity tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON audit_logs FOR ALL USING (true);

-- Index for recent logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- ============================================================================
-- BUSINESS_SETTINGS TABLE
-- Store business configuration (single row with id='default')
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Port Side Liquor',
    tagline TEXT,
    phone TEXT NOT NULL DEFAULT '+254 700 000000',
    email TEXT,
    location TEXT NOT NULL DEFAULT 'Nairobi, Kenya',
    "logoUrl" TEXT,
    "receiptFooter" TEXT DEFAULT 'Thank you for your business!'
);

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON business_settings FOR ALL USING (true);

-- Insert default settings if not exists
INSERT INTO business_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HELPFUL QUERIES
-- ============================================================================

-- View today's sales summary:
-- SELECT SUM("totalAmount") as revenue, SUM("totalAmount" - "totalCost") as profit 
-- FROM sales WHERE timestamp::date = CURRENT_DATE;

-- View low stock items:
-- SELECT name, stock, "lowStockThreshold" FROM products 
-- WHERE stock <= COALESCE("lowStockThreshold", 5);

-- View open shifts:
-- SELECT * FROM shifts WHERE status = 'OPEN';