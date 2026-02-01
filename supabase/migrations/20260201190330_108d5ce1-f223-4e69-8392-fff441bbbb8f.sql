-- Fix RingCentral call sync upserts by adding the required unique constraint
-- (sync-rc-calls uses upsert ... onConflict)

ALTER TABLE public.call_log
ADD CONSTRAINT call_log_organization_rc_call_id_key
UNIQUE (organization_id, rc_call_id);

-- Helpful index for history filtering/sorting in the Calls UI
CREATE INDEX IF NOT EXISTS idx_call_log_org_started_at
ON public.call_log (organization_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_log_location_started_at
ON public.call_log (location_id, started_at DESC);