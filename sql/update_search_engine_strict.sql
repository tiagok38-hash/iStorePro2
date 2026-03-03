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
    v_normalized text;
    v_tokens text[];
    v_token_count int;
    v_first_token text;
    v_first_two_tokens text;
    v_has_search boolean;
    v_is_identifier boolean;
    v_total bigint;
    v_inferred_category text := NULL;
BEGIN
    -- PHASE 0: Normalization
    v_normalized := lower(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')));
    v_normalized := unaccent(v_normalized); -- Assuming unaccent is available
    
    v_has_search := (length(v_normalized) > 0);

    IF v_has_search THEN
        v_tokens := regexp_split_to_array(v_normalized, '\s+');
        v_token_count := array_length(v_tokens, 1);
        v_first_token := v_tokens[1];
        
        IF v_token_count >= 2 THEN
            v_first_two_tokens := v_tokens[1] || ' ' || v_tokens[2];
        ELSE
            v_first_two_tokens := v_first_token;
        END IF;

        -- Alphanumeric allowed for identifiers (SKU, IMEI, SN)
        v_is_identifier := (v_token_count = 1 AND length(v_normalized) >= 4);

        -- Infer category intent from the first word
        -- User spec: iphone -> device, capa -> case, tela -> screen, etc.
        -- We apply a mapping heuristic for category or type
        CASE v_first_token
            WHEN 'iphone' THEN v_inferred_category := 'device';
            WHEN 'ipad' THEN v_inferred_category := 'device';
            WHEN 'mac' THEN v_inferred_category := 'device';
            WHEN 'macbook' THEN v_inferred_category := 'device';
            WHEN 'watch' THEN v_inferred_category := 'device';
            WHEN 'airpods' THEN v_inferred_category := 'device';
            WHEN 'smartphone' THEN v_inferred_category := 'device';
            WHEN 'capa' THEN v_inferred_category := 'accessory';
            WHEN 'case' THEN v_inferred_category := 'accessory';
            WHEN 'pelicula' THEN v_inferred_category := 'accessory';
            WHEN 'cabo' THEN v_inferred_category := 'accessory';
            WHEN 'fonte' THEN v_inferred_category := 'accessory';
            WHEN 'carregador' THEN v_inferred_category := 'accessory';
            WHEN 'fone' THEN v_inferred_category := 'accessory';
            WHEN 'tela' THEN v_inferred_category := 'part';
            WHEN 'bateria' THEN v_inferred_category := 'part';
            WHEN 'lcd' THEN v_inferred_category := 'part';
            WHEN 'oled' THEN v_inferred_category := 'part';
            ELSE v_inferred_category := NULL;
        END CASE;
    ELSE
        v_tokens := ARRAY[]::text[];
        v_token_count := 0;
        v_first_token := '';
        v_is_identifier := false;
    END IF;

    -- PHASE 1: IDENTIFIER FAST PATH (POS OPTIMIZATION)
    IF v_is_identifier THEN
        RETURN QUERY
        SELECT
            p.id, p.model, p.brand, p.category, p.sku,
            p.imei1, p.imei2, p."serialNumber",
            p.color, p.storage, p.stock, p."minimumStock",
            p.price, p."costPrice", p."wholesalePrice", p."additionalCostPrice",
            p.condition, p.warranty, p."batteryHealth",
            p."createdAt", p."updatedAt", p."createdBy", p."createdByName",
            p."storageLocation", p."purchaseOrderId", p."purchaseItemId",
            p."supplierId", p.supplier_id, p.origin,
            p.barcodes, p.variations, p."priceHistory", p."stockHistory",
            p.commission_enabled, p.commission_type, p.commission_value,
            p.discount_limit_type, p.discount_limit_value,
            p.observations, p.photos, p.accessories, p.checklist,
            1000::numeric, -- Highest relevance
            1::bigint
        FROM products p
        WHERE 
            (
                p.imei1 = v_normalized 
                OR p.imei2 = v_normalized 
                OR p."serialNumber" = p_query
                OR lower(p."serialNumber") = v_normalized
                OR lower(p.sku) = v_normalized
                OR (p.barcodes IS NOT NULL AND p.barcodes @> jsonb_build_array(p_query))
                OR (p.barcodes IS NOT NULL AND p.barcodes @> jsonb_build_array(v_normalized))
            )
            AND (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- NO SEARCH CASE
    IF NOT v_has_search THEN
        SELECT COUNT(*) INTO v_total FROM products p
        WHERE
            (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR p.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple' THEN lower(coalesce(p.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(p.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN p.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão' THEN p.commission_enabled = true
                ELSE true END);

        RETURN QUERY
        SELECT
            p.id, p.model, p.brand, p.category, p.sku,
            p.imei1, p.imei2, p."serialNumber",
            p.color, p.storage, p.stock, p."minimumStock",
            p.price, p."costPrice", p."wholesalePrice", p."additionalCostPrice",
            p.condition, p.warranty, p."batteryHealth",
            p."createdAt", p."updatedAt", p."createdBy", p."createdByName",
            p."storageLocation", p."purchaseOrderId", p."purchaseItemId",
            p."supplierId", p.supplier_id, p.origin,
            p.barcodes, p.variations, p."priceHistory", p."stockHistory",
            p.commission_enabled, p.commission_type, p.commission_value,
            p.discount_limit_type, p.discount_limit_value,
            p.observations, p.photos, p.accessories, p.checklist,
            0::numeric, -- No relevance
            v_total
        FROM products p
        WHERE
            (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR p.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple' THEN lower(coalesce(p.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(p.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN p.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão' THEN p.commission_enabled = true
                ELSE true END)
        ORDER BY
            CASE WHEN p_sort_order = 'oldest' THEN extract(epoch from p."createdAt")
                 ELSE -extract(epoch from p."createdAt") END,
            p.id DESC
        LIMIT p_limit OFFSET p_offset;
        RETURN;
    END IF;

    -- PHASE 2: PREFIX-BASED EXACT MATCH SEARCH WITH INFERRED CATEGORY FILTERING
    RETURN QUERY
    WITH candidates AS (
        SELECT p.*
        FROM products p
        WHERE
            (
                p.normalized_description LIKE '%' || v_normalized || '%'
                OR p.normalized_description LIKE v_first_token || '%'
                OR unaccent(lower(p.model)) LIKE v_first_token || '%'
                OR unaccent(lower(p.model)) LIKE v_normalized || '%'
                OR (
                    -- Fallback token matching if strict prefix fails
                    v_token_count > 1 
                    AND p.normalized_description LIKE '%' || v_first_token || '%' 
                    AND p.normalized_description LIKE '%' || v_tokens[v_token_count] || '%'
                )
            )
            AND (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR p.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple' THEN lower(coalesce(p.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(p.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN p.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão' THEN p.commission_enabled = true
                ELSE true END)
            AND (
                v_inferred_category IS NULL 
                OR (v_inferred_category = 'device' AND lower(coalesce(p.category, '')) IN ('iphone','ipad','mac','watch','airpods','smartphone','console'))
                OR (v_inferred_category = 'accessory' AND lower(coalesce(p.category, '')) NOT IN ('iphone','ipad','mac','watch','smartphone','console') AND NOT p.normalized_description ~ '\m(tela|bateria|lcd|oled)\M')
                OR (v_inferred_category = 'part' AND p.normalized_description ~ '\m(tela|bateria|lcd|oled)\M')
            )
    ),
    scored AS (
        SELECT c.*,
            (
                -- L1: STRICT PREFIX FULL MATCH -> Highest
                CASE WHEN c.normalized_description LIKE v_normalized || '%' 
                       OR unaccent(lower(c.model)) LIKE v_normalized || '%' THEN 1000
                -- L2: STRICT PREFIX TWO TOKENS
                WHEN c.normalized_description LIKE v_first_two_tokens || '%' 
                  OR unaccent(lower(c.model)) LIKE v_first_two_tokens || '%' THEN 800
                -- L3: STRICT PREFIX FIRST TOKEN
                WHEN c.normalized_description LIKE v_first_token || '%' 
                  OR unaccent(lower(c.model)) LIKE v_first_token || '%' THEN 500
                -- L4: FULL MATCH ANYWHERE (Substring)
                WHEN c.normalized_description LIKE '%' || v_normalized || '%' THEN 300
                -- L5: FALLBACK TOKEN MATCH
                ELSE 100
                END
                -- Tie breakers: penalty if search tokens are missing
                - CASE WHEN v_token_count > 1 AND NOT (c.normalized_description LIKE '%' || v_tokens[2] || '%') THEN 50 ELSE 0 END
                - CASE WHEN v_token_count > 2 AND NOT (c.normalized_description LIKE '%' || v_tokens[3] || '%') THEN 50 ELSE 0 END
            )::numeric AS _relevance_score
        FROM candidates c
    ),
    filtered AS (
        SELECT * FROM scored WHERE _relevance_score > 0
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
        s._relevance_score,
        t.cnt
    FROM filtered s, total t
    ORDER BY
        -- STRICT ORDER 1: Relevance Score (Prefix rules)
        s._relevance_score DESC,
        -- STRICT ORDER 2: Stock priority
        s.stock DESC,
        -- STRICT ORDER 3: Creation date (newest first)
        s."createdAt" DESC,
        s.id DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$;
