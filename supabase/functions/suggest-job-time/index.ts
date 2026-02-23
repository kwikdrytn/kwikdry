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
  serviceName?: string; // legacy single service
  serviceNames?: string[]; // multiple services
  estimateDuration?: boolean; // whether to estimate duration from history
}

interface TechnicianSkill {
  id: string;
  service_type: string;
  skill_level: string;
  notes: string | null;
}

interface TechnicianNote {
  id: string;
  note_type: string;
  note: string;
  is_active: boolean;
}

interface TechnicianWithLocation {
  id: string;
  name: string;
  home_lat: number;
  home_lng: number;
  address: string;
  distanceFromJob?: number;
  drivingDistanceMiles?: number;
  drivingDurationMinutes?: number;
  skills?: TechnicianSkill[];
  notes?: TechnicianNote[];
}

// Service type display mapping
const SERVICE_TYPE_LABELS: Record<string, string> = {
  'carpet_cleaning': 'Carpet Cleaning',
  'upholstery_cleaning': 'Upholstery Cleaning',
  'air_duct_cleaning': 'Air Duct/HVAC Cleaning',
  'tile_grout_cleaning': 'Tile & Grout Cleaning',
  'dryer_vent_cleaning': 'Dryer Vent Cleaning',
  'mattress_cleaning': 'Mattress Cleaning',
  'wood_floor_cleaning': 'Wood Floor Cleaning',
};

function formatServiceType(serviceType: string): string {
  return SERVICE_TYPE_LABELS[serviceType] || serviceType;
}

// Build skills and notes context for a technician
function buildTechnicianSkillsContext(tech: TechnicianWithLocation): string {
  let context = '';
  
  const skills = tech.skills || [];
  if (skills.length > 0) {
    const preferred = skills.filter(s => s.skill_level === 'preferred');
    const avoid = skills.filter(s => s.skill_level === 'avoid');
    const never = skills.filter(s => s.skill_level === 'never');
    
    if (preferred.length > 0) {
      context += `  PREFERRED: ${preferred.map(s => formatServiceType(s.service_type)).join(', ')}\n`;
    }
    if (avoid.length > 0) {
      context += `  AVOID: ${avoid.map(s => formatServiceType(s.service_type)).join(', ')}\n`;
    }
    if (never.length > 0) {
      context += `  NEVER ASSIGN: ${never.map(s => formatServiceType(s.service_type)).join(', ')}\n`;
    }
  }
  
  const notes = tech.notes || [];
  if (notes.length > 0) {
    context += `  Notes: ${notes.map(n => `[${n.note_type.toUpperCase()}] ${n.note}`).join('; ')}\n`;
  }
  
  return context;
}

// Fetch driving distance from Mapbox Directions API
async function getDrivingDistance(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  mapboxToken: string
): Promise<{ distanceMiles: number; durationMinutes: number } | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${mapboxToken}&overview=false`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("Mapbox API error:", response.status);
      return null;
    }
    
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distanceMiles: route.distance / 1609.34, // meters to miles
        durationMinutes: route.duration / 60, // seconds to minutes
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching driving distance:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const MAPBOX_TOKEN = Deno.env.get("VITE_MAPBOX_TOKEN");
    if (!MAPBOX_TOKEN) {
      console.warn("VITE_MAPBOX_TOKEN not configured, driving distances will not be available");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: authProfile } = await userClient
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    if (!authProfile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = authProfile.organization_id;

    const requestData: JobSuggestionRequest = await req.json();
    const {
      address,
      coordinates,
      jobDurationMinutes,
      preferredDays,
      preferredTimeStart,
      preferredTimeEnd,
      restrictions,
      serviceName,
      serviceNames,
      estimateDuration,
    } = requestData;

    // Combine legacy serviceName with new serviceNames array
    const allServices: string[] = [];
    if (serviceNames && serviceNames.length > 0) {
      allServices.push(...serviceNames);
    } else if (serviceName) {
      allServices.push(serviceName);
    }

    console.log("Analyzing job scheduling for:", address, "Services:", allServices);

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

    // Estimate duration from historical job data if requested
    let estimatedDurationMinutes: number | null = null;
    if (estimateDuration && allServices.length > 0) {
      console.log("Estimating duration from historical data for services:", allServices);
      
      // Fetch completed jobs with matching services to estimate duration
      const { data: historicalJobs, error: histError } = await supabase
        .from("hcp_jobs")
        .select("services, scheduled_time, scheduled_end")
        .eq("organization_id", organizationId)
        .not("scheduled_time", "is", null)
        .not("scheduled_end", "is", null)
        .limit(500);
      
      if (!histError && historicalJobs) {
        const matchingDurations: number[] = [];
        
        for (const job of historicalJobs) {
          const jobServices = job.services as { name?: string }[] | null;
          if (!jobServices || !job.scheduled_time || !job.scheduled_end) continue;
          
          // Check if any of the selected services match this job
          const jobServiceNames = jobServices.map(s => s.name?.toLowerCase() || '');
          const hasMatch = allServices.some(selectedService => 
            jobServiceNames.some(jobService => 
              jobService.includes(selectedService.toLowerCase()) ||
              selectedService.toLowerCase().includes(jobService)
            )
          );
          
          if (hasMatch) {
            // Calculate duration from start to end time
            const startParts = job.scheduled_time.split(':');
            const endParts = job.scheduled_end.split(':');
            if (startParts.length >= 2 && endParts.length >= 2) {
              const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
              const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
              const duration = endMinutes - startMinutes;
              if (duration > 0 && duration < 720) { // Sanity check: < 12 hours
                matchingDurations.push(duration);
              }
            }
          }
        }
        
        if (matchingDurations.length >= 3) {
          // Calculate average, weighted towards median to avoid outliers
          matchingDurations.sort((a, b) => a - b);
          const median = matchingDurations[Math.floor(matchingDurations.length / 2)];
          const avg = matchingDurations.reduce((a, b) => a + b, 0) / matchingDurations.length;
          estimatedDurationMinutes = Math.round((median + avg) / 2);
          
          // Multiply by number of services if selecting multiple
          if (allServices.length > 1) {
            // Add 50% for each additional service (not full time, assuming some overlap)
            estimatedDurationMinutes = Math.round(estimatedDurationMinutes * (1 + (allServices.length - 1) * 0.5));
          }
          
          console.log(`Estimated duration from ${matchingDurations.length} matching jobs: ${estimatedDurationMinutes} min`);
        } else {
          console.log("Not enough matching historical jobs for duration estimation");
        }
      }
    }

    // Fetch service zones
    const { data: serviceZones, error: zonesError } = await supabase
      .from("hcp_service_zones")
      .select("id, name, color, polygon_geojson")
      .eq("organization_id", organizationId);

    if (zonesError) {
      console.error("Error fetching zones:", zonesError);
    }

    // Fetch technicians with home locations, skills, and notes
    const { data: technicians, error: techError } = await supabase
      .from("profiles")
      .select(`
        id, first_name, last_name, home_lat, home_lng, address, city, state, zip,
        technician_skills(id, service_type, skill_level, notes),
        technician_notes(id, note_type, note, is_active)
      `)
      .eq("organization_id", organizationId)
      .eq("role", "technician")
      .eq("is_active", true)
      .is("deleted_at", null)
      .not("home_lat", "is", null)
      .not("home_lng", "is", null);

    if (techError) {
      console.error("Error fetching technicians:", techError);
    }

    // Process technicians with straight-line distances first
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
        skills: tech.technician_skills || [],
        notes: (tech.technician_notes || []).filter((n: any) => n.is_active),
      };
    }).sort((a, b) => (a.distanceFromJob || 999) - (b.distanceFromJob || 999));

    // Fetch driving distances for top technicians (limit to avoid rate limits)
    if (MAPBOX_TOKEN && techsWithDistance.length > 0) {
      console.log("Fetching driving distances for technicians...");
      const drivingPromises = techsWithDistance.slice(0, 5).map(async (tech) => {
        const driving = await getDrivingDistance(
          tech.home_lng,
          tech.home_lat,
          coordinates.lng,
          coordinates.lat,
          MAPBOX_TOKEN
        );
        if (driving) {
          tech.drivingDistanceMiles = driving.distanceMiles;
          tech.drivingDurationMinutes = driving.durationMinutes;
        }
      });
      await Promise.all(drivingPromises);
      
      // Re-sort by driving distance if available
      techsWithDistance.sort((a, b) => {
        const aDist = a.drivingDistanceMiles ?? a.distanceFromJob ?? 999;
        const bDist = b.drivingDistanceMiles ?? b.distanceFromJob ?? 999;
        return aDist - bDist;
      });
    }

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
        const jobDetails = jobs.map((j) => {
          const timeRange = j.scheduled_end 
            ? `${j.scheduled_time || "TBD"}-${j.scheduled_end}` 
            : `${j.scheduled_time || "TBD"}`;
          return `${timeRange} (${j.technician_name || "unassigned"})`;
        }).join(", ");
        return `${dayName} ${date}: ${jobs.length} total jobs, ${nearbyJobs.length} within 15 miles. Schedule: ${jobDetails}`;
      })
      .join("\n");

    const nearbyJobDetails = Object.entries(jobsByZone)
      .slice(0, 7)
      .map(([date, jobs]) => {
        const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
        const jobList = jobs
          .sort((a, b) => a.distanceFromNew - b.distanceFromNew)
          .slice(0, 5)
          .map((j) => {
            const timeRange = j.scheduled_end 
              ? `${j.scheduled_time || "TBD"}-${j.scheduled_end}` 
              : `${j.scheduled_time || "TBD"}`;
            return `  - ${timeRange}: ${j.city || "Unknown"} (${j.distanceFromNew.toFixed(1)} mi away, ${j.technician_name || "unassigned"})`;
          })
          .join("\n");
        return `${dayName} ${date}:\n${jobList}`;
      })
      .join("\n\n");

    // Build technician location context with driving distances AND skills
    const techLocationContext = techsWithDistance.length > 0
      ? `TECHNICIAN HOME LOCATIONS & SKILLS (sorted by distance from job):
${techsWithDistance.slice(0, 5).map((tech) => {
  const drivingInfo = tech.drivingDistanceMiles 
    ? `${tech.drivingDistanceMiles.toFixed(1)} miles / ${Math.round(tech.drivingDurationMinutes || 0)} min drive`
    : `${tech.distanceFromJob?.toFixed(1)} miles (straight-line)`;
  const skillsContext = buildTechnicianSkillsContext(tech);
  return `- ${tech.name}: ${drivingInfo} from job location\n${skillsContext}`;
}).join("\n")}

Consider these technicians for optimal routing - technicians living closer can start the day with this job or end their day here with less travel time.`
      : "No technician home locations available.";

    // Find the closest existing booked job
    let closestJob: { date: string; time: string; distance: number; city: string; techName: string } | null = null;
    for (const job of existingJobs || []) {
      if (job.lat && job.lng) {
        const distance = haversineDistance(coordinates.lat, coordinates.lng, job.lat, job.lng);
        if (!closestJob || distance < closestJob.distance) {
          closestJob = {
            date: job.scheduled_date || "Unknown",
            time: job.scheduled_time || "TBD",
            distance,
            city: job.city || "Unknown",
            techName: job.technician_name || "Unassigned",
          };
        }
      }
    }

    const closestJobContext = closestJob
      ? `CLOSEST EXISTING JOB TO NEW LOCATION:
- Date: ${closestJob.date}
- Time: ${closestJob.time}
- Distance from new job: ${closestJob.distance.toFixed(1)} miles
- Location: ${closestJob.city}
- Assigned technician: ${closestJob.techName}

IMPORTANT: Prioritize scheduling the new job on the SAME DAY and NEAR THE SAME TIME as this closest job to minimize travel. Suggest times immediately before or after this job as the top recommendation.`
      : "No nearby existing jobs found - schedule based on technician availability and home locations.";

const systemPrompt = `You are a job scheduling assistant for Kwik Dry Total Cleaning. Analyze the existing job schedule and suggest optimal times for a new job.

## STANDARD TIME BLOCKS (MANDATORY):
Jobs MUST be scheduled at these start times ONLY:
- **8:00 AM** (Morning block: 8:00 AM - 11:00 AM for 3-hour jobs)
- **11:00 AM** (Midday block: 11:00 AM - 2:00 PM for 3-hour jobs)
- **2:00 PM** (Afternoon block: 2:00 PM - 5:00 PM for 3-hour jobs)

Do NOT adjust start times for drive time. The start time is when the technician arrives at the job.
Do NOT suggest times like 8:30, 9:00, 11:30, etc. Only use 08:00, 11:00, or 14:00.

## DURATION RULES (MANDATORY):
- Use the EXACT duration provided in the job details. Do NOT change or estimate a different duration.
- The end time = start time + exact duration. For example, a 3-hour (180 min) job starting at 08:00 ends at 11:00.
- The timeSlot in your response must reflect the exact duration: "08:00-11:00" for 180 min, "08:00-10:00" for 120 min, etc.

## TECHNICIAN SKILL LEVELS (must follow strictly):
- **PREFERRED**: Prioritize assigning this job type to this technician when possible
- **STANDARD**: Normal assignment, no special preference (default if not specified)
- **AVOID**: Only assign this job type if no other technicians are available
- **NEVER**: Do not assign this job type to this technician under any circumstances

## PRIORITY FACTORS (in order of importance):
1. **RESPECT SKILL RESTRICTIONS**: Never assign a job to a technician with "NEVER" for that service type
2. **USE STANDARD TIME BLOCKS ONLY**: 08:00, 11:00, or 14:00 start times
3. **USE EXACT DURATION**: Calculate end time from start time + provided duration
4. **CLOSEST EXISTING JOB**: Schedule near the closest booked job to minimize travel time
5. **SKILL PREFERENCES**: Prioritize technicians with "PREFERRED" skill level for the service type
6. Cluster jobs geographically - suggest times adjacent to nearby existing appointments
7. Consider technician home locations for first/last appointments of the day
8. Consider scheduling notes for each technician (time preferences, speed, restrictions)
9. **RESPECT END TIMES**: Never suggest a time block that overlaps with an existing job's time window for the same technician
10. Balance workload across days

Respond with a JSON object containing:
{
  "suggestions": [
    {
      "date": "YYYY-MM-DD",
      "dayName": "Monday",
      "timeSlot": "08:00-11:00",
      "reason": "Brief explanation - mention skill match and nearby job this clusters with",
      "confidence": "high" | "medium" | "low",
      "nearbyJobsCount": 3,
      "suggestedTechnician": "Tech name - explain skill match",
      "nearestExistingJob": "Description of the closest job this would cluster with",
      "skillMatch": "preferred" | "standard" | "avoid"
    }
  ],
  "analysis": "Brief overall analysis emphasizing routing efficiency, job clustering, and skill matching",
  "warnings": ["Any potential issues, conflicts, or skill mismatches to flag"]
}

REMEMBER: timeSlot MUST use standard blocks (08:00, 11:00, 14:00) and the end time must equal start time + the exact duration provided. Most jobs are 3 hours (180 minutes).

Provide 3-5 suggestions, ranked by skill match and proximity to existing jobs.`;

    const servicesDisplay = allServices.length > 0 ? allServices.join(", ") : "General service";
    // Always use the user-selected duration as authoritative
    const durationDisplay = jobDurationMinutes;
    
    const userPrompt = `Please suggest the best times to schedule a new job with these details:

NEW JOB DETAILS:
- Address: ${address}
- Service Zone: ${matchingZone?.name || "Unknown zone"}
- Duration: ${durationDisplay} minutes (USE THIS EXACT DURATION - do not change it)
- Service Type(s): ${servicesDisplay}
${preferredDays?.length ? `- Preferred Days: ${preferredDays.join(", ")}` : ""}
${preferredTimeStart ? `- Preferred Time Window: ${preferredTimeStart} to ${preferredTimeEnd || "17:00"}` : ""}
${restrictions ? `- Restrictions/Notes: ${restrictions}` : ""}

${closestJobContext}

${techLocationContext}

EXISTING SCHEDULE OVERVIEW (Next 14 Days):
${jobSummary || "No existing jobs scheduled"}

NEARBY JOBS (within 15 miles):
${nearbyJobDetails || "No nearby jobs found"}

Today's date is ${today.toISOString().split("T")[0]}.

IMPORTANT: Your TOP suggestion should be on the same day as the closest existing job, scheduled immediately before or after it. Prioritize job clustering to minimize drive time between appointments.`;

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

    // Add technician driving distances to the response
    suggestions.technicians = techsWithDistance.slice(0, 5).map((tech) => ({
      name: tech.name,
      drivingDistanceMiles: tech.drivingDistanceMiles,
      drivingDurationMinutes: tech.drivingDurationMinutes,
      straightLineDistance: tech.distanceFromJob,
    }));

    // Add estimated duration if calculated
    if (estimatedDurationMinutes) {
      suggestions.estimatedDurationMinutes = estimatedDurationMinutes;
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
