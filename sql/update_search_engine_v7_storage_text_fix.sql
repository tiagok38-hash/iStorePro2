-- =====================================================
-- iStore Pro: SEARCH ENGINE v7 - STORAGE TEXT MATCHING
-- Aplicado em: 2026-07-22
-- =====================================================
--
-- PROBLEMA CORRIGIDO:
--   Buscar "iPhone 17 pro max 1tb" retornava produtos de outros armazenamentos
--   (256GB, 512GB etc.), ou retornava zero resultados.
--
-- CAUSA RAIZ:
--   A versão anterior (v5/v6) removia a unidade de armazenamento da query,
--   transformando "1tb" → "1" (apenas o número). O token "1" batia em
--   qualquer produto que tivesse "1" no nome (iPhone 11, 17, 1TB etc.),
--   causando falsos positivos.
--
--   A tentativa de correção v6 convertia "1tb" → "1000" e filtrava pela
--   coluna `storage`. Porém, muitos produtos têm `storage = NULL` no banco
--   (o armazenamento está apenas no nome do modelo), então o filtro de coluna
--   falhava silenciosamente, retornando zero resultados.
--
-- SOLUÇÃO (v7 - Defense in Depth):
--   1. TypeScript (productService.ts): Remove a conversão de GB/TB.
--      A query é passada ao RPC com as unidades preservadas ("1tb", "256gb").
--
--   2. SQL (esta função): O `progressive_desc` usa apenas `model || color`,
--      e o nome do modelo já contém "1TB", "256GB" como texto
--      (ex: "iPhone 17 Pro Max 1TB Prateado"). O token "1tb" bate SOMENTE
--      em modelos com "1TB" no nome. Sem necessidade de coluna `storage`.
--
--   3. `v_second_is_numeric` corrigido: só aplica strict word-boundary check
--      para números <= 99 (versões de modelo: 11, 12, 13, 14, 15, 16, 17).
--      Valores de storage (256, 512, 1000) são >= 100 e aparecem como "256GB"
--      no texto do modelo (sem word boundary isolado), então o check é pulado.
--
-- EXEMPLOS:
--   "17 pro max 1tb"   → retorna APENAS produtos 1TB ✓
--   "17 pro max 256gb" → retorna APENAS produtos 256GB ✓
--   "17 pro max"       → retorna TODOS os armazenamentos ✓
--   "17" vs "11"       → strict numeric check diferencia corretamente ✓
-- =====================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

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
    v_search_tokens text[];
    v_first_token text;
    v_second_token text;
    v_second_is_numeric boolean;
    v_mapped_category text := NULL;
    v_has_search boolean;
    v_total bigint;
    v_is_identifier boolean;
BEGIN
    -- PHASE 0: Normalization
    -- The TypeScript layer sends storage units as-is ("1tb", "256gb").
    -- This SQL normalizes to lowercase and removes extra whitespace.
    v_search := lower(unaccent(trim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'))));
    v_has_search := (length(v_search) > 0);

    IF v_has_search THEN
        v_search_tokens := regexp_split_to_array(v_search, '\s+');
        v_first_token := v_search_tokens[1];

        IF array_length(v_search_tokens, 1) >= 2 THEN
            v_second_token := v_search_tokens[2];
        ELSE
            v_second_token := '';
        END IF;

        -- Identifier fast-path: single token >= 4 chars (IMEI, SN, SKU, barcode)
        v_is_identifier := (array_length(v_search_tokens, 1) = 1 AND length(v_search) >= 4);

        -- Strict Numeric Match: only applies to small numbers (model version numbers
        -- like 11, 12, 13, 14, 15, 16, 17). Storage values (256, 512, 1000) are >= 100
        -- and appear as "256GB"/"1TB" in model names — no isolated word boundary.
        v_second_is_numeric := (
            v_second_token ~ '^[0-9]+$'
            AND v_second_token::integer <= 99
        );

        -- Automatic category segmentation based on first token
        CASE v_first_token
            WHEN 'iphone'  THEN v_mapped_category := 'iphone';
            WHEN 'mac'     THEN v_mapped_category := 'mac';
            WHEN 'ipad'    THEN v_mapped_category := 'ipad';
            WHEN 'watch'   THEN v_mapped_category := 'watch';
            WHEN 'airpods' THEN v_mapped_category := 'airpods';
            WHEN 'capa'    THEN v_mapped_category := 'acessorios';
            WHEN 'case'    THEN v_mapped_category := 'acessorios';
            WHEN 'tela'    THEN v_mapped_category := 'pecas';
            WHEN 'bateria' THEN v_mapped_category := 'pecas';
            ELSE v_mapped_category := NULL;
        END CASE;
    ELSE
        v_is_identifier := false;
    END IF;

    -- PHASE 1: IDENTIFIER FAST PATH (IMEI, SN, SKU, barcode)
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
            1000::numeric, 1::bigint
        FROM products p
        WHERE
            (
                p.imei1 = v_search
                OR p.imei2 = v_search
                OR p."serialNumber" = p_query
                OR lower(p."serialNumber") = v_search
                OR lower(p.sku) = v_search
                OR (p.barcodes IS NOT NULL AND p.barcodes @> jsonb_build_array(p_query))
            )
            AND (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
        LIMIT 1;

        IF FOUND THEN RETURN; END IF;
    END IF;

    -- PHASE 2: NO SEARCH TERM — return all products with basic filters
    IF NOT v_has_search THEN
        SELECT COUNT(*) INTO v_total FROM products p
        WHERE
            (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR p.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple'    THEN lower(coalesce(p.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(p.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN p.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão'      THEN p.commission_enabled = true
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
            0::numeric, v_total
        FROM products p
        WHERE
            (CASE p_stock_filter WHEN 'in_stock' THEN p.stock > 0 WHEN 'out_of_stock' THEN p.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR p.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR p."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple'    THEN lower(coalesce(p.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(p.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN p.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão'      THEN p.commission_enabled = true
                ELSE true END)
        ORDER BY
            regexp_replace(lower(unaccent(coalesce(p.model, '') || ' ' || coalesce(p.color, ''))), '\s+', ' ', 'g') ASC,
            p.id DESC
        LIMIT p_limit OFFSET p_offset;
        RETURN;
    END IF;

    -- PHASE 3: FULL TEXT SEARCH — progressive token matching on model name
    --
    -- Key insight: progressive_desc = model + color.
    -- The model name already encodes storage as text ("1TB", "256GB", "512GB"),
    -- so token "1tb" matches ONLY 1TB models, "256gb" matches ONLY 256GB models,
    -- and no storage token means all storage sizes are returned.
    -- This works correctly even when the `storage` integer column is NULL.
    RETURN QUERY
    WITH computed_products AS (
        SELECT
            p.*,
            regexp_replace(lower(unaccent(
                coalesce(p.model, '') || ' ' ||
                coalesce(p.color, '')
            )), '\s+', ' ', 'g') AS progressive_desc
        FROM products p
    ),
    filtered AS (
        SELECT cp.*
        FROM computed_products cp
        WHERE
            -- Mandatory filters
            (CASE p_stock_filter WHEN 'in_stock' THEN cp.stock > 0 WHEN 'out_of_stock' THEN cp.stock = 0 ELSE true END)
            AND (p_condition_filter = 'Todos' OR cp.condition = p_condition_filter)
            AND (p_location_filter = 'Todos' OR cp."storageLocation" = p_location_filter)
            AND (CASE p_type_filter
                WHEN 'Produtos Apple'    THEN lower(coalesce(cp.brand, '')) = 'apple'
                WHEN 'Produtos Variados' THEN lower(coalesce(cp.brand, '')) != 'apple'
                WHEN 'Produtos de troca' THEN cp.origin IN ('Troca', 'Comprado de Cliente')
                WHEN 'Com Comissão'      THEN cp.commission_enabled = true
                ELSE true END)
            -- Text matching
            AND (
                -- 1. All search tokens must appear in progressive_desc (model + color)
                (
                    SELECT bool_and(cp.progressive_desc LIKE '%' || token || '%')
                    FROM unnest(v_search_tokens) AS token
                )
                -- 2. Strict version number match (e.g. "iphone 17" must not return "iphone 11")
                --    Only applies to numbers <= 99 (model versions, not storage values)
                AND (
                    NOT v_second_is_numeric
                    OR lower(unaccent(coalesce(cp.model, ''))) ~ ('\m' || v_second_token || '\M')
                )
                -- 3. Category match
                AND (
                    v_mapped_category IS NULL
                    OR lower(coalesce(cp.category, '')) LIKE '%' || v_mapped_category || '%'
                    OR (v_mapped_category = 'pecas'      AND cp.progressive_desc ~ '\m(tela|bateria|lcd|oled)\M')
                    OR (v_mapped_category = 'acessorios' AND cp.progressive_desc ~ '\m(capa|case|pelicula|cabo|fonte|fone)\M')
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
        s.progressive_desc ASC,
        s.id DESC
    LIMIT p_limit OFFSET p_offset;

END;
$function$;
