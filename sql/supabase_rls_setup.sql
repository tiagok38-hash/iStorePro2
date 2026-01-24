-- SECURITY SETUP FOR ISTORE
-- Rodar este script no SQL Editor do Supabase

-- 1. Ativar RLS em tabelas críticas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Remover acesso público (anon) total
-- O papel 'anon' não deve ter permissão de escrita em nenhuma tabela.

-- 3. Exemplo de Política: Tabela de Usuários
-- Somente o próprio usuário pode ver seus dados sensíveis, ou admins.
CREATE POLICY "Usuários podem ver seus próprios dados" ON public.users
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 4. Exemplo de Política: Produtos
-- Todos os funcionários autenticados podem ver produtos
CREATE POLICY "Leitura de produtos para autenticados" ON public.products
FOR SELECT TO authenticated
USING (true);

-- Somente quem tem permissão de estoque pode editar (exemplo simplificado)
-- Nota: Para isso funcionar 100%, é melhor usar Supabase Auth nativo
CREATE POLICY "Modificação de produtos restrita" ON public.products
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.permissions_profiles p ON u.permission_profile_id = p.id
    WHERE u.id = auth.uid() AND (p.permissions->>'canAccessEstoque')::boolean = true
  )
);

-- 5. Auditoria: Somente leitura e inserção, nunca delete ou update
CREATE POLICY "Audit logs são imutáveis" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Leitura de logs para admins" ON public.audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.permissions_profiles p ON u.permission_profile_id = p.id
    WHERE u.id = auth.uid() AND (p.permissions->>'canViewAudit')::boolean = true
  )
);

-- AVISO: A aplicação atual não utiliza Supabase Auth (auth.uid()).
-- Para que estas políticas funcionem, você precisa migrar o login para supabase.auth.
