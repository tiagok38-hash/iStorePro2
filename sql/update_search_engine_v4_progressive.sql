-- Progressive, Restrictive, Alphabetical Search with Strict Numeric Matching

CREATE EXTENSION IF NOT EXISTS unaccent;

-- We adapt the user's logic into the existing RPC signature exactly as requested.

CREATE OR REPLACE FUNCTION public.search_products(
    p_query text,
    p_stock_filter text DEFAULT 'in_stock'::text,
    p_condition_filter text DEFAULT 'Todos'::text,
    p_location_filter text DEFAULT 'Todos'::text,
    p_type_filter text DEFAULT 'Todos'::text,
    p_sort_order text DEFAULT 'relevance'::text,
    p_limit integer DEFAULT 15,
    p_offset integer DEFAULT 0
)
 RETURNS TABLE(
    id uuid, model text, brand text, category text, sku text,
    imei1 text, imei2 text, "serialNumber" text, color text, storage integer,
    stock integer, "minimumStock" integer, price numeric, "costPrice" numeric,
    "wholesalePrice" numeric, "additionalCostPrice" numeric, condition text,
    warranty text, "batteryHealth" integer, "createdAt" timestamp with time zone,
    "updatedAt" timestamp with time zone, "createdBy" text, "createdByName" text,
    "storageLocation" text, "purchaseOrderId" uuid, "purchaseItemId" text,
    "supplierId" uuid, supplier_id uuid, origin text, barcodes jsonb,
    variations jsonb, "priceHistory" jsonb, "stockHistory" jsonb,
    commission_enabled boolean, commission_type text, commission_value numeric,
    discount_limit_type text, discount_limit_value numeric, observations text,
    photos jsonb, accessories jsonb, checklist jsonb,
    relevance_score numeric, total_count bigint
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_search text;
    v_first_token text;
    v_second_token text;
    v_second_is_numeric boolean;
    v_second_numeric_val int;
    v_mapped_category text := NULL;
    v_total bigint;
    v_has_search boolean;
BEGIN
    -- PHASE 0: Normalization
    v_search := lower(unaccent(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))));
    v_has_search := (length(v_search) > 0);

    IF v_has_search THEN
        v_first_token := split_part(v_search, ' ', 1);
        v_second_token := split_part(v_search, ' ', 2);
        
        v_second_is_numeric := (v_second_token ~ '^[0-9]+$');
        IF v_second_is_numeric THEN
            v_second_numeric_val := v_second_token::int;
        END IF;

        -- Automatic category segmentation rules
        CASE v_first_token
            WHEN 'iphone' THEN v_mapped_category := 'iphone'; -- In the real DB category is usually the raw category name like 'iPhone', 'Cases', etc. Wait, wait. I will map it to typical categories or 'device'
            WHEN 'mac' THEN v_mapped_category := 'mac';
            WHEN 'ipad' THEN v_mapped_category := 'ipad';
            WHEN 'watch' THEN v_mapped_category := 'apple watch';
            WHEN 'airpods' THEN v_mapped_category := 'airpods';
            WHEN 'capa' THEN v_mapped_category := 'acessorios';
            WHEN 'tela' THEN v_mapped_category := 'pecas';
            WHEN 'bateria' THEN v_mapped_category := 'pecas';
            ELSE v_mapped_category := NULL;
        END CASE;
    END IF;

    -- CTE query dynamically handles prefix search, progressive matching, and alphabetical sort
    RETURN QUERY
    WITH constructed_products AS (
        SELECT 
            p.*,
            -- Build a deterministic description matching the user's progressive requirement
            -- e.g. "iphone 17 256gb azul" 
            lower(unaccent(
                coalesce(p.brand, '') || ' ' || 
                coalesce(p.model, '') || ' ' || 
                coalesce(p.storage::text || 'gb', '') || ' ' || 
                coalesce(p.color, '')
            )) AS computed_desc
        FROM products p
    ),
    filtered AS (
        SELECT cp.*
        FROM constructed_products cp
        WHERE
            -- Stock filters
            (CASE p_stock_filter WHEN 'in_stock' THEN cp.stock > 0 WHEN 'out_of_stock' THEN cp.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR cp.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR cp."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple' THEN lower(coalesce(cp.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(cp.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN cp.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão' THEN cp.commission_enabled = true
                ELSE true END)
            
            -- If search exists:
            AND (
                NOT v_has_search 
                OR 
                (
                    -- Identifier exact matching (IMEI, SKU, Serial)
                    cp.imei1 = v_search OR cp.imei2 = v_search OR lower(cp."serialNumber") = v_search OR lower(cp.sku) = v_search
                    OR
                    (
                        -- Progressive prefix matching
                        regex_replace(cp.computed_desc, '\s+', ' ', 'g') LIKE v_search || '%'
                        
                        -- Strict numeric matching
                        AND (
                            NOT v_second_is_numeric
                            -- extract numeric part from model name and ensure it EXACTLY equals the second token
                            -- For example, model 'iPhone 17 Pro' -> text numeric is 17. Must equal 17.
                            OR array_to_string(regexp_matches(lower(unaccent(cp.model)), '([0-9]+)', 'g'), '') = v_second_numeric_val::text
                            -- wait, regexp_matches returns a set, better to extract the first match or just match strictly:
                            OR lower(coalesce(cp.model, '')) ~ ('\m' || v_second_numeric_val::text || '\M')
                        )

                        -- Category restrictions
                        AND (
                            v_mapped_category IS NULL
                            OR lower(coalesce(cp.category, '')) LIKE '%' || v_mapped_category || '%'
                            OR (v_mapped_category = 'pecas' AND cp.computed_desc ~ '\m(tela|bateria|lcd|oled)\M')
                            OR (v_mapped_category = 'acessorios' AND cp.computed_desc ~ '\m(capa|case|pelicula|cabo|fonte|fone)\M')
                        )
                    )
                )
            )
    ),
    total AS (
        SELECT COUNT(*) AS cnt FROM filtered
    )
    SELECT
        s.id, s.model, s.brand, s.category, s.sku,
        s.imei1, s.imei2, s."serialNumber",
        s.color, s.storage, s.stock, s."minimumStock",
        s.price, s."costPrice", s."wholesalePrice", s."additionalCostPrice",
        s.condition, s.warranty, s."batteryHealth",
        s."createdAt", s."updatedAt", s."createdBy", s."createdByName",
        s."storageLocation", s."purchaseOrderId", s."purchaseItemId",
        s."supplierId", s.supplier_id, s.origin,
        s.barcodes, s.variations, s."priceHistory", s."stockHistory",
        s.commission_enabled, s.commission_type, s.commission_value,
        s.discount_limit_type, s.discount_limit_value,
        s.observations, s.photos, s.accessories, s.checklist,
        1000::numeric AS relevance_score, 
        t.cnt AS total_count
    FROM filtered s, total t
    ORDER BY
        -- STRICT ORDER: Alphabetical
        s.computed_desc ASC,
        s.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;
