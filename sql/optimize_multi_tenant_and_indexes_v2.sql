-- 1. Ensure company_id exists and has an index on all relevant core tables
DO $$ 
DECLARE
    t_name text;
    tables text[] := ARRAY[
        'products', 'customers', 'sales', 'sale_items', 'purchase_orders', 'purchase_order_items', 
        'service_orders', 'services', 'crm_deals', 'crm_activities', 'orcamentos', 
        'orcamento_itens', 'cash_sessions', 'financial_transactions', 'catalog_items',
        'suppliers', 'customer_devices', 'transaction_categories', 'checklist_items', 'banco_horas'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        -- Add company_id if not exists
        BEGIN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid;', t_name);
        EXCEPTION
            WHEN undefined_table THEN
                -- Ignore if table does not exist
        END;

        -- Add Index on company_id if not exists
        BEGIN
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = t_name
            ) THEN
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON public.%I (company_id);', t_name, t_name);
            END IF;
        END;
    END LOOP;
END $$;

-- 2. Optimize search performance with composite indexes for frequently searched fields + company_id
CREATE INDEX IF NOT EXISTS idx_products_company_id_model ON public.products(company_id, model);
CREATE INDEX IF NOT EXISTS idx_customers_company_id_name ON public.customers(company_id, name);
CREATE INDEX IF NOT EXISTS idx_sales_company_id_date ON public.sales(company_id, date);
CREATE INDEX IF NOT EXISTS idx_service_orders_company_id_created_at ON public.service_orders(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_deals_company_id_status ON public.crm_deals(company_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_company_id_date ON public.financial_transactions(company_id, date);

-- 3. Optimize RLS and joins
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer_id ON public.service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_customer_id ON public.orcamentos(customer_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento_id ON public.orcamento_itens(orcamento_id);
