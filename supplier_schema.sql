-- Run this script in your Supabase SQL Editor to support Supplier Invoicing

ALTER TABLE stock_change_requests 
ADD COLUMN IF NOT EXISTS "supplierName" TEXT;
