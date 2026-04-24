-- ============================================================
-- Migration: OS Snapshots + Deletion Guards
-- Data: 2026-04-24
-- Descrição:
--   1. Adiciona colunas JSONB para snapshot de cliente e aparelho
--      na tabela service_orders (captura imutável no momento da criação).
--   2. Adiciona colunas de texto para dados críticos do cliente no
--      snapshot (caso o cliente seja inativado no futuro).
-- ============================================================

-- 1. Adicionar colunas de snapshot em service_orders
ALTER TABLE public.service_orders
    ADD COLUMN IF NOT EXISTS customer_snapshot jsonb DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS device_snapshot   jsonb DEFAULT NULL;

-- Comentários descritivos
COMMENT ON COLUMN public.service_orders.customer_snapshot IS
    'Snapshot imutável dos dados do cliente no momento da criação da OS (nome, telefone, CPF, endereço, etc.)';

COMMENT ON COLUMN public.service_orders.device_snapshot IS
    'Snapshot imutável dos dados do aparelho no momento da criação da OS (modelo, IMEI, cor, armazenamento, etc.)';

-- 2. Índice para facilitar consultas de integridade
CREATE INDEX IF NOT EXISTS idx_service_orders_customer_id
    ON public.service_orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_service_orders_customer_device_id
    ON public.service_orders(customer_device_id);
