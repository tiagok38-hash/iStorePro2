-- Adicionar colunas para Fornecedor Pessoa Física
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS birth_date date;

-- Criar índice para evitar duplicidade de CPF/CNPJ se desejado (opcional, mas recomendado)
-- CREATE UNIQUE INDEX IF NOT EXISTS suppliers_cnpj_idx ON public.suppliers(cnpj) WHERE cnpj IS NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS suppliers_cpf_idx ON public.suppliers(cpf) WHERE cpf IS NOT NULL;
