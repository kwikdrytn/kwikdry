// HouseCall Pro API types and utilities
// Note: Actual API calls are made through edge functions to protect the API key

export const HCP_BASE_URL = 'https://api.housecallpro.com';

export interface HCPJob {
  id: string;
  customer?: {
    id: string;
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    mobile_number?: string;
    home_number?: string;
    work_number?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  schedule?: {
    scheduled_start?: string;
    scheduled_end?: string;
  };
  work_status?: string;
  total_amount?: number;
  assigned_employees?: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
  }>;
  line_items?: Array<{
    name?: string;
    description?: string;
    unit_price?: number;
    quantity?: number;
  }>;
  location?: {
    lat?: number;
    lng?: number;
  };
}

export interface HCPCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  email?: string;
  mobile_number?: string;
  home_number?: string;
  work_number?: string;
  addresses?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  }>;
}

export interface HCPServiceZone {
  id: string;
  name: string;
  color?: string;
  polygon?: {
    type?: string;
    coordinates?: number[][][];
  };
  boundary?: Array<{ lat: number; lng: number }>;
  vertices?: Array<{ lat: number; lng: number }>;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface HCPEmployee {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
}

export interface SyncResult {
  success: boolean;
  error?: string;
  synced?: {
    jobs: number;
    customers: number;
    employees: number;
    serviceZones: number;
  };
  fetched?: {
    jobs: number;
    customers: number;
    employees: number;
    serviceZones: number;
  };
}

export interface SyncProgress {
  stage: 'idle' | 'syncing' | 'complete' | 'error';
  message: string;
  details?: string;
}

/**
 * Normalize phone number by removing all non-digit characters
 * @example normalizePhone("(865) 555-1234") => "8655551234"
 */
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

/**
 * Format phone number for display
 * @example formatPhoneDisplay("8655551234") => "(865) 555-1234"
 */
export function formatPhoneDisplay(phone: string | null): string {
  if (!phone || phone.length < 10) return phone || '';
  
  // Handle 10-digit numbers
  if (phone.length === 10) {
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  
  // Handle 11-digit numbers (with country code)
  if (phone.length === 11 && phone.startsWith('1')) {
    return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
  }
  
  return phone;
}

/**
 * Get customer display name from HCP customer data
 */
export function getCustomerDisplayName(customer: HCPCustomer): string {
  if (customer.company) return customer.company;
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(' ');
  return name || 'Unknown Customer';
}

/**
 * Get job status badge color
 */
export function getJobStatusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'in_progress':
    case 'in progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
    case 'complete':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
    case 'canceled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format job status for display
 */
export function formatJobStatus(status: string | null): string {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
