
-- Script para criar a tabela de Ordens de Serviço (OS)
-- Execute este script no SQL Editor do seu Dashboard do Supabase

CREATE TABLE IF NOT EXISTS public.service_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    display_id integer,
    customer_id uuid REFERENCES public.customers(id),
    customer_name text,
    device_model text,
    imei text,
    serial_number text,
    passcode text,
    pattern_lock integer[],
    defect_description text,
    technical_report text,
    observations text,
    status text DEFAULT 'Aberto',
    items jsonb DEFAULT '[]'::jsonb,
    subtotal numeric DEFAULT 0,
    discount numeric DEFAULT 0,
    total numeric DEFAULT 0,
    responsible_id uuid REFERENCES public.users(id),
    responsible_name text,
    photos text[] DEFAULT '{}'::text[],
    entry_date timestamp with time zone DEFAULT now(),
    exit_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS (Segurança em nível de linha)
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir acesso total (ajuste conforme necessário para produção)
DROP POLICY IF EXISTS "Allow all operations on service_orders" ON public.service_orders;
CREATE POLICY "Allow all operations on service_orders" ON public.service_orders FOR ALL USING (true) WITH CHECK (true);

-- Criar trigger para auto-atualizar o updated_at se necessário (opcional)
-- Caso queira automatizar o updated_at, você pode adicionar uma função de trigger aqui.
