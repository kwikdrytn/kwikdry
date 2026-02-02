-- Enable required extensions for scheduled notifications
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule daily checklist reminders at 5 PM (17:00) Monday-Friday
-- Cron: minute hour day month weekday (1-5 = Mon-Fri)
SELECT cron.schedule(
  'daily-checklist-reminder',
  '0 17 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://zhwwvmhsmofucgejqpcm.supabase.co/functions/v1/send-checklist-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpod3d2bWhzbW9mdWNnZWpxcGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTczMDUsImV4cCI6MjA4NTQ3MzMwNX0.-v4imVscB3udWpCAYMe6FPyYVtbMJ8oupKTZc0FspX4"}'::jsonb,
    body := '{"type": "daily"}'::jsonb
  ) AS request_id;
  $$
);

-- Schedule weekly checklist reminders at 5 PM (17:00) on Saturday
-- Cron: minute hour day month weekday (6 = Saturday)
SELECT cron.schedule(
  'weekly-checklist-reminder',
  '0 17 * * 6',
  $$
  SELECT net.http_post(
    url := 'https://zhwwvmhsmofucgejqpcm.supabase.co/functions/v1/send-checklist-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpod3d2bWhzbW9mdWNnZWpxcGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTczMDUsImV4cCI6MjA4NTQ3MzMwNX0.-v4imVscB3udWpCAYMe6FPyYVtbMJ8oupKTZc0FspX4"}'::jsonb,
    body := '{"type": "weekly"}'::jsonb
  ) AS request_id;
  $$
);