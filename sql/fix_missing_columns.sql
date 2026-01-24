-- 1. Fix CUSTOMERS table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_blocked boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS custom_tag text;

-- 2. Fix SUPPLIERS table
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS linked_customer_id uuid REFERENCES public.customers(id);

-- 3. Fix SALES table (Standardizing to snake_case)
ALTER TABLE public.sales ALTER COLUMN id TYPE text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS date timestamp with time zone DEFAULT now();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS origin text DEFAULT 'PDV';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS observations text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text DEFAULT 'Finalizada';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS salesperson_id uuid REFERENCES public.users(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS pos_terminal text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS warranty_term text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS lead_origin text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payments jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;

-- 4. Fix PURCHASE_ORDERS table
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS items jsonb;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS "supplierId" uuid;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS "supplierName" text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'Pendente';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS "additionalCost" numeric DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS observations text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS "purchaseDate" timestamp with time zone DEFAULT now();

-- 5. Fix PRODUCTS table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "costPrice" numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "wholesalePrice" numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "serialNumber" text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS imei1 text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS imei2 text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "batteryHealth" integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition text DEFAULT 'Novo';

-- 6. Fix CASH_SESSIONS table (Standardizing to snake_case)
CREATE TABLE IF NOT EXISTS public.cash_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid,
    display_id integer,
    opening_balance numeric DEFAULT 0,
    cash_in_register numeric DEFAULT 0,
    withdrawals numeric DEFAULT 0,
    deposits numeric DEFAULT 0,
    movements jsonb,
    open_time timestamp with time zone DEFAULT now(),
    close_time timestamp with time zone,
    status text DEFAULT 'fechado'
);

-- Add missing columns if table already exists (snake_case)
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS display_id integer;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS cash_in_register numeric DEFAULT 0;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS withdrawals numeric DEFAULT 0;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS deposits numeric DEFAULT 0;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS movements jsonb;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS open_time timestamp with time zone DEFAULT now();
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS close_time timestamp with time zone;
ALTER TABLE public.cash_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'fechado';

-- 7. AUDIT_LOGS table (already snake_case usually but ensures standard)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name text;

-- Enable RLS and Policies for critical tables
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on cash_sessions" ON public.cash_sessions;
CREATE POLICY "Allow all operations on cash_sessions" ON public.cash_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all operations on audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);