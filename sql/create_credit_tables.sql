-- Tabela de Configurações de Crediário
create table if not exists credit_settings (
  id uuid default uuid_generate_v4() primary key,
  default_interest_rate decimal(10,2) default 0, -- Taxa de juros padrão (%) ao criar
  late_fee_percentage decimal(10,2) default 0, -- Multa/Juros padrao por atraso (%)
  updated_at timestamptz default now()
);

-- Inserir configuração padrão se não existir
insert into credit_settings (default_interest_rate, late_fee_percentage)
select 0, 0
where not exists (select 1 from credit_settings);

-- Tabela de Parcelas de Crediário
create table if not exists credit_installments (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references sales(id) on delete cascade,
  customer_id uuid references customers(id),
  installment_number int not null, -- Número da parcela (ex: 1, 2, 3...)
  total_installments int not null, -- Total de parcelas (ex: 10)
  due_date date not null, -- Data de vencimento
  amount decimal(10,2) not null, -- Valor original da parcela
  status text check (status in ('pending', 'paid', 'partial', 'overdue')) default 'pending',
  amount_paid decimal(10,2) default 0, -- Valor já pago
  interest_applied decimal(10,2) default 0, -- Juros aplicados na criação (valor monetário)
  penalty_applied decimal(10,2) default 0, -- Multa/Juros por atraso (valor monetário)
  paid_at timestamptz, -- Data do último pagamento (vira null se estornado?? melhor manter registro)
  payment_method text, -- 'Dinheiro', 'Pix', etc.
  observation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  amortization_value decimal(10,2) default 0,
  interest_value decimal(10,2) default 0,
  remaining_balance decimal(10,2) default 0
);

-- Adicionar colunas na tabela de sales para controle de crediário
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS interest_rate numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_financed numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS installment_amount numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS current_debt_balance numeric DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS amortization_table jsonb DEFAULT '[]';

-- Índices para performance
create index if not exists idx_credit_installments_sale_id on credit_installments(sale_id);
create index if not exists idx_credit_installments_customer_id on credit_installments(customer_id);
create index if not exists idx_credit_installments_status on credit_installments(status);
create index if not exists idx_credit_installments_due_date on credit_installments(due_date);
