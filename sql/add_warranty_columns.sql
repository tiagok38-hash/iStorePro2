-- Migração: Adicionar campos de garantia na tabela service_orders
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna is_warranty se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'service_orders'
        AND column_name = 'is_warranty'
    ) THEN
        ALTER TABLE public.service_orders ADD COLUMN is_warranty BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Coluna is_warranty adicionada com sucesso.';
    ELSE
        RAISE NOTICE 'Coluna is_warranty já existe.';
    END IF;
END $$;

-- Adicionar coluna parent_os_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'service_orders'
        AND column_name = 'parent_os_id'
    ) THEN
        ALTER TABLE public.service_orders ADD COLUMN parent_os_id UUID REFERENCES public.service_orders(id) ON DELETE SET NULL;
        RAISE NOTICE 'Coluna parent_os_id adicionada com sucesso.';
    ELSE
        RAISE NOTICE 'Coluna parent_os_id já existe.';
    END IF;
END $$;
