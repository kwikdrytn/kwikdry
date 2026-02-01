-- Add address fields to profiles table for technician home locations
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip text,
ADD COLUMN IF NOT EXISTS home_lat numeric,
ADD COLUMN IF NOT EXISTS home_lng numeric;