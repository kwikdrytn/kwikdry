import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays, startOfDay } from "date-fns";

export interface HCPJobService {
  name?: string;
  description?: string;
  price?: number;
  quantity?: number;
}

export interface HCPJobNote {
  id?: string;
  content?: string;
}

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
  services: HCPJobService[] | null;
  total_items?: HCPJobService[] | null;
  notes: string | HCPJobNote[] | null;
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

export interface TechnicianLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

export interface MapFilters {
  startDate: Date;
  weekView: boolean;
  technicians: string[]; // 'all' | 'unassigned' | hcp_employee_id[]
  serviceTypes: string[]; // 'all' | service names
  statuses: string[]; // 'all' | status values
  showZones: boolean;
  showTechLocations: boolean;
}

export const DEFAULT_FILTERS: MapFilters = {
  startDate: new Date(),
  weekView: false,
  technicians: ['all'],
  serviceTypes: ['all'],
  statuses: ['all'],
  showZones: true,
  showTechLocations: true,
};

// Status options
export const JOB_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Day colors for week view
export const DAY_COLORS = [
  '#6366f1', // Sunday - indigo
  '#3b82f6', // Monday - blue
  '#10b981', // Tuesday - emerald
  '#f59e0b', // Wednesday - amber
  '#ef4444', // Thursday - red
  '#8b5cf6', // Friday - violet
  '#ec4899', // Saturday - pink
];

export function useJobsForDateRange(filters: MapFilters) {
  const { profile } = useAuth();

  const startDate = startOfDay(filters.startDate);
  const endDate = filters.weekView ? addDays(startDate, 6) : startDate;

  return useQuery({
    queryKey: [
      'job-map-jobs-range',
      profile?.organization_id,
      format(startDate, 'yyyy-MM-dd'),
      format(endDate, 'yyyy-MM-dd'),
      filters.technicians,
      filters.serviceTypes,
      filters.statuses,
    ],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      let query = supabase
        .from('hcp_jobs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .gte('scheduled_date', format(startDate, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(endDate, 'yyyy-MM-dd'));

      const { data, error } = await query.order('scheduled_date').order('scheduled_time');

      if (error) throw error;

      let jobs = (data || []) as HCPJob[];

      // Filter by technicians
      if (!filters.technicians.includes('all')) {
        jobs = jobs.filter(job => {
          if (filters.technicians.includes('unassigned')) {
            if (!job.technician_hcp_id) return true;
          }
          return job.technician_hcp_id && filters.technicians.includes(job.technician_hcp_id);
        });
      }

      // Filter by service types
      if (!filters.serviceTypes.includes('all')) {
        jobs = jobs.filter(job => {
          const services = job.services as { name?: string; code?: string }[] | null;
          if (!services) return false;
          return services.some(s => 
            s.name && filters.serviceTypes.includes(s.name)
          );
        });
      }

      // Filter by statuses
      if (!filters.statuses.includes('all')) {
        jobs = jobs.filter(job => {
          const status = (job.status || 'scheduled').toLowerCase().replace(/\s+/g, '_');
          return filters.statuses.includes(status);
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

      // Get HCP employees (prefer linked ones)
      const { data: hcpEmployees, error: hcpError } = await supabase
        .from('hcp_employees')
        .select('hcp_employee_id, name, linked_user_id')
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (hcpError) throw hcpError;
      
      return (hcpEmployees || []).map(e => ({
        id: e.hcp_employee_id,
        name: e.name,
        isLinked: !!e.linked_user_id,
      }));
    },
    enabled: !!profile?.organization_id
  });
}

export function useTechnicianLocations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['technician-locations-map', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, home_lat, home_lng, address, city, state, zip')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'technician')
        .eq('is_active', true)
        .is('deleted_at', null)
        .not('home_lat', 'is', null)
        .not('home_lng', 'is', null);

      if (error) throw error;

      return (data || []).map((tech) => ({
        id: tech.id,
        name: `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || 'Unknown',
        lat: tech.home_lat as number,
        lng: tech.home_lng as number,
        address: [tech.address, tech.city, tech.state, tech.zip].filter(Boolean).join(', '),
      })) as TechnicianLocation[];
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

      // First try to get services from the hcp_services catalog
      const { data: catalogServices, error: catalogError } = await supabase
        .from('hcp_services')
        .select('name')
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .order('name');

      if (!catalogError && catalogServices && catalogServices.length > 0) {
        return catalogServices.map(s => s.name);
      }

      // Fall back to extracting from job services array
      const { data: jobsWithServices, error: servicesError } = await supabase
        .from('hcp_jobs')
        .select('services')
        .eq('organization_id', profile.organization_id)
        .not('services', 'is', null)
        .limit(500);

      if (!servicesError && jobsWithServices) {
        const serviceSet = new Set<string>();
        jobsWithServices.forEach(job => {
          const services = job.services as { name?: string }[] | null;
          if (services && services.length > 0) {
            services.forEach(s => {
              if (s.name) serviceSet.add(s.name);
            });
          }
        });
        
        if (serviceSet.size > 0) {
          return Array.from(serviceSet).sort();
        }
      }

      // Final fallback: extract service types from notes field
      // HCP often embeds service info in notes like "Carpet Cleaning - First 2 Rooms - $88"
      // Notes may be a JSON array string: [{"id":"...", "content":"..."}] or a plain string
      const { data: jobsWithNotes, error: notesError } = await supabase
        .from('hcp_jobs')
        .select('notes')
        .eq('organization_id', profile.organization_id)
        .not('notes', 'is', null)
        .limit(500);

      if (notesError) throw notesError;

      const serviceSet = new Set<string>();
      const servicePatterns = [
        'Carpet Cleaning',
        'Duct Cleaning',
        'Air Duct Cleaning',
        'Upholstery Cleaning',
        'Tile Cleaning',
        'Hardwood Cleaning',
        'Pet Odor Treatment',
        'Stain Removal',
        'Water Damage',
        'Dryer Vent Cleaning',
        'Area Rug Cleaning',
        'Mattress Cleaning',
        'Commercial Cleaning',
        'Single Room',
      ];

      (jobsWithNotes || []).forEach(job => {
        if (!job.notes) return;
        
        // Extract the actual note content - handle JSON array string or plain string
        let noteText = '';
        const notesRaw = job.notes as string;
        
        if (notesRaw.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(notesRaw) as { id?: string; content?: string }[];
            noteText = parsed
              .filter(n => n.content)
              .map(n => n.content)
              .join('\n');
          } catch {
            noteText = notesRaw;
          }
        } else {
          noteText = notesRaw;
        }
        
        if (noteText) {
          // Try to extract service type from beginning of notes
          // Pattern: "Service Type - Details - Price"
          const firstPart = noteText.split(' - ')[0]?.trim();
          if (firstPart && firstPart.length > 2 && firstPart.length < 50) {
            serviceSet.add(firstPart);
          }
          
          // Also check for known service patterns anywhere in notes
          servicePatterns.forEach(pattern => {
            if (noteText.toLowerCase().includes(pattern.toLowerCase())) {
              serviceSet.add(pattern);
            }
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

// URL state helpers
export function filtersToSearchParams(filters: MapFilters): URLSearchParams {
  const params = new URLSearchParams();
  
  params.set('date', format(filters.startDate, 'yyyy-MM-dd'));
  if (filters.weekView) params.set('week', '1');
  if (!filters.technicians.includes('all')) {
    params.set('techs', filters.technicians.join(','));
  }
  if (!filters.serviceTypes.includes('all')) {
    params.set('services', filters.serviceTypes.join(','));
  }
  if (!filters.statuses.includes('all')) {
    params.set('statuses', filters.statuses.join(','));
  }
  if (!filters.showZones) params.set('zones', '0');
  if (!filters.showTechLocations) params.set('techLocs', '0');
  
  return params;
}

export function searchParamsToFilters(params: URLSearchParams): Partial<MapFilters> {
  const result: Partial<MapFilters> = {};
  
  const dateStr = params.get('date');
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      result.startDate = parsed;
    }
  }
  
  if (params.get('week') === '1') result.weekView = true;
  
  const techs = params.get('techs');
  if (techs) result.technicians = techs.split(',');
  
  const services = params.get('services');
  if (services) result.serviceTypes = services.split(',');
  
  const statuses = params.get('statuses');
  if (statuses) result.statuses = statuses.split(',');
  
  if (params.get('zones') === '0') result.showZones = false;
  if (params.get('techLocs') === '0') result.showTechLocations = false;
  
  return result;
}

// Count active filters
export function countActiveFilters(filters: MapFilters): number {
  let count = 0;
  if (!filters.technicians.includes('all')) count++;
  if (!filters.serviceTypes.includes('all')) count++;
  if (!filters.statuses.includes('all')) count++;
  if (filters.weekView) count++;
  return count;
}
