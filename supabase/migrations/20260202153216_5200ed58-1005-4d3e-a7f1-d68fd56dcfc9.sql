-- Create pricebook_mapping table for mapping service types to HCP PriceBook items
CREATE TABLE public.pricebook_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  hcp_pricebook_item_id TEXT NOT NULL,
  hcp_pricebook_item_name TEXT,
  default_duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, service_type)
);

-- Enable RLS
ALTER TABLE public.pricebook_mapping ENABLE ROW LEVEL SECURITY;

-- Policies for pricebook_mapping
CREATE POLICY "Users can view pricebook mapping in their org"
  ON public.pricebook_mapping
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can insert pricebook mapping"
  ON public.pricebook_mapping
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Admins can update pricebook mapping"
  ON public.pricebook_mapping
  FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Admins can delete pricebook mapping"
  ON public.pricebook_mapping
  FOR DELETE
  USING (organization_id = get_user_organization_id() AND is_admin());