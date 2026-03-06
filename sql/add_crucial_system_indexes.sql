-- ================================================================
-- iStorePro - PERFORMANCE & MULTI-TENANT INDEXING UPGRADE
-- Data: 2026-03-06
-- Descrição: Criação de índices ausentes para acelerar queries 
--           multi-tenant e de buscas pesadas no dia a dia.
-- ================================================================

-------------------------------------------------------------------
-- 1. ÍNDICES DE MULTI-TENANT (Faltando Company_ID)
-------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payment_methods_company ON public.payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_grades_company ON public.grades(company_id);
CREATE INDEX IF NOT EXISTS idx_grade_values_company ON public.grade_values(company_id);
CREATE INDEX IF NOT EXISTS idx_warranties_company ON public.warranties(company_id);
CREATE INDEX IF NOT EXISTS idx_receipt_terms_company ON public.receipt_terms(company_id);
CREATE INDEX IF NOT EXISTS idx_commission_audit_logs_company ON public.commission_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_company ON public.crm_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_limit_history_company ON public.credit_limit_history(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_audit_logs_company ON public.cash_register_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_settings_company ON public.credit_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_company ON public.orcamento_itens(company_id);
CREATE INDEX IF NOT EXISTS idx_product_conditions_company ON public.product_conditions(company_id);
CREATE INDEX IF NOT EXISTS idx_storage_locations_company ON public.storage_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_catalog_events_company ON public.catalog_events(company_id);

-------------------------------------------------------------------
-- 2. ÍNDICES DE PESQUISA (Buscas Pesadas do Dia a Dia)
-------------------------------------------------------------------

-- Clientes (Busca Ativa de Balcão e Contato)
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON public.customers(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email) WHERE email IS NOT NULL;

-- Produtos (Busca Escaneada ou por Modelo)
CREATE INDEX IF NOT EXISTS idx_products_imei1 ON public.products("imei1") WHERE "imei1" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_imei2 ON public.products("imei2") WHERE "imei2" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_serial_number ON public.products("serialNumber") WHERE "serialNumber" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_model ON public.products(model) WHERE model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- Vendas (Busca por Data e Status Gerencial)
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales("customerId");

-- Movimentações e Históricos
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON public.financial_transactions(status);

-- Ordens de Serviço (Filtros mais comuns)
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON public.service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_customer_id ON public.service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_device_model ON public.service_orders(device_model) WHERE device_model IS NOT NULL;
