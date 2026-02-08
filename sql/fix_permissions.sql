-- FIX PERMISSIONS (RLS)
-- Copy and run this script in the Supabase SQL Editor to allow data insertion.

-- 1. CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.customers;
CREATE POLICY "Allow all for authenticated" ON public.customers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. SUPPLIERS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.suppliers;
CREATE POLICY "Allow all for authenticated" ON public.suppliers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. SALES
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.sales;
CREATE POLICY "Allow all for authenticated" ON public.sales
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.products;
CREATE POLICY "Allow all for authenticated" ON public.products
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.audit_logs;
CREATE POLICY "Allow insert for authenticated" ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for authenticated" ON public.audit_logs;
CREATE POLICY "Allow select for authenticated" ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- 6. USERS (Be careful here, usually we restrict this, but for fixing the bug let's open it to auth users for now)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.users;
CREATE POLICY "Allow read for authenticated" ON public.users
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow update for authenticated" ON public.users;
CREATE POLICY "Allow update for authenticated" ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
