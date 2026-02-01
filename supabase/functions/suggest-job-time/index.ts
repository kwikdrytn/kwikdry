import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface JobSuggestionRequest {
  organizationId: string;
  address: string;
  coordinates: { lng: number; lat: number };
  jobDurationMinutes: number;
  preferredDays?: string[]; // e.g., ['monday', 'tuesday']
  preferredTimeStart?: string; // e.g., '09:00'
  preferredTimeEnd?: string; // e.g., '17:00'
  restrictions?: string; // free text restrictions
  serviceName?: string;
}

interface TechnicianWithLocation {
  id: string;
  name: string;
  home_lat: number;
  home_lng: number;
  address: string;
  distanceFromJob?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: JobSuggestionRequest = await req.json();
    const {
      organizationId,
      address,
      coordinates,
      jobDurationMinutes,
      preferredDays,
      preferredTimeStart,
      preferredTimeEnd,
      restrictions,
      serviceName,
    } = requestData;

    console.log("Analyzing job scheduling for:", address);

    // Fetch existing jobs for the next 14 days
    const today = new Date();
    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

    const { data: existingJobs, error: jobsError } = await supabase
      .from("hcp_jobs")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("scheduled_date", today.toISOString().split("T")[0])
      .lte("scheduled_date", twoWeeksOut.toISOString().split("T")[0])
      .order("scheduled_date")
      .order("scheduled_time");

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      throw new Error("Failed to fetch existing jobs");
    }

    // Fetch service zones
    const { data: serviceZones, error: zonesError } = await supabase
      .from("hcp_service_zones")
      .select("id, name, color, polygon_geojson")
      .eq("organization_id", organizationId);

    if (zonesError) {
      console.error("Error fetching zones:", zonesError);
    }

    // Fetch technicians with home locations
    const { data: technicians, error: techError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, home_lat, home_lng, address, city, state, zip")
      .eq("organization_id", organizationId)
      .eq("role", "technician")
      .eq("is_active", true)
      .is("deleted_at", null)
      .not("home_lat", "is", null)
      .not("home_lng", "is", null);

    if (techError) {
      console.error("Error fetching technicians:", techError);
    }

    // Process technicians with distances
    const techsWithDistance: TechnicianWithLocation[] = (technicians || []).map((tech) => {
      const name = `${tech.first_name || ""} ${tech.last_name || ""}`.trim() || "Unknown";
      const techAddress = [tech.address, tech.city, tech.state, tech.zip].filter(Boolean).join(", ");
      const distance = haversineDistance(
        coordinates.lat,
        coordinates.lng,
        tech.home_lat,
        tech.home_lng
      );
      return {
        id: tech.id,
        name,
        home_lat: tech.home_lat,
        home_lng: tech.home_lng,
        address: techAddress,
        distanceFromJob: distance,
      };
    }).sort((a, b) => (a.distanceFromJob || 999) - (b.distanceFromJob || 999));

    // Determine which zone the new address is in (simple point-in-polygon check)
    let matchingZone = null;
    if (serviceZones && coordinates) {
      for (const zone of serviceZones) {
        if (zone.polygon_geojson?.coordinates?.[0]) {
          if (isPointInPolygon(coordinates, zone.polygon_geojson.coordinates[0])) {
            matchingZone = zone;
            break;
          }
        }
      }
    }

    // Group jobs by date and analyze patterns
    const jobsByDate: Record<string, any[]> = {};
    const jobsByZone: Record<string, any[]> = {};
    
    (existingJobs || []).forEach((job) => {
      if (job.scheduled_date) {
        if (!jobsByDate[job.scheduled_date]) {
          jobsByDate[job.scheduled_date] = [];
        }
        jobsByDate[job.scheduled_date].push(job);
      }

      // Group by proximity to new location
      if (job.lat && job.lng) {
        const distance = haversineDistance(
          coordinates.lat,
          coordinates.lng,
          job.lat,
          job.lng
        );
        if (distance < 10) { // Within 10 miles
          const date = job.scheduled_date || "unknown";
          if (!jobsByZone[date]) {
            jobsByZone[date] = [];
          }
          jobsByZone[date].push({ ...job, distanceFromNew: distance });
        }
      }
    });

    // Build context for AI
    const jobSummary = Object.entries(jobsByDate)
      .map(([date, jobs]) => {
        const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const nearbyJobs = jobs.filter((j) => {
          if (!j.lat || !j.lng) return false;
          return haversineDistance(coordinates.lat, coordinates.lng, j.lat, j.lng) < 15;
        });
        return `${dayName} ${date}: ${jobs.length} total jobs, ${nearbyJobs.length} within 15 miles of target location`;
      })
      .join("\n");

    const nearbyJobDetails = Object.entries(jobsByZone)
      .slice(0, 7)
      .map(([date, jobs]) => {
        const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const jobList = jobs
          .sort((a, b) => a.distanceFromNew - b.distanceFromNew)
          .slice(0, 5)
          .map((j) => `  - ${j.scheduled_time || "TBD"}: ${j.city || "Unknown"} (${j.distanceFromNew.toFixed(1)} mi away, ${j.technician_name || "unassigned"})`)
          .join("\n");
        return `${dayName} ${date}:\n${jobList}`;
      })
      .join("\n\n");

    // Build technician location context
    const techLocationContext = techsWithDistance.length > 0
      ? `TECHNICIAN HOME LOCATIONS (sorted by distance from job):
${techsWithDistance.slice(0, 5).map((tech) => 
  `- ${tech.name}: ${tech.distanceFromJob?.toFixed(1)} miles from job location (${tech.address})`
).join("\n")}

Consider these technicians for optimal routing - technicians living closer can start the day with this job or end their day here with less travel time.`
      : "No technician home locations available.";

    const systemPrompt = `You are a job scheduling assistant for a service company. Analyze the existing job schedule and suggest optimal times for a new job.

Consider these factors:
1. Minimize drive time by clustering jobs in similar areas
2. IMPORTANT: Consider technician home locations when suggesting times - jobs closer to a tech's home are ideal for first or last appointments of the day
3. Avoid scheduling conflicts
4. Balance workload across days
5. Honor time preferences and restrictions
6. Consider typical service windows (morning, midday, afternoon)

Respond with a JSON object containing:
{
  "suggestions": [
    {
      "date": "YYYY-MM-DD",
      "dayName": "Monday",
      "timeSlot": "09:00-11:00",
      "reason": "Brief explanation including which technician might be best suited based on home location",
      "confidence": "high" | "medium" | "low",
      "nearbyJobsCount": 3,
      "suggestedTechnician": "Tech name if applicable"
    }
  ],
  "analysis": "Brief overall analysis of the scheduling situation including technician routing efficiency",
  "warnings": ["Any potential issues or conflicts"]
}

Provide 3-5 suggestions, ranked by suitability.`;

    const userPrompt = `Please suggest the best times to schedule a new job with these details:

NEW JOB DETAILS:
- Address: ${address}
- Service Zone: ${matchingZone?.name || "Unknown zone"}
- Estimated Duration: ${jobDurationMinutes} minutes
- Service Type: ${serviceName || "General service"}
${preferredDays?.length ? `- Preferred Days: ${preferredDays.join(", ")}` : ""}
${preferredTimeStart ? `- Preferred Time Window: ${preferredTimeStart} to ${preferredTimeEnd || "17:00"}` : ""}
${restrictions ? `- Restrictions/Notes: ${restrictions}` : ""}

${techLocationContext}

EXISTING SCHEDULE OVERVIEW (Next 14 Days):
${jobSummary || "No existing jobs scheduled"}

NEARBY JOBS (within 15 miles):
${nearbyJobDetails || "No nearby jobs found"}

Today's date is ${today.toISOString().split("T")[0]}.

Analyze this data and suggest the optimal times to book this job. When making suggestions, factor in technician home locations for routing efficiency - suggest techs who live nearby for first or last appointments of the day.`;

    console.log("Calling Lovable AI for scheduling suggestions...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse JSON from AI response
    let suggestions;
    try {
      // Extract JSON from response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      suggestions = {
        suggestions: [],
        analysis: content,
        warnings: ["Could not parse structured suggestions"],
      };
    }

    console.log("Generated suggestions:", suggestions);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in suggest-job-time:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Haversine distance in miles
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Ray-casting algorithm for point-in-polygon
function isPointInPolygon(point: { lng: number; lat: number }, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];

    if (yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
