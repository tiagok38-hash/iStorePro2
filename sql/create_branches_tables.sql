-- Criar tabela de Filiais (Branches)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT ((auth.jwt() ->> 'company_id')::uuid),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Politicas para Filiais
CREATE POLICY "Usuários podem ver filiais da sua empresa" 
ON public.branches FOR SELECT 
USING (company_id = ((auth.jwt() ->> 'company_id')::uuid));

CREATE POLICY "Usuários podem criar filiais na sua empresa" 
ON public.branches FOR INSERT 
WITH CHECK (company_id = ((auth.jwt() ->> 'company_id')::uuid));

CREATE POLICY "Usuários podem atualizar filiais da sua empresa" 
ON public.branches FOR UPDATE 
USING (company_id = ((auth.jwt() ->> 'company_id')::uuid));

CREATE POLICY "Usuários podem excluir filiais da sua empresa" 
ON public.branches FOR DELETE 
USING (company_id = ((auth.jwt() ->> 'company_id')::uuid));

-- Criar tabela de Estoque das Filiais
CREATE TABLE IF NOT EXISTS public.branch_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    stock INTEGER NOT NULL DEFAULT 0,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE DEFAULT ((auth.jwt() ->> 'company_id')::uuid),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(branch_id, product_id)
);

-- Ativar RLS
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;

-- Politicas para Estoque das Filiais
CREATE POLICY "Usuários podem ver estoque das filiais da sua empresa" 
ON public.branch_inventory FOR SELECT 
USING (company_id = ((auth.jwt() ->> 'company_id')::uuid));

CREATE POLICY "Usuários podem inserir estoque de filiais da sua empresa" 
ON public.branch_inventory FOR INSERT 
WITH CHECK (company_id = ((auth.jwt() ->> 'company_id')::uuid));

CREATE POLICY "Usuários podem atualizar estoque de filiais da sua empresa" 
ON public.branch_inventory FOR UPDATE 
USING (company_id = ((auth.jwt() ->> 'company_id')::uuid));

-- Opcional: Trigger de updated_at
CREATE OR REPLACE FUNCTION update_branch_inventory_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branch_inventory_updated_at ON public.branch_inventory;
CREATE TRIGGER trg_branch_inventory_updated_at
BEFORE UPDATE ON public.branch_inventory
FOR EACH ROW
EXECUTE FUNCTION update_branch_inventory_modtime();

-- Adicionar FKs à tabela inventory_movements para rastrear origem e destino de transferencias
ALTER TABLE public.inventory_movements
ADD COLUMN IF NOT EXISTS transfer_from_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transfer_to_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
