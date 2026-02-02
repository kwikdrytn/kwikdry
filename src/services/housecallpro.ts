import { supabase } from "@/integrations/supabase/client";
import type { SchedulingSuggestion, PriceBookMapping } from "@/types/scheduling";

// ============================================
// Types
// ============================================

export interface CreateJobParams {
  organizationId: string;
  customerId?: string; // HCP customer ID if exists
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  scheduledEndTime?: string; // HH:MM
  duration?: number; // minutes (alternative to scheduledEndTime)
  assignedEmployeeId?: string; // HCP employee ID
  serviceType: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
  createAsDraft?: boolean; // Create as "needs scheduling" instead of scheduled
}

export interface CreateJobResult {
  success: boolean;
  jobId?: string;
  hcpJobId?: string;
  jobUrl?: string;
  customerId?: string;
  error?: string;
}

export interface SearchCustomerResult {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface HCPCustomer {
  id: string;
  hcp_customer_id: string;
  name: string;
  phone_numbers?: { number: string; type: string }[];
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface HCPEmployee {
  id: string;
  hcp_employee_id: string;
  name: string;
  email?: string;
  phone?: string;
  linked_user_id?: string;
}

export interface HCPService {
  id: string;
  hcp_service_id: string;
  name: string;
  description?: string;
  price?: number;
  is_active: boolean;
}

// ============================================
// Job Creation
// ============================================

/**
 * Create a job in HouseCall Pro via the edge function.
 * This handles customer lookup/creation and job scheduling.
 */
export async function createHCPJob(params: CreateJobParams): Promise<CreateJobResult> {
  try {
    const { data, error } = await supabase.functions.invoke("create-hcp-job", {
      body: {
        organizationId: params.organizationId,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        address: params.address,
        city: params.city,
        state: params.state,
        zip: params.zip,
        scheduledDate: params.scheduledDate,
        scheduledTime: params.scheduledTime,
        duration: params.duration || calculateDuration(params.scheduledTime, params.scheduledEndTime),
        serviceType: params.serviceType,
        technicianHcpId: params.assignedEmployeeId,
        notes: params.notes,
        coordinates: params.coordinates,
        createAsDraft: params.createAsDraft || false,
      },
    });

    if (error) {
      console.error("HCP job creation error:", error);
      return {
        success: false,
        error: error.message || "Failed to create job",
      };
    }

    return {
      success: data.success,
      jobId: data.jobId,
      hcpJobId: data.hcpJobId,
      jobUrl: data.hcpJobUrl,
      customerId: data.customerId,
      error: data.error,
    };
  } catch (error) {
    console.error("HCP job creation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate duration in minutes from start and end times
 */
function calculateDuration(startTime: string, endTime?: string): number {
  if (!endTime) return 60; // Default 1 hour

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return Math.max(30, endMinutes - startMinutes); // Minimum 30 minutes
}

// ============================================
// Customer Operations
// ============================================

/**
 * Search for a customer in the local database by phone number
 */
export async function searchCustomerByPhone(
  organizationId: string,
  phone: string
): Promise<SearchCustomerResult | null> {
  const normalizedPhone = phone.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("hcp_customers")
    .select("id, hcp_customer_id, name, phone_numbers, email, address")
    .eq("organization_id", organizationId)
    .limit(10);

  if (error || !data) return null;

  // Search through phone numbers (stored as JSON array)
  for (const customer of data) {
    const phoneNumbers = customer.phone_numbers as { number?: string }[] | null;
    if (phoneNumbers) {
      const hasMatch = phoneNumbers.some((p) => {
        const customerPhone = (p.number || "").replace(/\D/g, "");
        return customerPhone.includes(normalizedPhone) || normalizedPhone.includes(customerPhone);
      });
      if (hasMatch) {
        return {
          id: customer.hcp_customer_id,
          name: customer.name,
          phone: phoneNumbers[0]?.number,
          email: customer.email || undefined,
          address: customer.address || undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Search for customers by name
 */
export async function searchCustomerByName(
  organizationId: string,
  name: string
): Promise<SearchCustomerResult[]> {
  const { data, error } = await supabase
    .from("hcp_customers")
    .select("id, hcp_customer_id, name, phone_numbers, email, address")
    .eq("organization_id", organizationId)
    .ilike("name", `%${name}%`)
    .limit(10);

  if (error || !data) return [];

  return data.map((customer) => {
    const phoneNumbers = customer.phone_numbers as { number?: string }[] | null;
    return {
      id: customer.hcp_customer_id,
      name: customer.name,
      phone: phoneNumbers?.[0]?.number,
      email: customer.email || undefined,
      address: customer.address || undefined,
    };
  });
}

// ============================================
// Employee/Technician Operations
// ============================================

/**
 * Get all HCP employees for an organization
 */
export async function getHCPEmployees(organizationId: string): Promise<HCPEmployee[]> {
  const { data, error } = await supabase
    .from("hcp_employees")
    .select("id, hcp_employee_id, name, email, phone, linked_user_id")
    .eq("organization_id", organizationId)
    .order("name");

  if (error) {
    console.error("Error fetching HCP employees:", error);
    return [];
  }

  return data || [];
}

/**
 * Get HCP employee by linked user profile ID
 */
export async function getHCPEmployeeByProfileId(
  organizationId: string,
  profileId: string
): Promise<HCPEmployee | null> {
  const { data, error } = await supabase
    .from("hcp_employees")
    .select("id, hcp_employee_id, name, email, phone, linked_user_id")
    .eq("organization_id", organizationId)
    .eq("linked_user_id", profileId)
    .single();

  if (error) return null;
  return data;
}

// ============================================
// Service/Price Book Operations
// ============================================

/**
 * Get all active services from the HCP price book
 */
export async function getHCPServices(organizationId: string): Promise<HCPService[]> {
  const { data, error } = await supabase
    .from("hcp_services")
    .select("id, hcp_service_id, name, description, price, is_active")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Error fetching HCP services:", error);
    return [];
  }

  return data || [];
}

/**
 * Get service by name
 */
export async function getHCPServiceByName(
  organizationId: string,
  serviceName: string
): Promise<HCPService | null> {
  const { data, error } = await supabase
    .from("hcp_services")
    .select("id, hcp_service_id, name, description, price, is_active")
    .eq("organization_id", organizationId)
    .ilike("name", serviceName)
    .single();

  if (error) return null;
  return data;
}

// ============================================
// Job URL Helpers
// ============================================

/**
 * Get the HouseCall Pro URL for a job
 */
export function getHCPJobUrl(hcpJobId: string): string {
  return `https://pro.housecallpro.com/pro/jobs/${hcpJobId}`;
}

/**
 * Get the HouseCall Pro URL for a customer
 */
export function getHCPCustomerUrl(hcpCustomerId: string): string {
  return `https://pro.housecallpro.com/pro/customers/${hcpCustomerId}`;
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate job parameters before submission
 */
export function validateJobParams(params: Partial<CreateJobParams>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!params.customerName?.trim()) {
    errors.push("Customer name is required");
  }

  if (!params.address?.trim()) {
    errors.push("Address is required");
  }

  if (!params.city?.trim()) {
    errors.push("City is required");
  }

  if (!params.state?.trim()) {
    errors.push("State is required");
  }

  if (!params.scheduledDate) {
    errors.push("Scheduled date is required");
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(params.scheduledDate)) {
    errors.push("Scheduled date must be in YYYY-MM-DD format");
  }

  if (!params.scheduledTime) {
    errors.push("Scheduled time is required");
  } else if (!/^\d{2}:\d{2}$/.test(params.scheduledTime)) {
    errors.push("Scheduled time must be in HH:MM format");
  }

  if (!params.serviceType?.trim()) {
    errors.push("Service type is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Normalize phone number for API calls
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ============================================
// PriceBook Mapping
// ============================================

/**
 * Get PriceBook mapping for a service type
 */
export async function getPriceBookMapping(
  organizationId: string,
  serviceType: string
): Promise<PriceBookMapping | null> {
  const { data, error } = await supabase
    .from("pricebook_mapping")
    .select("*")
    .eq("organization_id", organizationId)
    .ilike("service_type", serviceType)
    .maybeSingle();

  if (error) {
    console.error("Error fetching PriceBook mapping:", error);
    return null;
  }
  return data as PriceBookMapping | null;
}

/**
 * Get all PriceBook mappings for an organization
 */
export async function getPriceBookMappings(
  organizationId: string
): Promise<PriceBookMapping[]> {
  const { data, error } = await supabase
    .from("pricebook_mapping")
    .select("*")
    .eq("organization_id", organizationId)
    .order("service_type");

  if (error) {
    console.error("Error fetching PriceBook mappings:", error);
    return [];
  }
  return data as PriceBookMapping[];
}

// ============================================
// Suggestion Helpers
// ============================================

/**
 * Create a job from an AI scheduling suggestion
 */
export async function createJobFromSuggestion(
  suggestion: SchedulingSuggestion,
  organizationId: string,
  overrides?: {
    technicianId?: string;
    date?: string;
    time?: string;
    createAsDraft?: boolean;
  }
): Promise<CreateJobResult> {
  const techId = overrides?.technicianId || suggestion.technicianId;
  const jobDate = overrides?.date || suggestion.scheduledDate;
  const jobTime = overrides?.time || suggestion.scheduledTime;

  // Get PriceBook mapping for duration
  const mapping = await getPriceBookMapping(organizationId, suggestion.serviceType);
  const duration = mapping?.default_duration_minutes || suggestion.duration || 60;

  return createHCPJob({
    organizationId,
    customerName: suggestion.customerName,
    customerPhone: suggestion.customerPhone,
    address: suggestion.address,
    city: suggestion.city,
    state: suggestion.state,
    zip: suggestion.zip,
    scheduledDate: jobDate,
    scheduledTime: jobTime,
    duration,
    serviceType: suggestion.serviceType,
    assignedEmployeeId: techId,
    notes: suggestion.reasoning,
    createAsDraft: overrides?.createAsDraft,
  });
}
