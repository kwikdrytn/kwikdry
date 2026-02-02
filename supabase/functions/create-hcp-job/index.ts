import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateJobRequest {
  organizationId: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:MM
  duration?: number; // minutes
  serviceType: string;
  technicianHcpId?: string;
  notes?: string;
  coordinates?: { lat: number; lng: number };
}

interface CreateJobResponse {
  success: boolean;
  jobId?: string;
  hcpJobId?: string;
  hcpJobUrl?: string;
  error?: string;
}

// State name to abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

// Normalize state to 2-letter abbreviation
function normalizeState(state: string): string {
  if (!state) return "";
  
  let trimmed = state.trim();
  
  // Handle "State Zip" format (e.g., "Tennessee 37934")
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    // Check if last part looks like a zip code
    const lastPart = parts[parts.length - 1];
    if (/^\d{5}(-\d{4})?$/.test(lastPart)) {
      // Remove the zip code part
      trimmed = parts.slice(0, -1).join(" ");
    }
  }
  
  // Already a 2-letter code
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }
  
  // Try to find in mapping
  const lower = trimmed.toLowerCase();
  if (STATE_ABBREVIATIONS[lower]) {
    return STATE_ABBREVIATIONS[lower];
  }
  
  // Fallback: take first 2 letters if nothing matches
  console.warn(`Unknown state "${state}", using first 2 chars`);
  return trimmed.substring(0, 2).toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: CreateJobRequest = await req.json();
    const {
      organizationId,
      customerName,
      customerPhone,
      address,
      city,
      state: rawState,
      zip,
      scheduledDate,
      scheduledTime,
      duration = 60,
      serviceType,
      technicianHcpId,
      notes,
      coordinates,
    } = requestData;

    // Normalize state to 2-letter abbreviation
    const state = normalizeState(rawState);
    
    console.log("Creating job for:", customerName, "at", address, city, state, "on", scheduledDate, scheduledTime);

    // Fetch organization's HCP API key
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("hcp_api_key, hcp_company_id")
      .eq("id", organizationId)
      .single();

    if (orgError || !org?.hcp_api_key) {
      console.error("Organization or API key not found:", orgError);
      return new Response(
        JSON.stringify({ success: false, error: "HouseCall Pro API not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hcpApiKey = org.hcp_api_key;
    const hcpBaseUrl = "https://api.housecallpro.com";

    // Step 1: Find or create customer
    let customerId: string | null = null;

    // Search for existing customer by phone
    if (customerPhone) {
      const phoneSearch = customerPhone.replace(/\D/g, "");
      const searchResponse = await fetch(
        `${hcpBaseUrl}/customers?phone_number=${phoneSearch}`,
        {
          headers: {
            Authorization: `Token ${hcpApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.customers && searchData.customers.length > 0) {
          customerId = searchData.customers[0].id;
          console.log("Found existing customer:", customerId);
        }
      }
    }

    // Create new customer if not found
    if (!customerId) {
      const nameParts = customerName.trim().split(" ");
      const firstName = nameParts[0] || customerName;
      const lastName = nameParts.slice(1).join(" ") || "";

      const customerPayload: Record<string, any> = {
        first_name: firstName,
        last_name: lastName,
        addresses: [
          {
            street: address,
            city: city,
            state: state,
            zip: zip || "",
            type: "service",
          },
        ],
      };

      if (customerPhone) {
        customerPayload.mobile_number = customerPhone;
      }

      console.log("Creating new customer:", customerPayload);

      const createCustomerResponse = await fetch(`${hcpBaseUrl}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Token ${hcpApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customerPayload),
      });

      if (!createCustomerResponse.ok) {
        const errorText = await createCustomerResponse.text();
        console.error("Failed to create customer:", errorText);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create customer: ${errorText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newCustomer = await createCustomerResponse.json();
      customerId = newCustomer.id;
      console.log("Created new customer:", customerId);
    }

    // Step 2: Find the service in HCP price book
    let serviceItemId: string | null = null;
    const servicesResponse = await fetch(`${hcpBaseUrl}/price_book/services`, {
      headers: {
        Authorization: `Token ${hcpApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (servicesResponse.ok) {
      const servicesData = await servicesResponse.json();
      const matchingService = servicesData.services?.find(
        (s: any) => s.name?.toLowerCase() === serviceType.toLowerCase()
      );
      if (matchingService) {
        serviceItemId = matchingService.id;
        console.log("Found matching service:", serviceItemId);
      }
    }

    // Step 3: Get employee details for assignment
    let employeeId: string | null = null;
    console.log("Looking up technician with ID:", technicianHcpId);
    
    if (technicianHcpId) {
      // First try: direct match on hcp_employee_id
      const { data: hcpEmployee } = await supabase
        .from("hcp_employees")
        .select("hcp_employee_id, name")
        .eq("hcp_employee_id", technicianHcpId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (hcpEmployee) {
        employeeId = hcpEmployee.hcp_employee_id;
        console.log("Found employee by HCP ID:", employeeId, hcpEmployee.name);
      } else {
        // Second try: maybe we got a profile ID (UUID format)
        console.log("Employee not found by HCP ID, trying profile ID lookup...");
        const { data: linkedEmployee } = await supabase
          .from("hcp_employees")
          .select("hcp_employee_id, name")
          .eq("linked_user_id", technicianHcpId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        
        if (linkedEmployee) {
          employeeId = linkedEmployee.hcp_employee_id;
          console.log("Found employee via linked profile:", employeeId, linkedEmployee.name);
        } else {
          // Third try: maybe we got the name directly
          console.log("Trying name-based lookup...");
          const { data: namedEmployee } = await supabase
            .from("hcp_employees")
            .select("hcp_employee_id, name")
            .eq("organization_id", organizationId)
            .ilike("name", `%${technicianHcpId}%`)
            .maybeSingle();
          
          if (namedEmployee) {
            employeeId = namedEmployee.hcp_employee_id;
            console.log("Found employee by name search:", employeeId, namedEmployee.name);
          }
        }
      }
    }
    
    if (!employeeId && technicianHcpId) {
      console.warn("Could not find HCP employee for:", technicianHcpId);
      // List available employees for debugging
      const { data: allEmployees } = await supabase
        .from("hcp_employees")
        .select("hcp_employee_id, name")
        .eq("organization_id", organizationId)
        .limit(10);
      console.log("Available employees:", allEmployees?.map(e => ({ id: e.hcp_employee_id, name: e.name })));
    }

    // Step 4: Create the job
    const scheduledStart = `${scheduledDate}T${scheduledTime}:00`;
    
    // Calculate end time
    const startDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    const endHours = endDate.getHours().toString().padStart(2, "0");
    const endMinutes = endDate.getMinutes().toString().padStart(2, "0");
    const scheduledEnd = `${scheduledDate}T${endHours}:${endMinutes}:00`;

    // Build line items array with pricing from price book if available
    const lineItems: Array<{ name: string; description?: string; quantity: number; unit_price?: number }> = [];
    if (serviceType) {
      // Look up price from local database
      const serviceNames = serviceType.split(',').map(s => s.trim());
      for (const serviceName of serviceNames) {
        const { data: serviceData } = await supabase
          .from("hcp_services")
          .select("name, price")
          .eq("organization_id", organizationId)
          .ilike("name", serviceName)
          .maybeSingle();
        
        lineItems.push({
          name: serviceName,
          description: serviceName,
          quantity: 1,
          unit_price: serviceData?.price ? Math.round(serviceData.price * 100) : undefined, // HCP expects cents
        });
      }
      
      // If no services were found, add a generic line item
      if (lineItems.length === 0) {
        lineItems.push({
          name: serviceType,
          description: serviceType,
          quantity: 1,
        });
      }
    }

    const jobPayload: Record<string, any> = {
      customer_id: customerId,
      schedule: {
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      },
      address: {
        street: address,
        city: city,
        state: state,
        zip: zip || "",
      },
      // Include line items directly in job creation
      line_items: lineItems,
      // Set as draft/unscheduled
      work_status: "scheduled",
    };

    if (notes) {
      jobPayload.notes = notes;
    }

    if (employeeId) {
      jobPayload.assigned_employee_ids = [employeeId];
    }

    console.log("Creating job payload:", JSON.stringify(jobPayload, null, 2));
    console.log("Service Item ID for price book:", serviceItemId);
    console.log("Employee ID for assignment:", employeeId);

    const createJobResponse = await fetch(`${hcpBaseUrl}/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Token ${hcpApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jobPayload),
    });

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text();
      console.error("Failed to create job:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create job: ${errorText}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newJob = await createJobResponse.json();
    console.log("Created job:", newJob.id, "with", newJob.line_items?.length || 0, "line items");

    // Step 5: If we have a price book service item, add it as a proper line item
    if (serviceItemId && newJob.id) {
      const lineItemPayload = {
        line_items: [
          {
            service_item_id: serviceItemId,
            quantity: 1,
          },
        ],
      };

      console.log("Adding price book line item:", JSON.stringify(lineItemPayload));

      const lineItemResponse = await fetch(`${hcpBaseUrl}/jobs/${newJob.id}/line_items`, {
        method: "POST",
        headers: {
          Authorization: `Token ${hcpApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(lineItemPayload),
      });

      if (!lineItemResponse.ok) {
        console.warn("Failed to add price book line item:", await lineItemResponse.text());
      } else {
        console.log("Added price book line item to job");
      }
    }

    // Step 6: Store in local database for tracking
    const { error: insertError } = await supabase.from("hcp_jobs").upsert({
      organization_id: organizationId,
      hcp_job_id: newJob.id,
      customer_name: customerName,
      customer_hcp_id: customerId,
      address: address,
      city: city,
      state: state,
      zip: zip,
      lat: coordinates?.lat || null,
      lng: coordinates?.lng || null,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      scheduled_end: `${endHours}:${endMinutes}`,
      status: "scheduled",
      technician_hcp_id: employeeId,
      services: serviceType ? [{ name: serviceType }] : [],
      notes: notes,
      synced_at: new Date().toISOString(),
    }, {
      onConflict: 'hcp_job_id,organization_id'
    });

    if (insertError) {
      console.warn("Failed to store job locally:", insertError);
    }

    // Build HCP job URL
    const hcpJobUrl = `https://pro.housecallpro.com/pro/jobs/${newJob.id}`;

    const response: CreateJobResponse = {
      success: true,
      jobId: newJob.id,
      hcpJobId: newJob.id,
      hcpJobUrl: hcpJobUrl,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in create-hcp-job:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
