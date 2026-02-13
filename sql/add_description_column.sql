-- Adiciona coluna de descrição à tabela de itens do catálogo
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS description TEXT;
