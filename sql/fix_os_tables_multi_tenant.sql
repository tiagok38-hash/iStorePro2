-- Script to fix multi-tenant setup for recently added tables
-- Company ID Padrão: 59322755-8d69-4bff-b4d3-41826aaaebe2

DO $$ 
DECLARE
    default_company_id UUID := '59322755-8d69-4bff-b4d3-41826aaaebe2';
BEGIN
    ---------------------------------------------------------------------------
    -- 1. ADD COMPANY_ID COLUMN (IF MISSING) AND SET DEFAULT
    ---------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'checklist_items' AND column_name = 'company_id') THEN
        ALTER TABLE public.checklist_items ADD COLUMN company_id UUID;
        UPDATE public.checklist_items SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE public.checklist_items ALTER COLUMN company_id SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_devices' AND column_name = 'company_id') THEN
        ALTER TABLE public.customer_devices ADD COLUMN company_id UUID;
        UPDATE public.customer_devices SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE public.customer_devices ALTER COLUMN company_id SET NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os_parts_stock_history' AND column_name = 'company_id') THEN
        ALTER TABLE public.os_parts_stock_history ADD COLUMN company_id UUID;
        UPDATE public.os_parts_stock_history SET company_id = default_company_id WHERE company_id IS NULL;
        ALTER TABLE public.os_parts_stock_history ALTER COLUMN company_id SET NOT NULL;
    END IF;

    UPDATE public.os_parts SET company_id = default_company_id::text WHERE company_id IS NULL;
    ALTER TABLE public.os_parts ALTER COLUMN company_id TYPE UUID USING company_id::UUID;
    ALTER TABLE public.os_parts ALTER COLUMN company_id SET NOT NULL;

    UPDATE public.os_purchase_orders SET company_id = default_company_id::text WHERE company_id IS NULL;
    ALTER TABLE public.os_purchase_orders ALTER COLUMN company_id TYPE UUID USING company_id::UUID;
    ALTER TABLE public.os_purchase_orders ALTER COLUMN company_id SET NOT NULL;

    UPDATE public.os_warranties SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.os_warranties ALTER COLUMN company_id SET NOT NULL;

    UPDATE public.os_product_conditions SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.os_product_conditions ALTER COLUMN company_id SET NOT NULL;

    UPDATE public.os_payment_methods SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.os_payment_methods ALTER COLUMN company_id SET NOT NULL;

    UPDATE public.os_receipt_terms SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.os_receipt_terms ALTER COLUMN company_id SET NOT NULL;

    UPDATE public.os_storage_locations SET company_id = default_company_id WHERE company_id IS NULL;
    ALTER TABLE public.os_storage_locations ALTER COLUMN company_id SET NOT NULL;

END $$;

---------------------------------------------------------------------------
-- 2. CREATE INDEXES ON COMPANY_ID
---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_checklist_items_company_id ON public.checklist_items(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_devices_company_id ON public.customer_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_os_parts_stock_history_company_id ON public.os_parts_stock_history(company_id);
CREATE INDEX IF NOT EXISTS idx_os_parts_company_id ON public.os_parts(company_id);
CREATE INDEX IF NOT EXISTS idx_os_purchase_orders_company_id ON public.os_purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_os_warranties_company_id ON public.os_warranties(company_id);
CREATE INDEX IF NOT EXISTS idx_os_product_conditions_company_id ON public.os_product_conditions(company_id);
CREATE INDEX IF NOT EXISTS idx_os_payment_methods_company_id ON public.os_payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_os_receipt_terms_company_id ON public.os_receipt_terms(company_id);
CREATE INDEX IF NOT EXISTS idx_os_storage_locations_company_id ON public.os_storage_locations(company_id);

---------------------------------------------------------------------------
-- 3. ADD TRIGGERS FOR AUTO-SETTING COMPANY_ID ON INSERT
---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_company_id_checklist_items ON public.checklist_items;
CREATE TRIGGER set_company_id_checklist_items
    BEFORE INSERT ON public.checklist_items
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_customer_devices ON public.customer_devices;
CREATE TRIGGER set_company_id_customer_devices
    BEFORE INSERT ON public.customer_devices
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_parts_stock_history ON public.os_parts_stock_history;
CREATE TRIGGER set_company_id_os_parts_stock_history
    BEFORE INSERT ON public.os_parts_stock_history
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_parts ON public.os_parts;
CREATE TRIGGER set_company_id_os_parts
    BEFORE INSERT ON public.os_parts
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_purchase_orders ON public.os_purchase_orders;
CREATE TRIGGER set_company_id_os_purchase_orders
    BEFORE INSERT ON public.os_purchase_orders
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_warranties ON public.os_warranties;
CREATE TRIGGER set_company_id_os_warranties
    BEFORE INSERT ON public.os_warranties
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_product_conditions ON public.os_product_conditions;
CREATE TRIGGER set_company_id_os_product_conditions
    BEFORE INSERT ON public.os_product_conditions
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_payment_methods ON public.os_payment_methods;
CREATE TRIGGER set_company_id_os_payment_methods
    BEFORE INSERT ON public.os_payment_methods
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_receipt_terms ON public.os_receipt_terms;
CREATE TRIGGER set_company_id_os_receipt_terms
    BEFORE INSERT ON public.os_receipt_terms
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

DROP TRIGGER IF EXISTS set_company_id_os_storage_locations ON public.os_storage_locations;
CREATE TRIGGER set_company_id_os_storage_locations
    BEFORE INSERT ON public.os_storage_locations
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

---------------------------------------------------------------------------
-- 4. DROP EXISTING PERMISSIVE RLS POLICIES
---------------------------------------------------------------------------
-- We use a DO block to ignore errors if proper policies don't exist
DO $$ 
DECLARE
    table_rec RECORD;
    policy_rec RECORD;
BEGIN
    FOR table_rec IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'checklist_items', 'customer_devices', 'os_parts_stock_history', 'os_parts', 
        'os_purchase_orders', 'os_warranties', 'os_product_conditions', 
        'os_payment_methods', 'os_receipt_terms', 'os_storage_locations'
    )
    LOOP
        FOR policy_rec IN SELECT policyname FROM pg_policies WHERE tablename = table_rec.tablename AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_rec.policyname, table_rec.tablename);
        END LOOP;
    END LOOP;
END $$;

---------------------------------------------------------------------------
-- 5. ENABLE RLS AND CREATE NEW TENANT-BASED POLICIES
---------------------------------------------------------------------------
-- Enable RLS just in case it isn't enabled
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_parts_stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_product_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_receipt_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_storage_locations ENABLE ROW LEVEL SECURITY;

-- Create unified ALL policy for each table based on company_id
CREATE POLICY "company_isolation_checklist_items" ON public.checklist_items 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_customer_devices" ON public.customer_devices 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_parts_stock_history" ON public.os_parts_stock_history 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_parts" ON public.os_parts 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_purchase_orders" ON public.os_purchase_orders 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_warranties" ON public.os_warranties 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_product_conditions" ON public.os_product_conditions 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_payment_methods" ON public.os_payment_methods 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_receipt_terms" ON public.os_receipt_terms 
    FOR ALL USING (company_id = public.get_my_company_id());

CREATE POLICY "company_isolation_os_storage_locations" ON public.os_storage_locations 
    FOR ALL USING (company_id = public.get_my_company_id());
