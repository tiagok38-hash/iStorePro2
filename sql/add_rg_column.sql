-- Execute este comando no SQL Editor do Supabase para adicionar a coluna RG
ALTER TABLE customers ADD COLUMN IF NOT EXISTS rg TEXT;

-- Opcional: Criar índice para melhorar a performance de busca por RG
CREATE INDEX IF NOT EXISTS idx_customers_rg ON customers(rg);
