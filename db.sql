-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_logs (
  id text NOT NULL,
  timestamp text,
  userId text,
  userName text,
  action text,
  details text,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.business_settings (
  id text NOT NULL DEFAULT 'default'::text,
  businessName text NOT NULL DEFAULT 'Port Side Liquor'::text,
  tagline text,
  phone text NOT NULL DEFAULT '+254 700 000000'::text,
  email text,
  location text NOT NULL DEFAULT 'Nairobi, Kenya'::text,
  logoUrl text,
  receiptFooter text DEFAULT 'Thank you for your business!'::text,
  evolutionApiUrl text,
  evolutionApiKey text,
  evolutionInstance text,
  CONSTRAINT business_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  size text,
  brand text,
  sku text,
  costPrice numeric,
  sellingPrice numeric,
  supplier text,
  stock integer DEFAULT 0,
  lowStockThreshold integer DEFAULT 5,
  barcode text,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sales (
  id text NOT NULL,
  timestamp text,
  cashierId text,
  cashierName text,
  totalAmount numeric,
  totalCost numeric,
  paymentMethod text,
  items jsonb,
  isVoided boolean DEFAULT false,
  voidedAt timestamp with time zone,
  voidedBy text,
  voidReason text,
  CONSTRAINT sales_pkey PRIMARY KEY (id)
);
CREATE TABLE public.shifts (
  id text NOT NULL,
  cashierId text,
  cashierName text,
  startTime text,
  endTime text,
  openingCash numeric,
  closingCash numeric,
  expectedCash numeric,
  status text,
  comments text,
  CONSTRAINT shifts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  pin text NOT NULL,
  permissions ARRAY,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);