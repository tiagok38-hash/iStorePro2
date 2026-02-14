-- Add credit limit fields to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credit_used DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS allow_credit BOOLEAN DEFAULT FALSE;

-- Create credit limit history table
CREATE TABLE IF NOT EXISTS credit_limit_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  previous_limit DECIMAL(10, 2),
  new_limit DECIMAL(10, 2),
  changed_by UUID REFERENCES auth.users(id), -- Assuming auth.users stores user info
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_credit_limit_history_customer_id ON credit_limit_history(customer_id);

-- Trigger to log credit limit changes could be added here, 
-- but for now we might handle it in the application layer or a separate trigger.
