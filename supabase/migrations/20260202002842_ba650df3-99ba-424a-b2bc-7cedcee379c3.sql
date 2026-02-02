-- Add watch_time_seconds column to training_progress
ALTER TABLE public.training_progress 
ADD COLUMN IF NOT EXISTS watch_time_seconds INTEGER NOT NULL DEFAULT 0;