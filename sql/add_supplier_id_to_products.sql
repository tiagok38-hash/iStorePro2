-- Adicionar coluna supplier_id à tabela products
-- Esta coluna liga o produto ao fornecedor que o vendeu/trocou para a loja

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

-- Comentário explicativo
COMMENT ON COLUMN public.products.supplier_id IS 'ID do fornecedor que vendeu/trocou este produto para a loja';
