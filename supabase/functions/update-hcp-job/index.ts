import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UpdateJobRequest {
  organizationId: string;
  hcpJobId: string; // The HCP job ID (not our local UUID)
  scheduledDate?: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:MM
  scheduledEnd?: string; // HH:MM
  technicianHcpId?: string; // HCP employee ID to assign
  status?: string; // work_status value
  notes?: string; // New note to add
  services?: string[]; // Array of service names to set as line items
}

interface UpdateJobResponse {
  success: boolean;
  error?: string;
}

// State abbreviation mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
  california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

function normalizeState(state: string): string {
  if (!state) return "";
  const trimmed = state.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return STATE_ABBREVIATIONS[lower] || trimmed.substring(0, 2).toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: UpdateJobRequest = await req.json();
    const {
      organizationId,
      hcpJobId,
      scheduledDate,
      scheduledTime,
      scheduledEnd,
      technicianHcpId,
      status,
      notes,
      services,
    } = body;

    console.log("Updating HCP job:", hcpJobId, "org:", organizationId);

    // Fetch organization's HCP API key
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("hcp_api_key")
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

    // ── Step 1: Update schedule and/or status via PUT /jobs/{id} ──
    const jobPatchPayload: Record<string, any> = {};
    let hasJobPatch = false;

    if (scheduledDate && scheduledTime) {
      const start = `${scheduledDate}T${scheduledTime}:00`;
      let end: string;
      if (scheduledEnd) {
        end = `${scheduledDate}T${scheduledEnd}:00`;
      } else {
        // Default 1 hour
        const startDate = new Date(`${scheduledDate}T${scheduledTime}:00`);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        const h = endDate.getHours().toString().padStart(2, "0");
        const m = endDate.getMinutes().toString().padStart(2, "0");
        end = `${scheduledDate}T${h}:${m}:00`;
      }
      jobPatchPayload.schedule = {
        scheduled_start: start,
        scheduled_end: end,
      };
      hasJobPatch = true;
    }

    if (status) {
      // Map internal statuses to HCP work_status values
      const statusMap: Record<string, string> = {
        scheduled: "scheduled",
        in_progress: "in progress",
        completed: "completed",
        cancelled: "canceled",
        needs_scheduling: "needs scheduling",
      };
      jobPatchPayload.work_status = statusMap[status] || status;
      hasJobPatch = true;
    }

    if (hasJobPatch) {
      console.log("Patching job:", JSON.stringify(jobPatchPayload));
      const patchResp = await fetch(`${hcpBaseUrl}/jobs/${hcpJobId}`, {
        method: "PUT",
        headers: {
          Authorization: `Token ${hcpApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(jobPatchPayload),
      });

      if (!patchResp.ok) {
        const errText = await patchResp.text();
        console.error("Failed to update job:", patchResp.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `HCP update failed: ${errText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Job schedule/status updated successfully");
    }

    // ── Step 2: Dispatch to technician ──
    if (technicianHcpId) {
      console.log("Dispatching job to technician:", technicianHcpId);
      const dispatchResp = await fetch(`${hcpBaseUrl}/jobs/${hcpJobId}/dispatch`, {
        method: "POST",
        headers: {
          Authorization: `Token ${hcpApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assigned_employee_ids: [technicianHcpId] }),
      });

      if (!dispatchResp.ok) {
        const errText = await dispatchResp.text();
        console.warn("Dispatch failed (non-fatal):", dispatchResp.status, errText);
        // Non-fatal: the schedule/status update already succeeded
      } else {
        console.log("Job dispatched successfully");
      }
    }

    // ── Step 3: Add a note if provided ──
    if (notes && notes.trim()) {
      console.log("Adding note to job");
      // HCP notes endpoint: POST /jobs/{id}/notes  OR use the job update notes field
      // The simplest approach is updating the job with a note
      const noteResp = await fetch(`${hcpBaseUrl}/jobs/${hcpJobId}/notes`, {
        method: "POST",
        headers: {
          Authorization: `Token ${hcpApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: notes.trim() }),
      });

      if (!noteResp.ok) {
        const errText = await noteResp.text();
        console.warn("Adding note failed (non-fatal):", noteResp.status, errText);
      } else {
        console.log("Note added successfully");
      }
    }

    // ── Step 4: Update line items / services ──
    if (services && services.length > 0) {
      console.log("Updating line items. New services:", services);

      // First, get existing line items to remove them
      const existingResp = await fetch(`${hcpBaseUrl}/jobs/${hcpJobId}/line_items`, {
        headers: {
          Authorization: `Token ${hcpApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (existingResp.ok) {
        const existingData = await existingResp.json();
        const existingItems = existingData.line_items || existingData || [];

        // Delete existing line items
        if (Array.isArray(existingItems)) {
          for (const item of existingItems) {
            if (item.id) {
              console.log("Deleting line item:", item.id, item.name);
              await fetch(`${hcpBaseUrl}/jobs/${hcpJobId}/line_items/${item.id}`, {
                method: "DELETE",
                headers: { Authorization: `Token ${hcpApiKey}` },
              });
              await new Promise((r) => setTimeout(r, 300));
            }
          }
        }
      }

      // Add new line items
      for (const serviceName of services) {
        if (!serviceName.trim()) continue;

        // Look up service in hcp_services
        const { data: svcData } = await supabase
          .from("hcp_services")
          .select("hcp_service_id, name, price")
          .eq("organization_id", organizationId)
          .ilike("name", serviceName)
          .maybeSingle();

        const itemPayload: Record<string, any> = {
          name: svcData?.name || serviceName,
          quantity: 1,
        };

        if (svcData?.hcp_service_id) {
          itemPayload.service_item_id = svcData.hcp_service_id;
        }
        if (svcData?.price) {
          itemPayload.unit_price = Math.round(svcData.price * 100);
        }

        console.log("Adding line item:", JSON.stringify(itemPayload));
        const addResp = await fetch(`${hcpBaseUrl}/jobs/${hcpJobId}/line_items`, {
          method: "POST",
          headers: {
            Authorization: `Token ${hcpApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(itemPayload),
        });

        if (!addResp.ok) {
          const errText = await addResp.text();
          console.warn(`Failed to add line item "${serviceName}":`, errText);
        } else {
          console.log(`Added line item: ${serviceName}`);
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // ── Step 5: Update local database record ──
    const localUpdate: Record<string, any> = {
      synced_at: new Date().toISOString(),
    };

    if (scheduledDate) localUpdate.scheduled_date = scheduledDate;
    if (scheduledTime) localUpdate.scheduled_time = scheduledTime;
    if (scheduledEnd) localUpdate.scheduled_end = scheduledEnd;
    if (status) localUpdate.status = status;
    if (technicianHcpId) localUpdate.technician_hcp_id = technicianHcpId;
    if (notes) localUpdate.notes = notes;
    if (services) {
      localUpdate.services = services.map((s) => ({ name: s }));
    }

    // Look up technician name if we have the HCP ID
    if (technicianHcpId) {
      const { data: emp } = await supabase
        .from("hcp_employees")
        .select("name")
        .eq("hcp_employee_id", technicianHcpId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (emp?.name) {
        localUpdate.technician_name = emp.name;
      }
    }

    console.log("Updating local DB:", JSON.stringify(localUpdate));
    const { error: updateError } = await supabase
      .from("hcp_jobs")
      .update(localUpdate)
      .eq("hcp_job_id", hcpJobId)
      .eq("organization_id", organizationId);

    if (updateError) {
      console.warn("Local DB update failed (non-fatal):", updateError);
    }

    console.log("Job update complete");

    return new Response(
      JSON.stringify({ success: true } as UpdateJobResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-hcp-job:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
