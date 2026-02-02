-- Add training permissions to the permission_key enum
ALTER TYPE permission_key ADD VALUE IF NOT EXISTS 'training.view';
ALTER TYPE permission_key ADD VALUE IF NOT EXISTS 'training.manage';