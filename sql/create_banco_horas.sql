-- Table: public.banco_horas
-- Creates the table for managing Bank of Hours entries

CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.banco_horas (
    id uuId DEFAULT gen_random_uuid() PRIMARY KEY,
    funcionario_id uuId NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    data_trabalho date NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('HOURS', 'MINUTES')),
    quantidade numeric(10, 2) NOT NULL CHECK (quantidade > 0),
    valor_hora numeric(10, 2) NOT NULL CHECK (valor_hora >= 0),
    total numeric(10, 2) NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID')),
    observacao text,
    data_pagamento timestamp with time zone,
    usuario_pagamento_id uuId REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banco_horas ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (Policy checking is handled by application code)
CREATE POLICY "Enable ALL on banco_horas for authenticated users" 
    ON public.banco_horas 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Trigger to auto-update 'updated_at' column
CREATE TRIGGER trg_banco_horas_updated_at
    BEFORE UPDATE ON public.banco_horas
    FOR EACH ROW
    EXECUTE FUNCTION extensions.moddatetime(updated_at);
