-- ================================================================
-- iStorePro - MULTI-TENANT MIGRATION
-- Data: 2026-03-03
-- Descrição: Migração completa para multi-tenant com RLS
-- ================================================================
-- ESTE ARQUIVO É APENAS DOCUMENTAÇÃO.
-- As migrações já foram aplicadas via Supabase Management API.
-- ================================================================

-- OVERVIEW:
-- 1. Tabela companies criada
-- 2. company_id adicionado em TODAS as 38+ tabelas
-- 3. Dados existentes associados à empresa iStore (istore-default)
-- 4. JWT claims atualizados com company_id para todos os users
-- 5. Todas as políticas RLS antigas removidas
-- 6. Novas políticas RLS baseadas em company_id criadas
-- 7. Triggers de auto-fill company_id em INSERTs
-- 8. Índices de performance em company_id
-- 9. Acesso público mantido para catálogo e company_info

-- COMPANY ID PADRÃO: 59322755-8d69-4bff-b4d3-41826aaaebe2
-- COMPANY SLUG: istore-default

-- FUNÇÕES HELPER:
-- get_my_company_id() - Retorna company_id do JWT ou da tabela users
-- is_member_of(UUID) - Verifica se o usuário pertence a uma empresa
-- set_company_id() - Trigger para auto-preencher company_id
-- handle_user_company_claim() - Sincroniza company_id com JWT claims
