-- ADICIONAR COLUNAS FALTANTES NA TABELA DE FORNECEDORES
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address text;

-- Sincronizar linked_customer_id se necessário (alguns bancos usam camelCase por erro)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='suppliers' AND column_name='linked_customer_id') THEN
        ALTER TABLE public.suppliers ADD COLUMN linked_customer_id uuid REFERENCES public.customers(id);
    END IF;
END $$;
