-- 1. Create hcp_accounts table
CREATE TABLE public.hcp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  hcp_api_key TEXT,
  hcp_company_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hcp_accounts_org ON public.hcp_accounts(organization_id);
CREATE INDEX idx_hcp_accounts_location ON public.hcp_accounts(location_id);

ALTER TABLE public.hcp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage HCP accounts"
  ON public.hcp_accounts
  FOR ALL
  USING (organization_id = get_user_organization_id() AND is_admin())
  WITH CHECK (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Users can view HCP accounts in their org"
  ON public.hcp_accounts
  FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE TRIGGER update_hcp_accounts_updated_at
  BEFORE UPDATE ON public.hcp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Add hcp_account_id to all hcp_* tables and pricebook_mapping
ALTER TABLE public.hcp_jobs           ADD COLUMN hcp_account_id UUID REFERENCES public.hcp_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.hcp_customers      ADD COLUMN hcp_account_id UUID REFERENCES public.hcp_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.hcp_employees      ADD COLUMN hcp_account_id UUID REFERENCES public.hcp_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.hcp_service_zones  ADD COLUMN hcp_account_id UUID REFERENCES public.hcp_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.hcp_services       ADD COLUMN hcp_account_id UUID REFERENCES public.hcp_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.pricebook_mapping  ADD COLUMN hcp_account_id UUID REFERENCES public.hcp_accounts(id) ON DELETE SET NULL;

CREATE INDEX idx_hcp_jobs_account          ON public.hcp_jobs(hcp_account_id);
CREATE INDEX idx_hcp_customers_account     ON public.hcp_customers(hcp_account_id);
CREATE INDEX idx_hcp_employees_account     ON public.hcp_employees(hcp_account_id);
CREATE INDEX idx_hcp_service_zones_account ON public.hcp_service_zones(hcp_account_id);
CREATE INDEX idx_hcp_services_account      ON public.hcp_services(hcp_account_id);
CREATE INDEX idx_pricebook_mapping_account ON public.pricebook_mapping(hcp_account_id);

-- 3. Backfill: create a default hcp_accounts row for each org that has existing HCP creds,
--    then stamp existing synced rows with that account id.
INSERT INTO public.hcp_accounts (organization_id, label, hcp_api_key, hcp_company_id, is_active)
SELECT id, 'Default', hcp_api_key, hcp_company_id, COALESCE(hcp_configured, FALSE)
FROM public.organizations
WHERE hcp_api_key IS NOT NULL OR hcp_company_id IS NOT NULL;

UPDATE public.hcp_jobs j
SET hcp_account_id = a.id
FROM public.hcp_accounts a
WHERE a.organization_id = j.organization_id
  AND a.label = 'Default'
  AND j.hcp_account_id IS NULL;

UPDATE public.hcp_customers c
SET hcp_account_id = a.id
FROM public.hcp_accounts a
WHERE a.organization_id = c.organization_id
  AND a.label = 'Default'
  AND c.hcp_account_id IS NULL;

UPDATE public.hcp_employees e
SET hcp_account_id = a.id
FROM public.hcp_accounts a
WHERE a.organization_id = e.organization_id
  AND a.label = 'Default'
  AND e.hcp_account_id IS NULL;

UPDATE public.hcp_service_zones z
SET hcp_account_id = a.id
FROM public.hcp_accounts a
WHERE a.organization_id = z.organization_id
  AND a.label = 'Default'
  AND z.hcp_account_id IS NULL;

UPDATE public.hcp_services s
SET hcp_account_id = a.id
FROM public.hcp_accounts a
WHERE a.organization_id = s.organization_id
  AND a.label = 'Default'
  AND s.hcp_account_id IS NULL;

UPDATE public.pricebook_mapping p
SET hcp_account_id = a.id
FROM public.hcp_accounts a
WHERE a.organization_id = p.organization_id
  AND a.label = 'Default'
  AND p.hcp_account_id IS NULL;