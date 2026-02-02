-- Adicionar coluna 'active' na tabela customers para permitir inativação
ALTER TABLE customers ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Garantir que todos os clientes atuais estejam ativos
UPDATE customers SET active = true WHERE active IS NULL;
