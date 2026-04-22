-- Grant schedule.view and schedule.edit to existing Admin and Call Staff system roles in every org
INSERT INTO role_permissions (role_id, permission)
SELECT cr.id, 'schedule.view'::permission_key
FROM custom_roles cr
WHERE cr.is_system = true
  AND lower(cr.name) IN ('admin', 'administrator', 'call staff', 'call_staff')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission)
SELECT cr.id, 'schedule.edit'::permission_key
FROM custom_roles cr
WHERE cr.is_system = true
  AND lower(cr.name) IN ('admin', 'administrator', 'call staff', 'call_staff')
ON CONFLICT DO NOTHING;