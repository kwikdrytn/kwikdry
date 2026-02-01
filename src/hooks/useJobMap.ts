import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface HCPJob {
  id: string;
  hcp_job_id: string;
  customer_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_end: string | null;
  status: string | null;
  services: { name?: string; code?: string }[] | null;
  technician_name: string | null;
  technician_hcp_id: string | null;
  location_id: string | null;
  total_amount: number | null;
}

export interface ServiceZone {
  id: string;
  name: string;
  color: string | null;
  polygon_geojson: {
    type: "Polygon";
    coordinates: number[][][];
  } | null;
}

export function useJobsForDate(selectedDate: Date, technicianFilter?: string, serviceFilter?: string) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['job-map-jobs', profile?.organization_id, format(selectedDate, 'yyyy-MM-dd'), technicianFilter, serviceFilter],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('hcp_jobs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('scheduled_date', format(selectedDate, 'yyyy-MM-dd'));

      if (technicianFilter && technicianFilter !== 'all') {
        query = query.eq('technician_hcp_id', technicianFilter);
      }

      const { data, error } = await query.order('scheduled_time');

      if (error) throw error;

      let jobs = (data || []) as HCPJob[];

      // Filter by service type if specified
      if (serviceFilter && serviceFilter !== 'all') {
        jobs = jobs.filter(job => {
          const services = job.services as { name?: string; code?: string }[] | null;
          if (!services) return false;
          return services.some(s => s.name === serviceFilter || s.code === serviceFilter);
        });
      }

      return jobs;
    },
    enabled: !!profile?.organization_id
  });
}

export function useServiceZones() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['service-zones-map', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('hcp_service_zones')
        .select('id, name, color, polygon_geojson')
        .eq('organization_id', profile.organization_id);

      if (error) throw error;
      return (data || []) as ServiceZone[];
    },
    enabled: !!profile?.organization_id
  });
}

export function useTechnicians() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['job-map-technicians', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('hcp_employees')
        .select('hcp_employee_id, name')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id
  });
}

export function useServiceTypes() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['job-map-service-types', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get distinct service types from recent jobs
      const { data, error } = await supabase
        .from('hcp_jobs')
        .select('services')
        .eq('organization_id', profile.organization_id)
        .not('services', 'is', null)
        .limit(500);

      if (error) throw error;

      const serviceSet = new Set<string>();
      (data || []).forEach(job => {
        const services = job.services as { name?: string; code?: string }[] | null;
        if (services) {
          services.forEach(s => {
            if (s.name) serviceSet.add(s.name);
          });
        }
      });

      return Array.from(serviceSet).sort();
    },
    enabled: !!profile?.organization_id
  });
}

export function useFirstLocation() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['first-location', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from('locations')
        .select('city, state')
        .eq('organization_id', profile.organization_id)
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .single();

      if (error) return null;
      return data;
    },
    enabled: !!profile?.organization_id
  });
}
