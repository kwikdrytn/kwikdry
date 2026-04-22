-- Add new permission enum values for the Schedule page
ALTER TYPE permission_key ADD VALUE IF NOT EXISTS 'schedule.view';
ALTER TYPE permission_key ADD VALUE IF NOT EXISTS 'schedule.edit';