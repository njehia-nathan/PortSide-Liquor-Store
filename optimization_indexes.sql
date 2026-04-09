-- Supabase Data Fetch Optimization Indexes
-- Run these inside your Supabase SQL Editor

-- These indexes speed up the specific queries using .gte('timestamp', ...)
CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_product_sale_logs_timestamp ON product_sale_logs(timestamp);

-- These optimize the lookups for shifts and void requests
-- (Using double quotes because Supabase column headers are camelCase)
CREATE INDEX IF NOT EXISTS idx_shifts_start ON shifts("startTime");
CREATE INDEX IF NOT EXISTS idx_void_requests_created ON void_requests("requestedAt");
