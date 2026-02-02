-- Add notes column to hcp_jobs table for storing job notes from HouseCall Pro
ALTER TABLE public.hcp_jobs
ADD COLUMN IF NOT EXISTS notes text;