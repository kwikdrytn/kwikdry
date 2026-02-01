-- Create custom roles table
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- System roles (admin, call_staff, technician) can't be deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Create permissions enum for available permissions
CREATE TYPE public.permission_key AS ENUM (
  -- Dashboard
  'dashboard.view',
  'dashboard.view_metrics',
  
  -- Inventory
  'inventory.view',
  'inventory.manage', -- create/edit/delete items
  'inventory.adjust_stock',
  
  -- Checklists
  'checklists.submit', -- submit own checklists
  'checklists.view_submissions', -- view all submissions
  'checklists.manage_templates',
  
  -- Equipment
  'equipment.view',
  'equipment.manage',
  
  -- Calls
  'calls.view',
  'calls.view_metrics',
  'calls.manage', -- update booking status, notes
  
  -- Job Map
  'job_map.view',
  'job_map.use_ai_suggestions',
  
  -- Users
  'users.view',
  'users.manage',
  
  -- Locations
  'locations.view',
  'locations.manage',
  
  -- Settings
  'settings.view',
  'settings.manage_integrations'
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission permission_key NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role_id, permission)
);

-- Update profiles to reference custom_roles instead of enum
ALTER TABLE public.profiles 
ADD COLUMN custom_role_id UUID REFERENCES public.custom_roles(id);

-- Enable RLS
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_roles
CREATE POLICY "Users can view roles in their organization"
  ON public.custom_roles FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage roles"
  ON public.custom_roles FOR ALL
  USING (organization_id = get_user_organization_id() AND is_admin());

-- RLS policies for role_permissions
CREATE POLICY "Users can view permissions for roles in their org"
  ON public.role_permissions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.custom_roles 
    WHERE custom_roles.id = role_permissions.role_id 
    AND custom_roles.organization_id = get_user_organization_id()
  ));

CREATE POLICY "Admins can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.custom_roles 
    WHERE custom_roles.id = role_permissions.role_id 
    AND custom_roles.organization_id = get_user_organization_id()
    AND is_admin()
  ));

-- Create function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(p_permission permission_key)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN role_permissions rp ON rp.role_id = p.custom_role_id
    WHERE p.user_id = auth.uid()
    AND rp.permission = p_permission
  )
  OR is_admin() -- Admins have all permissions
$$;

-- Trigger for updated_at
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();