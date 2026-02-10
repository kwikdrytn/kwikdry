
-- Add financial columns to hcp_jobs for payroll reporting
ALTER TABLE public.hcp_jobs
  ADD COLUMN IF NOT EXISTS tip_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cc_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS invoice_paid_at timestamptz;

-- Add payroll.view to the permission_key enum
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'payroll.view';
