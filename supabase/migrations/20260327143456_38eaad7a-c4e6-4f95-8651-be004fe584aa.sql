-- Fix existing amounts stored in cents: convert to dollars
UPDATE hcp_jobs SET total_amount = total_amount / 100 WHERE total_amount IS NOT NULL AND total_amount > 0;
UPDATE hcp_jobs SET tip_amount = tip_amount / 100 WHERE tip_amount IS NOT NULL AND tip_amount > 0;
UPDATE hcp_jobs SET cc_fee_amount = cc_fee_amount / 100 WHERE cc_fee_amount IS NOT NULL AND cc_fee_amount > 0;