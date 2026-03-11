-- Fix os_part_usage_history missing company_id
ALTER TABLE public.os_part_usage_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_os_part_usage_history_company_id ON public.os_part_usage_history(company_id);

-- Missing Foreign Key Indexes

DO $$
DECLARE
    r RECORD;
    idx_name TEXT;
    q TEXT;
BEGIN
    FOR r IN (
        SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
    ) LOOP
        idx_name := 'idx_' || r.table_name || '_' || r.column_name;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = idx_name AND n.nspname = 'public'
        ) THEN
            q := 'CREATE INDEX IF NOT EXISTS "' || idx_name || '" ON "public"."' || r.table_name || '" ("' || r.column_name || '");';
            EXECUTE q;
        END IF;
    END LOOP;
END;
$$;


-- Clean up Duplicate Indexes
DROP INDEX IF EXISTS public.idx_ft_due_date;
DROP INDEX IF EXISTS public.idx_ft_status;
DROP INDEX IF EXISTS public.idx_inventory_movements_company_id;
DROP INDEX IF EXISTS public.idx_products_serial_number;
DROP INDEX IF EXISTS public.sales_date_idx;