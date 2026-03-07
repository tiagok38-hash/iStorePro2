ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS payments jsonb DEFAULT '[]'::jsonb;
