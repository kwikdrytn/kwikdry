-- Add subtotal_amount, discount_amount, and tax_amount to hcp_jobs
-- These columns are needed to correctly store and display payroll data
-- from HCP line items (subtotal before discount, discount applied, and tax).
-- Previously only total_amount was stored, causing incorrect payroll calculations.

ALTER TABLE hcp_jobs ADD COLUMN IF NOT EXISTS subtotal_amount numeric;
ALTER TABLE hcp_jobs ADD COLUMN IF NOT EXISTS discount_amount numeric;
ALTER TABLE hcp_jobs ADD COLUMN IF NOT EXISTS tax_amount numeric;

COMMENT ON COLUMN hcp_jobs.subtotal_amount IS 'Sum of line item (unit_price * quantity) in dollars, before discounts';
COMMENT ON COLUMN hcp_jobs.discount_amount  IS 'Total discount applied to the job in dollars (flat or derived from percentage)';
COMMENT ON COLUMN hcp_jobs.tax_amount       IS 'Tax amount on the job in dollars';
