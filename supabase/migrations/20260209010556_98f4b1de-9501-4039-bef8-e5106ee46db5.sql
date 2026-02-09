
-- =============================================
-- Fix 1: Security Definer Views
-- Recreate views with SECURITY INVOKER
-- =============================================

DROP VIEW IF EXISTS public.inventory_stock_summary;
CREATE VIEW public.inventory_stock_summary
WITH (security_invoker = true)
AS
SELECT i.id AS item_id,
    i.organization_id,
    i.name,
    i.category,
    i.unit,
    i.reorder_threshold,
    i.par_level,
    COALESCE(sum(s.quantity), (0)::numeric) AS total_stock,
    CASE
        WHEN (COALESCE(sum(s.quantity), (0)::numeric) <= i.reorder_threshold) THEN 'low'::text
        WHEN (COALESCE(sum(s.quantity), (0)::numeric) <= (i.reorder_threshold * 1.5)) THEN 'warning'::text
        ELSE 'good'::text
    END AS stock_status
FROM (inventory_items i
    LEFT JOIN inventory_stock s ON (((s.item_id = i.id) AND (s.deleted_at IS NULL))))
WHERE ((i.deleted_at IS NULL) AND (i.is_active = true))
GROUP BY i.id;

DROP VIEW IF EXISTS public.technician_checklist_compliance;
CREATE VIEW public.technician_checklist_compliance
WITH (security_invoker = true)
AS
SELECT p.id AS technician_id,
    p.organization_id,
    p.location_id,
    p.first_name,
    p.last_name,
    ct.frequency,
    count(cs.id) AS submissions_count,
    max(cs.submitted_at) AS last_submission
FROM ((profiles p
    CROSS JOIN checklist_templates ct)
    LEFT JOIN checklist_submissions cs ON (((cs.technician_id = p.id) AND (cs.template_id = ct.id))))
WHERE ((p.role = 'technician'::user_role) AND (p.deleted_at IS NULL) AND (p.is_active = true) AND (ct.deleted_at IS NULL) AND (ct.is_active = true) AND (ct.organization_id = p.organization_id))
GROUP BY p.id, ct.frequency, ct.id;

-- =============================================
-- Fix 2: Function Search Path Mutable
-- Set search_path = public on all functions missing it
-- =============================================

CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  org_id UUID;
  current_user_id UUID;
BEGIN
  SELECT id INTO current_user_id FROM profiles WHERE user_id = auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      org_id := NEW.id;
    ELSE
      org_id := NEW.organization_id;
    END IF;
    
    INSERT INTO audit_log (organization_id, user_id, action, table_name, record_id, new_values)
    VALUES (org_id, current_user_id, 'create', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      org_id := NEW.id;
    ELSE
      org_id := NEW.organization_id;
    END IF;
    
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO audit_log (organization_id, user_id, action, table_name, record_id, old_values)
      VALUES (org_id, current_user_id, 'delete', TG_TABLE_NAME, NEW.id, to_jsonb(OLD));
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      INSERT INTO audit_log (organization_id, user_id, action, table_name, record_id, new_values)
      VALUES (org_id, current_user_id, 'restore', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    ELSE
      INSERT INTO audit_log (organization_id, user_id, action, table_name, record_id, old_values, new_values)
      VALUES (org_id, current_user_id, 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'organizations' THEN
      org_id := OLD.id;
    ELSE
      org_id := OLD.organization_id;
    END IF;
    
    INSERT INTO audit_log (organization_id, user_id, action, table_name, record_id, old_values)
    VALUES (org_id, current_user_id, 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_technician_scheduling_context(tech_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  tech_record RECORD;
  skills_text TEXT := '';
  notes_text TEXT := '';
  result TEXT;
BEGIN
  SELECT first_name, last_name INTO tech_record
  FROM profiles WHERE id = tech_profile_id;
  
  IF tech_record IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT STRING_AGG(
    '- ' || service_type || ': ' || UPPER(skill_level) || 
    CASE WHEN notes IS NOT NULL AND notes != '' THEN ' (' || notes || ')' ELSE '' END,
    E'\n'
  ) INTO skills_text
  FROM technician_skills
  WHERE profile_id = tech_profile_id;
  
  SELECT STRING_AGG('- ' || note, E'\n') INTO notes_text
  FROM technician_notes
  WHERE profile_id = tech_profile_id AND is_active = TRUE;
  
  result := '## Technician: ' || tech_record.first_name || ' ' || tech_record.last_name || E'\n\n';
  
  IF skills_text IS NOT NULL AND skills_text != '' THEN
    result := result || '### Service Skills:' || E'\n' || skills_text || E'\n\n';
  END IF;
  
  IF notes_text IS NOT NULL AND notes_text != '' THEN
    result := result || '### Scheduling Notes:' || E'\n' || notes_text || E'\n';
  END IF;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_all_technicians_scheduling_context(org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  tech_record RECORD;
  result TEXT := '';
  tech_context TEXT;
BEGIN
  FOR tech_record IN 
    SELECT id FROM profiles 
    WHERE organization_id = org_id 
    AND role = 'technician' 
    AND is_active = TRUE 
    AND deleted_at IS NULL
    ORDER BY first_name, last_name
  LOOP
    tech_context := get_technician_scheduling_context(tech_record.id);
    IF tech_context IS NOT NULL THEN
      result := result || tech_context || E'\n---\n\n';
    END IF;
  END LOOP;
  
  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT organization_id FROM profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_location_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT location_id FROM profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT role FROM profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT role = 'admin' FROM profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.restore_record(p_table_name text, p_record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL, updated_at = NOW() WHERE id = %L', p_table_name, p_record_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;
