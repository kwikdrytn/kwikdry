// Skill level determines how the AI should prioritize job assignments
export type SkillLevel = 'preferred' | 'standard' | 'avoid' | 'never';

// Note types for categorization
export type NoteType = 'scheduling' | 'skill' | 'restriction' | 'general';

// Service types offered
export type ServiceType =
  | 'carpet_cleaning'
  | 'upholstery_cleaning'
  | 'air_duct_cleaning'
  | 'tile_grout_cleaning'
  | 'dryer_vent_cleaning'
  | 'mattress_cleaning'
  | 'wood_floor_cleaning';

export interface TechnicianSkill {
  id: string;
  profile_id: string;
  service_type: ServiceType;
  skill_level: SkillLevel;
  avg_job_duration_minutes: number | null;
  quality_rating: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechnicianNote {
  id: string;
  profile_id: string;
  note_type: NoteType;
  note: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// Extended profile type with skills and notes
export interface ProfileWithSkills {
  id: string;
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: 'admin' | 'call_staff' | 'technician';
  organization_id: string;
  location_id: string | null;
  is_active: boolean | null;
  custom_role_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  home_lat: number | null;
  home_lng: number | null;
  technician_skills?: TechnicianSkill[];
  technician_notes?: TechnicianNote[];
}

// Service type display configuration
export const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'carpet_cleaning', label: 'Carpet Cleaning' },
  { value: 'upholstery_cleaning', label: 'Upholstery Cleaning' },
  { value: 'air_duct_cleaning', label: 'Air Duct Cleaning' },
  { value: 'tile_grout_cleaning', label: 'Tile & Grout Cleaning' },
  { value: 'dryer_vent_cleaning', label: 'Dryer Vent Cleaning' },
  { value: 'mattress_cleaning', label: 'Mattress Cleaning' },
  { value: 'wood_floor_cleaning', label: 'Wood Floor Cleaning' },
];

// Skill level display configuration
export const SKILL_LEVELS: { value: SkillLevel; label: string; description: string; color: string }[] = [
  { value: 'preferred', label: 'Preferred', description: 'Prioritize these jobs for this tech', color: 'green' },
  { value: 'standard', label: 'Standard', description: 'Normal assignment, no preference', color: 'gray' },
  { value: 'avoid', label: 'Avoid', description: 'Only assign if no other options', color: 'yellow' },
  { value: 'never', label: 'Never', description: 'Never assign this job type', color: 'red' },
];
