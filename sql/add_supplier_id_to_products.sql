-- Adicionar coluna de fornecedor na tabela de produtos
-- Isso permite vincular o cliente que deu o aparelho na troca (trade-in) ao produto no estoque

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "supplierId" uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Se o nome da coluna no seu banco for supplier_id (snake_case), descomente abaixo:
-- ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
