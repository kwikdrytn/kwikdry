
-- Create technician_pay_config table
CREATE TABLE public.technician_pay_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pay_model text NOT NULL DEFAULT 'salary' CHECK (pay_model IN ('salary', 'commission')),
  weekly_salary numeric DEFAULT 0,
  commission_percent numeric DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, effective_date)
);

ALTER TABLE public.technician_pay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pay config"
  ON public.technician_pay_config FOR ALL
  USING (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Users can view their own pay config"
  ON public.technician_pay_config FOR SELECT
  USING (profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create job_change_events table
CREATE TABLE public.job_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hcp_job_id text NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('cancelled', 'rescheduled', 'reassigned')),
  old_value jsonb,
  new_value jsonb,
  customer_name text,
  technician_name text,
  detected_at timestamptz DEFAULT now(),
  is_read boolean DEFAULT false,
  read_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.job_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view job change events"
  ON public.job_change_events FOR SELECT
  USING (organization_id = get_user_organization_id() AND is_admin());

CREATE POLICY "Admins can update job change events"
  ON public.job_change_events FOR UPDATE
  USING (organization_id = get_user_organization_id() AND is_admin());

-- Add activity_feed.view permission
ALTER TYPE public.permission_key ADD VALUE IF NOT EXISTS 'activity_feed.view';
