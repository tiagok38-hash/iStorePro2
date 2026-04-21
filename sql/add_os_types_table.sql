-- Script para habilitar Tipos de OS em ambiente Multi-tenant
-- Adiciona a tabela de tipos de OS e o campo de vínculo na tabela service_orders

DO $$ 
DECLARE
    default_company_id UUID := '59322755-8d69-4bff-b4d3-41826aaaebe2';
BEGIN
    ---------------------------------------------------------------------------
    -- 1. CRIAR TABELA OS_TYPES
    ---------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'os_types') THEN
        CREATE TABLE public.os_types (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            company_id UUID NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );

        -- Inserir tipos padrão para a empresa padrão
        INSERT INTO public.os_types (name, company_id) VALUES 
        ('Orçamento', default_company_id),
        ('Retorno/Garantia', default_company_id);
    END IF;

    ---------------------------------------------------------------------------
    -- 2. ADICIONAR COLUNA NA TABELA SERVICE_ORDERS
    ---------------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_orders' AND column_name = 'os_type') THEN
        ALTER TABLE public.service_orders ADD COLUMN os_type TEXT;
    END IF;

END $$;

---------------------------------------------------------------------------
-- 3. CONFIGURAR MULTI-TENANT (RLS E TRIGGERS)
---------------------------------------------------------------------------

-- Habilitar RLS
ALTER TABLE public.os_types ENABLE ROW LEVEL SECURITY;

-- Política de Isolação por Empresa
DROP POLICY IF EXISTS "company_isolation_os_types" ON public.os_types;
CREATE POLICY "company_isolation_os_types" ON public.os_types 
    FOR ALL USING (company_id = public.get_my_company_id());

-- Trigger para auto-setar company_id no insert
DROP TRIGGER IF EXISTS set_company_id_os_types ON public.os_types;
CREATE TRIGGER set_company_id_os_types
    BEFORE INSERT ON public.os_types
    FOR EACH ROW EXECUTE FUNCTION public.set_company_id();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_os_types_company_id ON public.os_types(company_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_os_type ON public.service_orders(os_type);
