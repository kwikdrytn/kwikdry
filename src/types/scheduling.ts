// Suggestion status types
export type SuggestionStatus = 'pending' | 'creating' | 'created' | 'modified' | 'rejected' | 'failed' | 'error';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// Service types matching the PriceBook
export type ServiceType =
  | 'Carpet Cleaning'
  | 'Upholstery Cleaning'
  | 'Air Duct Cleaning'
  | 'Tile & Grout Cleaning'
  | 'Dryer Vent Cleaning'
  | 'Mattress Cleaning'
  | 'Wood Floor Cleaning';

export const SERVICE_TYPES: ServiceType[] = [
  'Carpet Cleaning',
  'Upholstery Cleaning',
  'Air Duct Cleaning',
  'Tile & Grout Cleaning',
  'Dryer Vent Cleaning',
  'Mattress Cleaning',
  'Wood Floor Cleaning',
];

export interface SchedulingSuggestion {
  id: string;
  jobId?: string; // If assigning existing job
  technicianId?: string; // HCP employee ID
  technicianName: string;
  serviceType: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  duration?: number; // minutes
  reasoning: string;
  confidence: ConfidenceLevel;
  nearbyJobsCount?: number;
  nearestExistingJob?: string;
  skillMatch?: 'preferred' | 'standard' | 'avoid';
  // State for UI
  status?: SuggestionStatus;
  hcpJobId?: string;
  hcpJobUrl?: string;
  hcpCustomerId?: string;
  error?: string;
  // Modifications
  actualTechnicianId?: string;
  actualDate?: string;
  actualTime?: string;
  // Meta
  createdAt?: string;
  actedOnAt?: string;
  batchId?: string;
}

export interface PriceBookMapping {
  id: string;
  organization_id: string;
  service_type: string;
  hcp_pricebook_item_id: string;
  hcp_pricebook_item_name: string | null;
  default_duration_minutes: number;
  created_at?: string;
  updated_at?: string;
}

export interface TechnicianDistance {
  id?: string;
  name: string;
  hcpEmployeeId?: string;
  drivingDistanceMiles?: number;
  drivingDurationMinutes?: number;
  straightLineDistance?: number;
}

export interface SuggestionResponse {
  suggestions: Array<{
    date: string;
    dayName: string;
    timeSlot: string;
    reason: string;
    confidence: ConfidenceLevel;
    nearbyJobsCount?: number;
    suggestedTechnician?: string;
    nearestExistingJob?: string;
    skillMatch?: 'preferred' | 'standard' | 'avoid';
  }>;
  analysis: string;
  warnings?: string[];
  technicians?: TechnicianDistance[];
  estimatedDurationMinutes?: number;
}

export interface CreateJobRequest {
  organizationId: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration?: number;
  serviceType: string;
  technicianHcpId?: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
  createAsDraft?: boolean; // Create as "needs scheduling" instead of scheduled
}

export interface CreateJobResponse {
  success: boolean;
  jobId?: string;
  hcpJobId?: string;
  hcpJobUrl?: string;
  customerId?: string;
  error?: string;
}

export interface HCPJobResult {
  success: boolean;
  job_id?: string;
  job_url?: string;
  customer_id?: string;
  error?: string;
}
