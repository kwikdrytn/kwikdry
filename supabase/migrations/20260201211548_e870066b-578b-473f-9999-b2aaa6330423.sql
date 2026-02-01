-- Add expiration_date column to inventory_items
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS expiration_date date;

-- Add notes column (separate from description for clarity)
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS notes text;

-- Add index for expiration date queries
CREATE INDEX IF NOT EXISTS idx_inventory_items_expiration 
ON public.inventory_items (expiration_date) 
WHERE expiration_date IS NOT NULL;