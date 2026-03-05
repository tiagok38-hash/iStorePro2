-- Criar tabela de dispositivos de clientes
CREATE TABLE IF NOT EXISTS public.customer_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    customer_id uuid REFERENCES public.customers(id),
    brand text NOT NULL,
    category text NOT NULL,
    model text NOT NULL,
    imei text,
    serial_number text,
    observations text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.customer_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on customer_devices" ON public.customer_devices;
CREATE POLICY "Allow all operations on customer_devices" ON public.customer_devices FOR ALL USING (true) WITH CHECK (true);

-- Adicionar colunas em service_orders
ALTER TABLE public.service_orders
ADD COLUMN IF NOT EXISTS attendant_observations text,
ADD COLUMN IF NOT EXISTS customer_device_id uuid REFERENCES public.customer_devices(id);
