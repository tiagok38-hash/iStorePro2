-- Execute estes comandos no SQL Editor do Supabase para criar as tabelas necessárias

-- 1. Tabela de Marcas (brands)
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Categorias (categories) - vinculada a marcas
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Modelos de Produto (product_models) - vinculada a categorias
CREATE TABLE IF NOT EXISTS product_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Grades (grades) - ex: Cor, Armazenamento
CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Valores de Grade (grade_values) - ex: Azul, 256GB
CREATE TABLE IF NOT EXISTS grade_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grade_id UUID REFERENCES grades(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Se as tabelas já existem mas faltam as colunas de relacionamento, use estes comandos:
-- ALTER TABLE categories ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id);
-- ALTER TABLE product_models ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
-- ALTER TABLE grade_values ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES grades(id);

-- Habilitar RLS (Row Level Security) se necessário
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_values ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (ajuste conforme necessário)
CREATE POLICY "Enable all access for all users" ON brands FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON categories FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON product_models FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON grades FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON grade_values FOR ALL USING (true);

-- Adicionar coluna instagram na tabela customers e suppliers (Solicitado em 2026-01-18)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS instagram TEXT;

