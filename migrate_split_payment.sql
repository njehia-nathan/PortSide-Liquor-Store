-- Migration: Add splitPayment support to sales table
-- Run this in your Supabase SQL Editor

-- Add splitPayment column to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS "splitPayment" jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.sales."splitPayment" IS 'Split payment details with cashAmount and mobileAmount';

-- Update existing SPLIT payment method sales to have empty object if null
UPDATE public.sales
SET "splitPayment" = '{}'::jsonb
WHERE "paymentMethod" = 'SPLIT' AND "splitPayment" IS NULL;
