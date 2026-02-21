-- create_orcamentos_tables.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: orcamentos
CREATE TABLE IF NOT EXISTS public.orcamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero VARCHAR(50) UNIQUE NOT NULL,
    vendedor_id UUID NOT NULL REFERENCES public.users(id),
    cliente_id UUID REFERENCES public.customers(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, finalizado, expirado, convertido
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    desconto_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    juros_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_final DECIMAL(10, 2) NOT NULL DEFAULT 0,
    forma_pagamento_snapshot JSONB,
    condicoes_pagamento_snapshot JSONB,
    validade_em TIMESTAMP WITH TIME ZONE,
    convertido_em TIMESTAMP WITH TIME ZONE,
    venda_id UUID REFERENCES public.sales(id),
    observacoes TEXT,
    probabilidade_fechamento_percentual DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: orcamento_itens
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
    produto_id UUID, -- nullable so we can keep item even if product is deleted
    nome_produto_snapshot VARCHAR(255) NOT NULL,
    sku_snapshot VARCHAR(100),
    preco_unitario_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
    custo_snapshot DECIMAL(10, 2) NOT NULL DEFAULT 0,
    quantidade INTEGER NOT NULL DEFAULT 1,
    desconto DECIMAL(10, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    metadata_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orcamentos_vendedor_id ON public.orcamentos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_id ON public.orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX IF NOT EXISTS idx_orcamentos_created_at ON public.orcamentos(created_at);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento_id ON public.orcamento_itens(orcamento_id);

-- RLS policies for orcamentos
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orçamentos visíveis por membros" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Membros podem inserir orçamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Membros podem atualizar orçamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Membros podem deletar orçamentos" ON public.orcamentos FOR DELETE TO authenticated USING (true);

-- RLS policies for orcamento_itens
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens de orçamentos visíveis por membros" ON public.orcamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Membros podem inserir itens de orçamentos" ON public.orcamento_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Membros podem atualizar itens de orçamentos" ON public.orcamento_itens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Membros podem deletar itens de orçamentos" ON public.orcamento_itens FOR DELETE TO authenticated USING (true);
