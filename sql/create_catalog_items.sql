
-- Script para criar a tabela de Itens do Catálogo Virtual
-- Execute este script no SQL Editor do seu Dashboard do Supabase

CREATE TABLE IF NOT EXISTS public.catalog_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    display_order integer DEFAULT 0,
    cost_price numeric DEFAULT 0,
    sale_price numeric DEFAULT 0,
    card_price numeric DEFAULT 0,
    installments integer DEFAULT 1,
    section text DEFAULT 'Destaques',
    is_active boolean DEFAULT true,
    image_url text,
    condition text DEFAULT 'Novo',
    battery_health integer,
    product_name text,
    product_brand text,
    product_category text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS (Segurança em nível de linha)
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- Política pública para leitura (vitrine pública)
DROP POLICY IF EXISTS "Allow public read on catalog_items" ON public.catalog_items;
CREATE POLICY "Allow public read on catalog_items" ON public.catalog_items FOR SELECT USING (true);

-- Política para operações de admin
DROP POLICY IF EXISTS "Allow all operations on catalog_items" ON public.catalog_items;
CREATE POLICY "Allow all operations on catalog_items" ON public.catalog_items FOR ALL USING (true) WITH CHECK (true);
