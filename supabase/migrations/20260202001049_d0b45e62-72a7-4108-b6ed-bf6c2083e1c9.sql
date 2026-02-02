-- Create table to store HouseCall Pro services/products catalog
CREATE TABLE IF NOT EXISTS public.hcp_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  hcp_service_id text NOT NULL,
  name text NOT NULL,
  description text,
  price numeric,
  is_active boolean DEFAULT true,
  synced_at timestamp with time zone DEFAULT now(),
  UNIQUE(organization_id, hcp_service_id)
);

-- Enable RLS
ALTER TABLE public.hcp_services ENABLE ROW LEVEL SECURITY;

-- Allow users to view services in their organization
CREATE POLICY "Users can view services in their org"
  ON public.hcp_services
  FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Allow admins to manage services
CREATE POLICY "Admins can manage services"
  ON public.hcp_services
  FOR ALL
  USING (organization_id = get_user_organization_id() AND is_admin());