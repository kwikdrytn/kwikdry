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
  createAsDraft?: boolean; // Create as "needs scheduling" instead of scheduled
}

interface CreateJobResponse {
  success: boolean;
  jobId?: string;
  hcpJobId?: string;
  hcpJobUrl?: string;
  customerId?: string;
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
      createAsDraft = false, // Default to scheduled if not specified
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

    // Step 2: Look up PriceBook mapping for the service type
    let priceBookItemId: string | null = null;
    let priceBookItemName: string | null = null;
    let mappedDuration = duration;

    // First try to find the mapping in our local pricebook_mapping table
    const { data: mapping } = await supabase
      .from("pricebook_mapping")
      .select("hcp_pricebook_item_id, hcp_pricebook_item_name, default_duration_minutes")
      .eq("organization_id", organizationId)
      .ilike("service_type", serviceType)
      .maybeSingle();

    if (mapping) {
      priceBookItemId = mapping.hcp_pricebook_item_id;
      priceBookItemName = mapping.hcp_pricebook_item_name;
      mappedDuration = mapping.default_duration_minutes || duration;
      console.log("Found PriceBook mapping:", priceBookItemId, priceBookItemName);
    } else {
      // Fallback: Find the service in HCP price book directly by name
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
          priceBookItemId = matchingService.id;
          priceBookItemName = matchingService.name;
          console.log("Found matching PriceBook service:", priceBookItemId, priceBookItemName);
        }
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
    
    // Calculate end time using mapped duration if available
    const effectiveDuration = mappedDuration || duration;
    const startDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
    const endDate = new Date(startDate.getTime() + effectiveDuration * 60 * 1000);
    const endHours = endDate.getHours().toString().padStart(2, "0");
    const endMinutes = endDate.getMinutes().toString().padStart(2, "0");
    const scheduledEnd = `${scheduledDate}T${endHours}:${endMinutes}:00`;

    // Build the job payload
    const jobPayload: Record<string, any> = {
      customer_id: customerId,
      address: {
        street: address,
        city: city,
        state: state,
        zip: zip || "",
      },
    };

    // Set work_status based on createAsDraft flag
    // "needs scheduling" creates an unscheduled/draft job
    // "scheduled" creates a scheduled job
    if (createAsDraft) {
      jobPayload.work_status = "needs scheduling";
      // For draft jobs, we might still want to add schedule info as a suggestion
      if (scheduledDate && scheduledTime) {
        jobPayload.schedule = {
          scheduled_start: scheduledStart,
          scheduled_end: scheduledEnd,
        };
      }
    } else {
      jobPayload.work_status = "scheduled";
      jobPayload.schedule = {
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      };
    }

    // Add notes with AI suggestion tag
    if (notes) {
      jobPayload.notes = `[AI Suggested] ${notes}`;
    } else {
      jobPayload.notes = "[AI Suggested Job]";
    }

    // Assign technician
    if (employeeId) {
      jobPayload.assigned_employee_ids = [employeeId];
    }

    console.log("Creating job payload:", JSON.stringify(jobPayload, null, 2));
    console.log("PriceBook Item ID:", priceBookItemId);
    console.log("PriceBook Item Name:", priceBookItemName);
    console.log("Employee ID for assignment:", employeeId);
    console.log("Create as draft:", createAsDraft);

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
    console.log("Created job:", newJob.id);

    // Step 5: Add line items with PriceBook item (this is the key to getting prices populated)
    // Parse serviceType - it may be comma-separated list of services or a single service
    if (newJob.id && serviceType && serviceType.trim()) {
      // Split by comma and trim each service name, filter out empty strings and generic placeholders
      const serviceNames = serviceType
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && s.toLowerCase() !== "general service");
      
      console.log("Parsed service names:", serviceNames);
      
      // If no valid services after filtering, skip line item creation
      if (serviceNames.length === 0) {
        console.log("No valid service names provided, skipping line items");
      } else {
        // Line items must always include 'name' - HCP API requires it even with service_item_id
        const lineItemsToAdd: Array<{
          service_item_id?: string;
          name: string;  // Required by HCP API
          description?: string;
          quantity: number;
          unit_price?: number;
        }> = [];

        // Look up each service in hcp_services table
        for (const serviceName of serviceNames) {
          // First check pricebook_mapping for this service
          const { data: mapping } = await supabase
            .from("pricebook_mapping")
            .select("hcp_pricebook_item_id, hcp_pricebook_item_name")
            .eq("organization_id", organizationId)
            .ilike("service_type", serviceName)
            .maybeSingle();

          if (mapping?.hcp_pricebook_item_id) {
            lineItemsToAdd.push({
              service_item_id: mapping.hcp_pricebook_item_id,
              name: mapping.hcp_pricebook_item_name || serviceName,  // Always include name
              quantity: 1,
            });
            console.log(`Found PriceBook mapping for "${serviceName}":`, mapping.hcp_pricebook_item_id);
            continue;
          }

          // Then check hcp_services table
          const { data: serviceData } = await supabase
            .from("hcp_services")
            .select("hcp_service_id, name, price")
            .eq("organization_id", organizationId)
            .ilike("name", serviceName)
            .maybeSingle();

          if (serviceData?.hcp_service_id) {
            lineItemsToAdd.push({
              service_item_id: serviceData.hcp_service_id,
              name: serviceData.name,  // Always include name
              quantity: 1,
            });
            console.log(`Found hcp_service for "${serviceName}":`, serviceData.hcp_service_id, serviceData.name);
            continue;
          }

          // Try partial match on name (for cases like "Carpet Cleaning" matching "Carpet Cleaning - Standard")
          const { data: partialMatch } = await supabase
            .from("hcp_services")
            .select("hcp_service_id, name, price")
            .eq("organization_id", organizationId)
            .ilike("name", `%${serviceName}%`)
            .limit(1)
            .maybeSingle();

          if (partialMatch?.hcp_service_id) {
            lineItemsToAdd.push({
              service_item_id: partialMatch.hcp_service_id,
              name: partialMatch.name,  // Always include name
              quantity: 1,
            });
            console.log(`Found partial match for "${serviceName}":`, partialMatch.hcp_service_id, partialMatch.name);
            continue;
          }

          // Ultimate fallback: Add as custom line item by name only
          console.warn(`No HCP service ID found for "${serviceName}", adding by name only`);
          lineItemsToAdd.push({
            name: serviceName,
            description: serviceName,
            quantity: 1,
          });
        }

        if (lineItemsToAdd.length > 0) {
          console.log("Line items to add:", JSON.stringify(lineItemsToAdd, null, 2));

          // HCP API requires line items to be added one at a time
          // The endpoint expects the item fields at the ROOT level, NOT wrapped in an array
          let addedCount = 0;
          const addedItems: string[] = [];
          const failedItems: string[] = [];
          
          for (const item of lineItemsToAdd) {
            // Build the payload - HCP expects fields at ROOT level, not in an array
            // Only include service_item_id if we have one - this links to the price book
            const itemPayload: Record<string, any> = {
              name: item.name,
              quantity: item.quantity || 1,
            };
            
            // If we have a service_item_id, include it to link to price book
            // This is what populates the price automatically
            if (item.service_item_id) {
              itemPayload.service_item_id = item.service_item_id;
            }
            
            console.log(`Adding line item: ${item.name}`, JSON.stringify(itemPayload));
            
            // Try POST with the item at root level (not wrapped in array)
            const lineItemResponse = await fetch(`${hcpBaseUrl}/jobs/${newJob.id}/line_items`, {
              method: "POST",
              headers: {
                Authorization: `Token ${hcpApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(itemPayload),
            });

            if (lineItemResponse.ok) {
              addedCount++;
              addedItems.push(item.name);
              console.log(`Successfully added line item: ${item.name}`);
            } else {
              const errorText = await lineItemResponse.text();
              console.warn(`Failed to add line item "${item.name}" with root-level payload:`, errorText);
              
              // Fallback: Try with array wrapper (some HCP API versions may expect this)
              console.log(`Retrying "${item.name}" with array wrapper...`);
              const arrayPayload = { line_items: [itemPayload] };
              
              const retryResponse = await fetch(`${hcpBaseUrl}/jobs/${newJob.id}/line_items`, {
                method: "POST",
                headers: {
                  Authorization: `Token ${hcpApiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(arrayPayload),
              });
              
              if (retryResponse.ok) {
                addedCount++;
                addedItems.push(item.name + " (array format)");
                console.log(`Added "${item.name}" via array format fallback`);
              } else {
                const retryError = await retryResponse.text();
                console.warn(`Array format also failed for "${item.name}":`, retryError);
                
                // Final fallback: Try without service_item_id (custom line item)
                if (item.service_item_id) {
                  console.log(`Final fallback for "${item.name}" - custom line item without service_item_id...`);
                  const customPayload = {
                    name: item.name,
                    quantity: 1,
                    description: item.name,
                  };
                  
                  const finalResponse = await fetch(`${hcpBaseUrl}/jobs/${newJob.id}/line_items`, {
                    method: "POST",
                    headers: {
                      Authorization: `Token ${hcpApiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(customPayload),
                  });
                  
                  if (finalResponse.ok) {
                    addedCount++;
                    addedItems.push(item.name + " (custom)");
                    console.log(`Added "${item.name}" as custom line item`);
                  } else {
                    const finalError = await finalResponse.text();
                    console.error(`All attempts failed for "${item.name}":`, finalError);
                    failedItems.push(item.name);
                  }
                } else {
                  failedItems.push(item.name);
                }
              }
            }
            
            // Longer delay between requests to avoid rate limiting (500ms)
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          console.log(`Line items result: ${addedCount}/${lineItemsToAdd.length} added successfully`);
          console.log("Added items:", addedItems);
          if (failedItems.length > 0) {
            console.error("Failed items:", failedItems);
          }
        } else {
          console.warn("No line items to add - no matching services found in HCP");
        }
      }
    }

    // Step 6: Store in local database for tracking
    const jobStatus = createAsDraft ? "needs_scheduling" : "scheduled";
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
      status: jobStatus,
      technician_hcp_id: employeeId,
      services: serviceType ? [{ name: serviceType, pricebook_item_id: priceBookItemId }] : [],
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
      customerId: customerId || undefined,
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
