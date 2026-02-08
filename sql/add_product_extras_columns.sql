-- Add extra columns for photos, accessories, checklist data to products table
-- Run this in Supabase SQL Editor

-- Add photos column (array of base64 image strings or URLs)
ALTER TABLE products ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Add accessories column (array of accessory names)
ALTER TABLE products ADD COLUMN IF NOT EXISTS accessories JSONB DEFAULT '[]'::jsonb;

-- Add checklist column (object with checklist items and values)
ALTER TABLE products ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT NULL;

-- Add additionalCostPrice column (repair cost to be added to product cost)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "additionalCostPrice" DECIMAL(10,2) DEFAULT 0;

-- Add variations column (array of grade/value objects for product variations)
ALTER TABLE products ADD COLUMN IF NOT EXISTS variations JSONB DEFAULT '[]'::jsonb;

-- Add createdBy column (user ID who created the product)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "createdBy" TEXT DEFAULT NULL;

-- Add createdByName column (user name who created the product)
ALTER TABLE products ADD COLUMN IF NOT EXISTS "createdByName" TEXT DEFAULT NULL;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name IN ('photos', 'accessories', 'checklist', 'additionalCostPrice', 'variations', 'createdBy', 'createdByName');
