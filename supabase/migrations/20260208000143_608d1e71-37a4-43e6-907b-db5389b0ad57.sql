-- Schedule daily HCP sync at 5:00 AM UTC (midnight EST)
SELECT cron.schedule(
  'daily-hcp-sync',
  '0 5 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://zhwwvmhsmofucgejqpcm.supabase.co/functions/v1/sync-hcp-data',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpod3d2bWhzbW9mdWNnZWpxcGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTczMDUsImV4cCI6MjA4NTQ3MzMwNX0.-v4imVscB3udWpCAYMe6FPyYVtbMJ8oupKTZc0FspX4"}'::jsonb,
      body := '{"syncAll": true}'::jsonb
    ) AS request_id;
  $$
);