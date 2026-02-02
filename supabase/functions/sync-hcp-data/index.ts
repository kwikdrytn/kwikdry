import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const HCP_BASE_URL = 'https://api.housecallpro.com';

const MAPBOX_GEOCODE_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
const CENSUS_API_BASE = 'https://api.censusreporter.org/1.0/geo/tiger2023';

interface HCPJobNote {
  id?: string;
  content?: string;
}

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
  notes?: string | HCPJobNote[];
  description?: string;
  work_order_notes?: string;
  assigned_employees?: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
  }>;
  line_items?: Array<{
    name?: string;
    description?: string;
    unit_price?: number;
    price?: number;
    quantity?: number;
  }>;
  total_items?: Array<{
    name?: string;
    description?: string;
    unit_price?: number;
    price?: number;
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

// Fetch precise ZCTA polygon from Census Reporter API
async function fetchZipCodePolygon(zipCode: string): Promise<object | null> {
  try {
    const url = `${CENSUS_API_BASE}/86000US${zipCode}?geom=true`;
    console.log(`Fetching ZCTA polygon for ${zipCode}...`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Census API failed for zip ${zipCode}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const geometry = data?.geometry;
    
    if (!geometry || !geometry.coordinates) {
      console.log(`No geometry returned for zip ${zipCode}`);
      return null;
    }
    
    console.log(`Got ${geometry.type} for zip ${zipCode}`);
    return geometry;
  } catch (error) {
    console.log(`Error fetching ZCTA for ${zipCode}:`, error);
    return null;
  }
}

// Merge multiple zip code polygons into a single MultiPolygon
async function buildZonePolygonFromZipCodes(zipCodes: string[]): Promise<object | null> {
  if (!zipCodes || zipCodes.length === 0) return null;
  
  console.log(`Building precise polygon for ${zipCodes.length} zip codes using Census ZCTA data...`);
  
  const geometries: object[] = [];
  
  // Limit to 25 zip codes and add delay to respect rate limits
  const zipCodesToFetch = zipCodes.slice(0, 25);
  
  for (const zip of zipCodesToFetch) {
    const geometry = await fetchZipCodePolygon(zip.trim());
    if (geometry) {
      geometries.push(geometry);
    }
    // Small delay to be respectful of the API
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`Successfully fetched ${geometries.length}/${zipCodesToFetch.length} zip code boundaries`);
  
  if (geometries.length === 0) {
    console.log('No geometries retrieved, cannot build zone polygon');
    return null;
  }
  
  // Merge all polygons into a single MultiPolygon
  const allCoordinates: number[][][][] = [];
  
  for (const geom of geometries) {
    const g = geom as { type: string; coordinates: number[][][] | number[][][][] };
    if (g.type === 'Polygon') {
      allCoordinates.push(g.coordinates as number[][][]);
    } else if (g.type === 'MultiPolygon') {
      allCoordinates.push(...(g.coordinates as number[][][][]));
    }
  }
  
  if (allCoordinates.length === 0) {
    console.log('No valid coordinates to merge');
    return null;
  }
  
  console.log(`Built MultiPolygon with ${allCoordinates.length} polygon parts`);
  
  return {
    type: 'MultiPolygon',
    coordinates: allCoordinates
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

interface HCPService {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  unit_price?: number;
  active?: boolean;
  is_active?: boolean;
}

// Fetch products/services catalog from HCP Pricebook API
async function fetchServices(apiKey: string): Promise<HCPService[]> {
  const allServices: HCPService[] = [];
  const pageSize = 100;
  
  // Try the pricebook endpoints - HCP uses /pricebook/services and /pricebook/materials
  const pricebookEndpoints = [
    { path: 'pricebook/services', key: 'services' },
    { path: 'pricebook/materials', key: 'materials' },
    { path: 'pricebook', key: 'items' },
  ];
  
  for (const endpoint of pricebookEndpoints) {
    let page = 1;
    try {
      const url = `${HCP_BASE_URL}/${endpoint.path}?page=1&page_size=${pageSize}`;
      console.log(`Trying ${endpoint.path} endpoint...`);
      
      const response = await fetchWithRetry(url, apiKey);
      const data = await response.json();
      
      // Try different response shapes
      const items = data[endpoint.key] || data.data || data.items || data.services || data.materials || [];
      if (items.length > 0) {
        console.log(`Found ${items.length} items from ${endpoint.path} endpoint`);
        allServices.push(...items);
        
        // Paginate if needed
        let currentItems = items;
        while (currentItems.length === pageSize && page < 20) {
          page++;
          const nextUrl = `${HCP_BASE_URL}/${endpoint.path}?page=${page}&page_size=${pageSize}`;
          console.log(`Fetching ${endpoint.path} page ${page}...`);
          const nextResponse = await fetchWithRetry(nextUrl, apiKey);
          const nextData = await nextResponse.json();
          currentItems = nextData[endpoint.key] || nextData.data || nextData.items || nextData.services || nextData.materials || [];
          if (currentItems.length === 0) break;
          allServices.push(...currentItems);
        }
        
        console.log(`Total items from ${endpoint.path}: ${allServices.length}`);
      }
    } catch (error) {
      console.log(`${endpoint.path} endpoint not available:`, error);
    }
  }
  
  // Fallback to legacy endpoints if pricebook didn't work
  if (allServices.length === 0) {
    console.log('Pricebook endpoints failed, trying legacy endpoints...');
    const legacyEndpoints = ['products', 'services', 'price_book', 'price_book_items', 'line_items'];
    
    for (const endpoint of legacyEndpoints) {
      let page = 1;
      try {
        const url = `${HCP_BASE_URL}/${endpoint}?page=1&page_size=${pageSize}`;
        console.log(`Trying legacy ${endpoint} endpoint...`);
        
        const response = await fetchWithRetry(url, apiKey);
        const data = await response.json();
        
        const items = data[endpoint] || data.data || data.items || [];
        if (items.length > 0) {
          console.log(`Found ${items.length} items from ${endpoint} endpoint`);
          allServices.push(...items);
          
          // Paginate if needed
          let currentItems = items;
          while (currentItems.length === pageSize && page < 20) {
            page++;
            const nextUrl = `${HCP_BASE_URL}/${endpoint}?page=${page}&page_size=${pageSize}`;
            const nextResponse = await fetchWithRetry(nextUrl, apiKey);
            const nextData = await nextResponse.json();
            currentItems = nextData[endpoint] || nextData.data || nextData.items || [];
            if (currentItems.length === 0) break;
            allServices.push(...currentItems);
          }
          
          break; // Found working endpoint
        }
      } catch (error) {
        console.log(`${endpoint} endpoint not available:`, error);
      }
    }
  }
  
  return allServices;
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

    console.log('Fetching services/products from HCP...');
    const services = await fetchServices(api_key);
    console.log(`Fetched ${services.length} services/products`);

    console.log('Fetching service zones from HCP...');
    const serviceZones = await fetchServiceZones(api_key);
    console.log(`Fetched ${serviceZones.length} service zones`);

    const now = new Date().toISOString();
    let jobsSynced = 0;
    let customersSynced = 0;
    let employeesSynced = 0;
    let servicesSynced = 0;
    let zonesSynced = 0;

    // Upsert services/products
    if (services.length > 0) {
      for (const service of services) {
        const record = {
          organization_id,
          hcp_service_id: service.id,
          name: service.name || 'Unknown Service',
          description: service.description || null,
          price: service.price || service.unit_price || null,
          is_active: service.active ?? service.is_active ?? true,
          synced_at: now,
        };
        
        const { error } = await supabase
          .from('hcp_services')
          .upsert(record, { onConflict: 'organization_id,hcp_service_id' });
        
        if (!error) servicesSynced++;
      }
      console.log(`Synced ${servicesSynced} services`);
    }

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
            console.log(`Zone "${zone.name}" has ${zipCodes.length} zip codes, building polygon...`);
            polygonGeoJson = await buildZonePolygonFromZipCodes(zipCodes);
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
        
        // Prefer total_items if available, fall back to line_items
        const lineItemsSource = job.total_items || job.line_items || [];
        const services = lineItemsSource.map(item => ({
          name: item.name,
          description: item.description,
          price: item.unit_price || item.price,
          quantity: item.quantity,
        }));

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

        // Handle notes - can be string, array of {id, content}, or other fields
        let jobNotes: string | object | null = null;
        
        if (job.notes) {
          if (Array.isArray(job.notes)) {
            // Notes is an array of {id, content} objects - store as JSON
            jobNotes = job.notes;
          } else if (typeof job.notes === 'string') {
            // Combine with other string note fields
            const noteFields = [job.notes, job.description, job.work_order_notes]
              .filter(n => typeof n === 'string' && n.trim().length > 0)
              .map(n => (n as string).trim());
            jobNotes = noteFields.length > 0 ? noteFields.join('\n\n') : null;
          }
        } else {
          // No main notes, check other fields
          const noteFields = [job.description, job.work_order_notes]
            .filter(n => typeof n === 'string' && n.trim().length > 0)
            .map(n => (n as string).trim());
          jobNotes = noteFields.length > 0 ? noteFields.join('\n\n') : null;
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
          notes: jobNotes,
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

    console.log(`Sync complete: ${jobsSynced} jobs, ${customersSynced} customers, ${employeesSynced} employees, ${servicesSynced} services, ${zonesSynced} zones`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: {
          jobs: jobsSynced,
          customers: customersSynced,
          employees: employeesSynced,
          services: servicesSynced,
          serviceZones: zonesSynced,
        },
        fetched: {
          jobs: jobs.length,
          customers: customers.length,
          employees: employees.length,
          services: services.length,
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
