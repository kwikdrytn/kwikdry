-- Create the initial organization
INSERT INTO organizations (id, name, slug)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'KwikDry Total Cleaning', 'kwikdry');

-- Create the first location
INSERT INTO locations (id, organization_id, name, timezone)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Main Office', 'America/New_York');

-- Create admin profile for your user (kwikdrytn@gmail.com)
INSERT INTO profiles (user_id, organization_id, location_id, email, first_name, last_name, role, is_active)
VALUES (
  '5c3c3862-fd8c-4fc8-9a42-f2f618df5c69',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'kwikdrytn@gmail.com',
  'Sarah',
  'Howell',
  'admin',
  true
);