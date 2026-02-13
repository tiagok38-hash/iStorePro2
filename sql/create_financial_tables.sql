-- ============================================================
-- Módulo Financeiro — Tabelas e Dados Iniciais
-- ============================================================

-- 1. Categorias de Transação
CREATE TABLE IF NOT EXISTS transaction_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    group_name TEXT NOT NULL DEFAULT 'Geral',
    icon TEXT,
    color TEXT,
    is_default BOOLEAN DEFAULT false,
    company_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Transações Financeiras
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    category_id UUID REFERENCES transaction_categories(id) ON DELETE SET NULL,
    due_date DATE NOT NULL,
    payment_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    payment_method TEXT,
    entity_name TEXT,
    entity_type TEXT CHECK (entity_type IN ('customer', 'supplier', NULL)),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_interval TEXT CHECK (recurrence_interval IN ('weekly', 'monthly', 'quarterly', 'yearly', NULL)),
    attachment_url TEXT,
    notes TEXT,
    company_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ft_type ON financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_ft_status ON financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ft_due_date ON financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_ft_company ON financial_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_tc_type ON transaction_categories(type);
CREATE INDEX IF NOT EXISTS idx_tc_company ON transaction_categories(company_id);

-- ============================================================
-- SEED: Categorias padrão para loja de eletrônicos
-- ============================================================

-- Despesas Variáveis (CMV)
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Compra de Aparelhos', 'expense', 'CMV (Custo)', 'smartphone', '#EF4444', true),
    ('Compra de Peças', 'expense', 'CMV (Custo)', 'wrench', '#F97316', true),
    ('Compra de Acessórios', 'expense', 'CMV (Custo)', 'headphones', '#F59E0B', true),
    ('Fretes e Entregas', 'expense', 'CMV (Custo)', 'truck', '#6366F1', true);

-- Despesas Fixas
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Aluguel', 'expense', 'Despesas Fixas', 'home', '#8B5CF6', true),
    ('Energia Elétrica', 'expense', 'Despesas Fixas', 'zap', '#EAB308', true),
    ('Internet / Telefone', 'expense', 'Despesas Fixas', 'wifi', '#3B82F6', true),
    ('Sistema / Software', 'expense', 'Despesas Fixas', 'monitor', '#6366F1', true),
    ('Contador / Contabilidade', 'expense', 'Despesas Fixas', 'calculator', '#78716C', true),
    ('Material de Escritório', 'expense', 'Despesas Fixas', 'clipboard', '#64748B', true),
    ('Seguro', 'expense', 'Despesas Fixas', 'shield', '#0EA5E9', true);

-- Pessoal
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Folha de Pagamento', 'expense', 'Pessoal', 'users', '#EC4899', true),
    ('Pró-labore', 'expense', 'Pessoal', 'user', '#DB2777', true),
    ('Comissões', 'expense', 'Pessoal', 'percent', '#F43F5E', true),
    ('Vale Transporte / Alimentação', 'expense', 'Pessoal', 'ticket', '#FB923C', true);

-- Impostos e Taxas
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Simples Nacional / DAS', 'expense', 'Impostos e Taxas', 'file-text', '#DC2626', true),
    ('Taxas de Cartão / Maquininha', 'expense', 'Impostos e Taxas', 'credit-card', '#9333EA', true),
    ('Outras Taxas', 'expense', 'Impostos e Taxas', 'alert-circle', '#71717A', true);

-- Marketing
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Marketing / Publicidade', 'expense', 'Marketing', 'megaphone', '#F472B6', true),
    ('Instagram / Redes Sociais', 'expense', 'Marketing', 'globe', '#E879F9', true);

-- Outras Despesas
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Manutenção do Ponto', 'expense', 'Outras Despesas', 'tool', '#A1A1AA', true),
    ('Outras Despesas', 'expense', 'Outras Despesas', 'more-horizontal', '#737373', true);

-- === RECEITAS ===
INSERT INTO transaction_categories (name, type, group_name, icon, color, is_default) VALUES
    ('Venda de Produtos', 'income', 'Receitas Operacionais', 'shopping-bag', '#10B981', true),
    ('Serviço de Assistência Técnica', 'income', 'Receitas Operacionais', 'wrench', '#059669', true),
    ('Venda de Acessórios', 'income', 'Receitas Operacionais', 'headphones', '#34D399', true),
    ('Recebimento de Crediário', 'income', 'Receitas Operacionais', 'banknote', '#22C55E', true),
    ('Outras Receitas', 'income', 'Outras Receitas', 'plus-circle', '#6EE7B7', true);

-- RLS (Row Level Security) — ativar conforme necessidade
-- ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
