export interface SchedulingSuggestion {
  id: string;
  jobId?: string; // If assigning existing job
  technicianId?: string; // HCP employee ID
  technicianName: string;
  serviceType: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  duration?: number; // minutes
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  nearbyJobsCount?: number;
  nearestExistingJob?: string;
  skillMatch?: 'preferred' | 'standard' | 'avoid';
  // State for UI
  status?: 'pending' | 'creating' | 'created' | 'error';
  hcpJobId?: string;
  hcpJobUrl?: string;
  error?: string;
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
    confidence: 'high' | 'medium' | 'low';
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
}

export interface CreateJobResponse {
  success: boolean;
  jobId?: string;
  hcpJobId?: string;
  hcpJobUrl?: string;
  error?: string;
}
