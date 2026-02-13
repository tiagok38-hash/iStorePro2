-- ============================================================
-- Módulo CRM — Pipeline de Vendas Kanban
-- ============================================================

-- 1. Deals (Oportunidades)
CREATE TABLE IF NOT EXISTS crm_deals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    client_name TEXT, -- Denormalized for display speed
    client_phone TEXT,
    status_column TEXT NOT NULL DEFAULT 'new_leads' CHECK (status_column IN (
        'new_leads', 'negotiating', 'awaiting_stock', 'awaiting_payment', 'won', 'lost'
    )),
    value NUMERIC(12, 2) DEFAULT 0,
    product_interest TEXT,
    priority TEXT NOT NULL DEFAULT 'warm' CHECK (priority IN ('hot', 'warm', 'cold')),
    origin TEXT CHECK (origin IN ('instagram', 'whatsapp', 'indicacao', 'passante', 'olx', 'site', 'outro')),
    assigned_to UUID, -- user id
    assigned_to_name TEXT,
    follow_up_date TIMESTAMPTZ,
    notes TEXT,
    sort_order INT DEFAULT 0,
    company_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Atividades / Histórico do Deal
CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('note', 'status_change', 'follow_up', 'whatsapp', 'call')),
    content TEXT NOT NULL,
    created_by UUID,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status_column);
CREATE INDEX IF NOT EXISTS idx_crm_deals_client ON crm_deals(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_assigned ON crm_deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_deals_company ON crm_deals(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_priority ON crm_deals(priority);
CREATE INDEX IF NOT EXISTS idx_crm_activities_deal ON crm_activities(deal_id);
