import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const HCP_BASE_URL = 'https://api.housecallpro.com';

const MAPBOX_GEOCODE_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

interface HCPJob {
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
    country?: string;
  };
  schedule?: {
    scheduled_start?: string;
    scheduled_end?: string;
  };
  work_status?: string;
  total_amount?: number;
  invoice_number?: string;
  lead_source?: string;
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

interface HCPCustomer {
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

interface HCPServiceZone {
  id: string;
  name: string;
  color?: string;
  polygon?: {
    type?: string;
    coordinates?: number[][][];
  };
  boundary?: Array<{ lat: number; lng: number }>;
  vertices?: Array<{ lat: number; lng: number }>;
  // HCP zones can be defined by zip codes or cities
  zip_codes?: string[];
  postal_codes?: string[];
  cities?: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function coerceNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractLatLngFromJob(job: unknown): { lat: number; lng: number } | null {
  const j = job as Record<string, any>;

  const candidates: Array<{ lat: unknown; lng: unknown }> = [
    // Common shapes
    { lat: j?.location?.lat, lng: j?.location?.lng },
    { lat: j?.location?.latitude, lng: j?.location?.longitude },
    { lat: j?.coordinates?.lat, lng: j?.coordinates?.lng },
    { lat: j?.coordinates?.latitude, lng: j?.coordinates?.longitude },
    { lat: j?.address?.lat, lng: j?.address?.lng },
    { lat: j?.address?.latitude, lng: j?.address?.longitude },
  ];

  for (const c of candidates) {
    const lat = coerceNumber(c.lat);
    const lng = coerceNumber(c.lng);
    if (lat !== null && lng !== null) return { lat, lng };
  }

  return null;
}

async function geocodeAddress(
  address: string,
  mapboxToken: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `${MAPBOX_GEOCODE_BASE_URL}/${encodeURIComponent(address)}.json?access_token=${encodeURIComponent(mapboxToken)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log('Mapbox geocode failed:', res.status, address);
    return null;
  }
  const data = await res.json();
  const center = data?.features?.[0]?.center;
  if (!Array.isArray(center) || center.length < 2) return null;
  const lng = coerceNumber(center[0]);
  const lat = coerceNumber(center[1]);
  if (lat === null || lng === null) return null;
  return { lat, lng };
}

// Convert HCP zone boundary to GeoJSON Polygon format
function convertToGeoJSON(zone: HCPServiceZone): object | null {
  // Check for already GeoJSON format
  if (zone.polygon?.type === 'Polygon' && zone.polygon?.coordinates) {
    return zone.polygon;
  }
  
  // Convert boundary array to GeoJSON
  const points = zone.boundary || zone.vertices;
  if (!points || points.length < 3) return null;
  
  // GeoJSON format: [[[lng, lat], [lng, lat], ...]]
  const coordinates = points.map(p => [p.lng, p.lat]);
  // Close the polygon by repeating the first point
  if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
    coordinates.push(coordinates[0]);
  }
  
  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
}

// Fetch zip code bounding box from Mapbox geocoding API
async function fetchZipCodeBounds(
  zipCode: string,
  mapboxToken: string
): Promise<{ center: [number, number]; bbox: [number, number, number, number] } | null> {
  try {
    // Search for the zip code with postcode type filter
    const url = `${MAPBOX_GEOCODE_BASE_URL}/${encodeURIComponent(zipCode)}.json?access_token=${encodeURIComponent(mapboxToken)}&types=postcode&country=us&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Mapbox geocode failed for zip ${zipCode}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const feature = data?.features?.[0];
    
    if (!feature) {
      console.log(`No results for zip ${zipCode}`);
      return null;
    }
    
    const center = feature.center as [number, number];
    // Mapbox returns bbox as [minLng, minLat, maxLng, maxLat]
    const bbox = feature.bbox as [number, number, number, number] | undefined;
    
    if (!center || center.length < 2) return null;
    
    // If bbox is available, use it; otherwise create approximate bounds from center
    if (bbox && bbox.length === 4) {
      return { center, bbox };
    }
    
    // Create approximate bounds (roughly 5km radius for a zip code)
    const radius = 0.05; // ~5km in degrees at mid-latitudes
    return {
      center,
      bbox: [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius]
    };
  } catch (error) {
    console.log(`Error fetching bounds for zip ${zipCode}:`, error);
    return null;
  }
}

// Create polygon corners from bounding box
function bboxToPolygonPoints(bbox: [number, number, number, number]): number[][] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return [
    [minLng, minLat], // SW
    [maxLng, minLat], // SE
    [maxLng, maxLat], // NE
    [minLng, maxLat], // NW
  ];
}

// Calculate convex hull using Graham scan algorithm
function convexHull(points: number[][]): number[][] {
  if (points.length < 3) return points;
  
  // Remove duplicates
  const unique = points.filter((p, i, arr) => 
    arr.findIndex(q => Math.abs(q[0] - p[0]) < 0.0001 && Math.abs(q[1] - p[1]) < 0.0001) === i
  );
  
  if (unique.length < 3) return unique;
  
  // Find the point with lowest y (and leftmost if tie)
  let start = 0;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i][1] < unique[start][1] || 
        (unique[i][1] === unique[start][1] && unique[i][0] < unique[start][0])) {
      start = i;
    }
  }
  
  // Swap start point to beginning
  [unique[0], unique[start]] = [unique[start], unique[0]];
  const pivot = unique[0];
  
  // Sort by polar angle with pivot
  const sorted = unique.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a[1] - pivot[1], a[0] - pivot[0]);
    const angleB = Math.atan2(b[1] - pivot[1], b[0] - pivot[0]);
    if (Math.abs(angleA - angleB) > 0.0001) return angleA - angleB;
    // If same angle, closer point first
    const distA = (a[0] - pivot[0]) ** 2 + (a[1] - pivot[1]) ** 2;
    const distB = (b[0] - pivot[0]) ** 2 + (b[1] - pivot[1]) ** 2;
    return distA - distB;
  });
  
  // Cross product to determine turn direction
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  
  const hull: number[][] = [pivot];
  for (const point of sorted) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  // Close the polygon
  if (hull.length >= 3) {
    hull.push([...hull[0]]);
  }
  
  return hull;
}

// Merge multiple zip code bounds into a single zone polygon using Mapbox geocoding
async function buildZonePolygonFromZipCodes(
  zipCodes: string[],
  mapboxToken: string
): Promise<object | null> {
  if (!zipCodes || zipCodes.length === 0 || !mapboxToken) return null;
  
  console.log(`Building polygon for ${zipCodes.length} zip codes using Mapbox...`);
  
  // Fetch bounds for each zip code (limit to 25 to avoid rate limits)
  const zipCodesToFetch = zipCodes.slice(0, 25);
  const boundsPromises = zipCodesToFetch.map(zip => fetchZipCodeBounds(zip.trim(), mapboxToken));
  const boundsResults = await Promise.all(boundsPromises);
  
  // Collect all corner points from bounding boxes
  const allPoints: number[][] = [];
  let successCount = 0;
  
  for (const result of boundsResults) {
    if (result) {
      const corners = bboxToPolygonPoints(result.bbox);
      allPoints.push(...corners);
      successCount++;
    }
  }
  
  console.log(`Got bounds for ${successCount}/${zipCodesToFetch.length} zip codes`);
  
  if (allPoints.length < 3) {
    console.log('Not enough points to build polygon');
    return null;
  }
  
  // Create convex hull of all bounding box corners
  const hull = convexHull(allPoints);
  
  if (hull.length < 4) {
    console.log('Convex hull too small');
    return null;
  }
  
  console.log(`Built zone polygon with ${hull.length} vertices`);
  
  return {
    type: 'Polygon',
    coordinates: [hull]
  };
}

interface HCPEmployee {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
}

// Normalize phone numbers: remove all non-digit characters
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

// Extract all phone numbers from a customer
function extractPhoneNumbers(customer: HCPCustomer): string[] {
  const phones: string[] = [];
  
  const mobile = normalizePhone(customer.mobile_number);
  if (mobile) phones.push(mobile);
  
  const home = normalizePhone(customer.home_number);
  if (home && !phones.includes(home)) phones.push(home);
  
  const work = normalizePhone(customer.work_number);
  if (work && !phones.includes(work)) phones.push(work);
  
  return phones;
}

// Fetch with retry and rate limit handling
async function fetchWithRetry(
  url: string, 
  apiKey: string, 
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        console.log(`Rate limited, waiting ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API credentials');
        }
        if (response.status === 403) {
          throw new Error('Access denied. Check API key permissions.');
        }
        throw new Error(`API error: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Failed after retries');
}

// Fetch all jobs with pagination
async function fetchJobs(
  apiKey: string, 
  dateFrom: string, 
  dateTo: string
): Promise<HCPJob[]> {
  const allJobs: HCPJob[] = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    const url = `${HCP_BASE_URL}/jobs?page=${page}&page_size=${pageSize}&scheduled_start_min=${dateFrom}&scheduled_start_max=${dateTo}`;
    console.log(`Fetching jobs page ${page}...`);
    
    const response = await fetchWithRetry(url, apiKey);
    const data = await response.json();
    
    const jobs = data.jobs || data.data || [];
    if (jobs.length === 0) break;
    
    allJobs.push(...jobs);
    
    // Check if there are more pages
    if (jobs.length < pageSize) break;
    page++;
    
    // Prevent infinite loops
    if (page > 100) break;
  }
  
  return allJobs;
}

// Fetch all customers with pagination
async function fetchCustomers(apiKey: string): Promise<HCPCustomer[]> {
  const allCustomers: HCPCustomer[] = [];
  let page = 1;
  const pageSize = 100;
  
  while (true) {
    const url = `${HCP_BASE_URL}/customers?page=${page}&page_size=${pageSize}`;
    console.log(`Fetching customers page ${page}...`);
    
    const response = await fetchWithRetry(url, apiKey);
    const data = await response.json();
    
    const customers = data.customers || data.data || [];
    if (customers.length === 0) break;
    
    allCustomers.push(...customers);
    
    if (customers.length < pageSize) break;
    page++;
    
    if (page > 100) break;
  }
  
  return allCustomers;
}

// Fetch service zones
async function fetchServiceZones(apiKey: string): Promise<HCPServiceZone[]> {
  const url = `${HCP_BASE_URL}/service_zones`;
  console.log('Fetching service zones...');
  
  try {
    const response = await fetchWithRetry(url, apiKey);
    const data = await response.json();
    return data.service_zones || data.data || [];
  } catch (error) {
    console.log('Service zones endpoint not available:', error);
    return [];
  }
}

// Fetch employees
async function fetchEmployees(apiKey: string): Promise<HCPEmployee[]> {
  const url = `${HCP_BASE_URL}/employees`;
  console.log('Fetching employees...');
  
  try {
    const response = await fetchWithRetry(url, apiKey);
    const data = await response.json();
    return data.employees || data.data || [];
  } catch (error) {
    console.log('Employees endpoint not available:', error);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { organization_id, api_key, location_id } = await req.json();

    if (!organization_id || !api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Organization ID and API key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting HCP sync for organization: ${organization_id}`);

    // Calculate date range (next 30 days)
    const today = new Date();
    const dateFrom = today.toISOString().split('T')[0];
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 30);
    const dateTo = futureDate.toISOString().split('T')[0];

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch data from HCP
    console.log('Fetching jobs from HCP...');
    const jobs = await fetchJobs(api_key, dateFrom, dateTo);
    console.log(`Fetched ${jobs.length} jobs`);

    console.log('Fetching customers from HCP...');
    const customers = await fetchCustomers(api_key);
    console.log(`Fetched ${customers.length} customers`);

    console.log('Fetching employees from HCP...');
    const employees = await fetchEmployees(api_key);
    console.log(`Fetched ${employees.length} employees`);

    console.log('Fetching service zones from HCP...');
    const serviceZones = await fetchServiceZones(api_key);
    console.log(`Fetched ${serviceZones.length} service zones`);

    const now = new Date().toISOString();
    let jobsSynced = 0;
    let customersSynced = 0;
    let employeesSynced = 0;
    let zonesSynced = 0;

    // Upsert employees
    if (employees.length > 0) {
      const employeeRecords = employees.map(emp => ({
        organization_id,
        hcp_employee_id: emp.id,
        name: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Unknown',
        email: emp.email || null,
        phone: normalizePhone(emp.mobile_number),
        synced_at: now,
      }));

      for (const record of employeeRecords) {
        const { error } = await supabase
          .from('hcp_employees')
          .upsert(record, { onConflict: 'organization_id,hcp_employee_id' });
        
        if (!error) employeesSynced++;
      }
    }

    // Upsert customers
    if (customers.length > 0) {
      const customerRecords = customers.map(cust => {
        const primaryAddress = cust.addresses?.[0];
        const name = cust.company || [cust.first_name, cust.last_name].filter(Boolean).join(' ') || 'Unknown';
        
        return {
          organization_id,
          hcp_customer_id: cust.id,
          name,
          email: cust.email || null,
          phone_numbers: extractPhoneNumbers(cust),
          address: primaryAddress?.street || null,
          city: primaryAddress?.city || null,
          state: primaryAddress?.state || null,
          zip: primaryAddress?.zip || null,
          synced_at: now,
        };
      });

      for (const record of customerRecords) {
        const { error } = await supabase
          .from('hcp_customers')
          .upsert(record, { onConflict: 'organization_id,hcp_customer_id' });
        
        if (!error) customersSynced++;
      }
    }

    // Upsert service zones
    if (serviceZones.length > 0) {
      console.log('Processing service zones for polygon generation...');
      
      for (const zone of serviceZones) {
        // First try to get polygon from HCP directly
        let polygonGeoJson = convertToGeoJSON(zone);
        
        // If no polygon from HCP, try to build from zip codes
        if (!polygonGeoJson) {
          const zipCodes = zone.zip_codes || zone.postal_codes || [];
          if (zipCodes.length > 0) {
            const mapboxToken = Deno.env.get('VITE_MAPBOX_TOKEN') || '';
            console.log(`Zone "${zone.name}" has ${zipCodes.length} zip codes, building polygon...`);
            polygonGeoJson = await buildZonePolygonFromZipCodes(zipCodes, mapboxToken);
          } else {
            console.log(`Zone "${zone.name}" has no zip codes or polygon data`);
          }
        }
        
        const record = {
          organization_id,
          hcp_zone_id: zone.id,
          name: zone.name,
          color: zone.color || null,
          polygon_geojson: polygonGeoJson,
          synced_at: now,
        };
        
        const { error } = await supabase
          .from('hcp_service_zones')
          .upsert(record, { onConflict: 'organization_id,hcp_zone_id' });
        
        if (!error) zonesSynced++;
      }
    }

    // Upsert jobs
    if (jobs.length > 0) {
      const mapboxToken = Deno.env.get('VITE_MAPBOX_TOKEN') || '';
      const geocodeCache = new Map<string, { lat: number; lng: number }>();
      let geocodedCount = 0;
      const GEOCODE_LIMIT = 75; // safety cap per sync

      for (const job of jobs) {
        const scheduledStart = job.schedule?.scheduled_start;
        const scheduledEnd = job.schedule?.scheduled_end;

        let scheduledDate: string | null = null;
        let scheduledTime: string | null = null;
        let scheduledEndTime: string | null = null;

        if (scheduledStart) {
          const startDate = new Date(scheduledStart);
          scheduledDate = startDate.toISOString().split('T')[0];
          scheduledTime = startDate.toTimeString().substring(0, 8);
        }

        if (scheduledEnd) {
          const endDate = new Date(scheduledEnd);
          scheduledEndTime = endDate.toTimeString().substring(0, 8);
        }

        const assignedEmployee = job.assigned_employees?.[0];
        const services = job.line_items?.map(item => ({
          name: item.name,
          description: item.description,
          price: item.unit_price,
          quantity: item.quantity,
        })) || [];

        const extracted = extractLatLngFromJob(job);
        let lat: number | null = extracted?.lat ?? null;
        let lng: number | null = extracted?.lng ?? null;

        const addressParts = [job.address?.street, job.address?.city, job.address?.state, job.address?.zip]
          .filter(Boolean)
          .join(', ');

        if ((lat === null || lng === null) && mapboxToken && addressParts && geocodedCount < GEOCODE_LIMIT) {
          const cached = geocodeCache.get(addressParts);
          if (cached) {
            lat = cached.lat;
            lng = cached.lng;
          } else {
            const geocoded = await geocodeAddress(addressParts, mapboxToken);
            if (geocoded) {
              lat = geocoded.lat;
              lng = geocoded.lng;
              geocodeCache.set(addressParts, geocoded);
              geocodedCount++;
            }
          }
        }

        const record = {
          organization_id,
          location_id: location_id || null,
          hcp_job_id: job.id,
          customer_hcp_id: job.customer?.id || null,
          customer_name: job.customer ?
            [job.customer.first_name, job.customer.last_name].filter(Boolean).join(' ') ||
            job.customer.company || 'Unknown' : null,
          address: job.address?.street || null,
          city: job.address?.city || null,
          state: job.address?.state || null,
          zip: job.address?.zip || null,
          lat,
          lng,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          scheduled_end: scheduledEndTime,
          technician_hcp_id: assignedEmployee?.id || null,
          technician_name: assignedEmployee ?
            [assignedEmployee.first_name, assignedEmployee.last_name].filter(Boolean).join(' ') : null,
          status: job.work_status || null,
          total_amount: job.total_amount || null,
          services,
          synced_at: now,
        };

        const { error } = await supabase
          .from('hcp_jobs')
          .upsert(record, { onConflict: 'organization_id,hcp_job_id' });
        
        if (!error) jobsSynced++;
      }

      if (geocodedCount > 0) {
        console.log(`Geocoded ${geocodedCount} jobs missing coordinates via Mapbox`);
      }
    }

    console.log(`Sync complete: ${jobsSynced} jobs, ${customersSynced} customers, ${employeesSynced} employees, ${zonesSynced} zones`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: {
          jobs: jobsSynced,
          customers: customersSynced,
          employees: employeesSynced,
          serviceZones: zonesSynced,
        },
        fetched: {
          jobs: jobs.length,
          customers: customers.length,
          employees: employees.length,
          serviceZones: serviceZones.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
