import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const HCP_BASE_URL = 'https://api.housecallpro.com';

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
      const zoneRecords = serviceZones.map(zone => ({
        organization_id,
        hcp_zone_id: zone.id,
        name: zone.name,
        color: zone.color || null,
        synced_at: now,
      }));

      for (const record of zoneRecords) {
        const { error } = await supabase
          .from('hcp_service_zones')
          .upsert(record, { onConflict: 'organization_id,hcp_zone_id' });
        
        if (!error) zonesSynced++;
      }
    }

    // Upsert jobs
    if (jobs.length > 0) {
      const jobRecords = jobs.map(job => {
        const scheduledStart = job.schedule?.scheduled_start;
        const scheduledEnd = job.schedule?.scheduled_end;
        
        let scheduledDate = null;
        let scheduledTime = null;
        let scheduledEndTime = null;
        
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

        return {
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
          lat: job.location?.lat || null,
          lng: job.location?.lng || null,
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
      });

      for (const record of jobRecords) {
        const { error } = await supabase
          .from('hcp_jobs')
          .upsert(record, { onConflict: 'organization_id,hcp_job_id' });
        
        if (!error) jobsSynced++;
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
