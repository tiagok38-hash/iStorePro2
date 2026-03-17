-- =============================================================
-- MIGRAÇÃO: Integração com Telegram por empresa (multi-tenant)
-- Data: 2026-03-16
-- Descrição: Adiciona as colunas telegram_bot_token e
--            telegram_chat_id na tabela companies para que cada
--            empresa armazene suas próprias credenciais do bot.
--            O isolamento multi-tenant é garantido pelas policies
--            RLS já existentes na tabela companies.
-- =============================================================

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id   TEXT DEFAULT NULL;

COMMENT ON COLUMN companies.telegram_bot_token
    IS 'Token do Bot do Telegram fornecido pelo @BotFather (exclusivo por empresa)';

COMMENT ON COLUMN companies.telegram_chat_id
    IS 'Chat ID do destinatário das notificações do Telegram (exclusivo por empresa)';
