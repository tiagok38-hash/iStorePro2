-- =====================================================
-- SERVER-SIDE SEARCH ENGINE FOR PRODUCTS
-- Applied to Supabase project: bgwfyumunybbdthgykoh
-- =====================================================

-- MIGRATION 1: add_search_vector_and_indexes
-- Adds tsvector column, trigger, and indexes

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE products SET search_vector = 
    setweight(to_tsvector('simple', coalesce(model, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(sku, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(brand, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(color, '')), 'D');

CREATE OR REPLACE FUNCTION products_search_vector_trigger() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.model, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.sku, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.brand, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(NEW.color, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
    BEFORE INSERT OR UPDATE OF model, sku, brand, color
    ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_search_vector_trigger();

CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_products_imei1 ON products(imei1) WHERE imei1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_imei2 ON products(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_serial ON products("serialNumber") WHERE "serialNumber" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_model_trgm ON products USING GIN(model gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products("createdAt" DESC);


-- MIGRATION 2: create_search_products_rpc
-- RPC function with relevance scoring, Pro/Max penalties, phrase matching

-- See search_products function in Supabase for full implementation.
-- Function signature:
-- search_products(
--   p_query text,
--   p_stock_filter text DEFAULT 'in_stock',
--   p_condition_filter text DEFAULT 'Todos',
--   p_location_filter text DEFAULT 'Todos',
--   p_type_filter text DEFAULT 'Todos',
--   p_sort_order text DEFAULT 'relevance',
--   p_limit int DEFAULT 15,
--   p_offset int DEFAULT 0
-- )
--
-- SCORING RULES:
--   +200 = IMEI/Serial exact match (only for 5+ digit numeric input)
--   +100 = Exact phrase match in model (e.g. "17 256gb" adjacent in "iPhone 17 256GB")
--    +50 = All tokens present as whole words in model
--    +50 * ts_rank_cd = Full-text search rank
--    -40 = Product has 'pro' but user didn't search for 'pro'
--    -20 = Product has 'max' but user didn't search for 'max'
--    -30 = Per unmatched search token
--     -5 = Per extra model word beyond search terms + 2
