-- ============================================================
-- MÓDULO: Avaliação Trade-In
-- Criado: 2026-06-05
-- Todas as tabelas são multi-tenant via company_id
-- ============================================================

-- 1. Configurações do link público por tenant
CREATE TABLE IF NOT EXISTS public.avaliacao_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    welcome_message TEXT,
    logo_url TEXT,
    whatsapp VARCHAR(30),
    collect_contact BOOLEAN NOT NULL DEFAULT true,
    floor_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    validity_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id)
);

-- 2. Dispositivos elegíveis para trade-in
CREATE TABLE IF NOT EXISTS public.avaliacao_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(200) NOT NULL,
    storage_options JSONB NOT NULL DEFAULT '[]',   -- ["64GB", "128GB", "256GB"]
    color_options JSONB NOT NULL DEFAULT '[]',     -- ["Preto", "Branco", "Azul"]
    base_values JSONB NOT NULL DEFAULT '{}',       -- { "128GB__Preto": 1200.00, ... }
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Estados de conservação configuráveis por tenant
CREATE TABLE IF NOT EXISTS public.avaliacao_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    deduction_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
    deduction_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    icon VARCHAR(10) DEFAULT '📱',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Defeitos/Peças com dedução
CREATE TABLE IF NOT EXISTS public.avaliacao_parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    label VARCHAR(200) NOT NULL,
    deduction_type VARCHAR(20) NOT NULL DEFAULT 'fixed', -- 'percentage' | 'fixed'
    deduction_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    requires_photo BOOLEAN NOT NULL DEFAULT false,
    requires_note BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Leads / Avaliações recebidas
CREATE TABLE IF NOT EXISTS public.avaliacao_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    device_brand VARCHAR(100) NOT NULL,
    device_model VARCHAR(200) NOT NULL,
    device_storage VARCHAR(50),
    device_color VARCHAR(100),
    condition_label VARCHAR(100) NOT NULL,
    parts_selected JSONB NOT NULL DEFAULT '[]',
    -- parts_selected: [{ id, label, deduction_type, deduction_value, amount }]
    base_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    deductions JSONB NOT NULL DEFAULT '[]',
    -- deductions: [{ label, type, value, amount }]
    final_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    customer_name VARCHAR(200),
    customer_phone VARCHAR(50),
    customer_email VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'converted' | 'rejected'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_avaliacao_devices_company ON public.avaliacao_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_conditions_company ON public.avaliacao_conditions(company_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_parts_company ON public.avaliacao_parts(company_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_leads_company ON public.avaliacao_leads(company_id);
CREATE INDEX IF NOT EXISTS idx_avaliacao_leads_status ON public.avaliacao_leads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_avaliacao_leads_created ON public.avaliacao_leads(company_id, created_at DESC);

-- RLS: habilitar para todas as tabelas
ALTER TABLE public.avaliacao_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacao_leads ENABLE ROW LEVEL SECURITY;

-- RLS policies: autenticados veem apenas sua company
CREATE POLICY "avaliacao_settings_tenant" ON public.avaliacao_settings
    FOR ALL USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "avaliacao_devices_tenant" ON public.avaliacao_devices
    FOR ALL USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "avaliacao_conditions_tenant" ON public.avaliacao_conditions
    FOR ALL USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "avaliacao_parts_tenant" ON public.avaliacao_parts
    FOR ALL USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "avaliacao_leads_tenant" ON public.avaliacao_leads
    FOR ALL USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- Política pública: inserção anônima de leads (formulário público)
CREATE POLICY "avaliacao_leads_public_insert" ON public.avaliacao_leads
    FOR INSERT WITH CHECK (true);

-- Política pública leitura: settings, devices, conditions, parts via slug (via função RPC)
-- A função get_public_avaliacao é chamada sem autenticação
CREATE OR REPLACE FUNCTION public.get_public_avaliacao(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_id UUID;
    v_result JSONB;
BEGIN
    -- Busca company_id pelo slug
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE slug = p_slug
    LIMIT 1;

    IF v_company_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Company not found');
    END IF;

    SELECT jsonb_build_object(
        'settings', (
            SELECT row_to_json(s)
            FROM public.avaliacao_settings s
            WHERE s.company_id = v_company_id
              AND s.is_active = true
            LIMIT 1
        ),
        'devices', (
            SELECT json_agg(d ORDER BY d.display_order)
            FROM public.avaliacao_devices d
            WHERE d.company_id = v_company_id AND d.is_active = true
        ),
        'conditions', (
            SELECT json_agg(c ORDER BY c.display_order)
            FROM public.avaliacao_conditions c
            WHERE c.company_id = v_company_id AND c.is_active = true
        ),
        'parts', (
            SELECT json_agg(p ORDER BY p.display_order)
            FROM public.avaliacao_parts p
            WHERE p.company_id = v_company_id AND p.is_active = true
        ),
        'company', (
            SELECT jsonb_build_object(
                'id', co.id,
                'name', co.name,
                'slug', co.slug,
                'whatsapp', co.whatsapp,
                'logo_url', co.logo_url
            )
            FROM public.companies co
            WHERE co.id = v_company_id
            LIMIT 1
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
