import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const RC_API_BASE = 'https://platform.ringcentral.com';

interface RCCall {
  id: string;
  sessionId: string;
  startTime: string;
  duration: number;
  type: string;
  direction: string;
  action: string;
  result: string;
  from: {
    phoneNumber?: string;
    name?: string;
    extensionNumber?: string;
  };
  to: {
    phoneNumber?: string;
    name?: string;
    extensionNumber?: string;
  };
  recording?: {
    id: string;
    uri: string;
    contentUri: string;
  };
}

interface HCPCustomer {
  id: string;
  hcp_customer_id: string;
  name: string;
  phone_numbers: string[];
}

interface HCPJob {
  id: string;
  hcp_job_id: string;
  customer_hcp_id: string | null;
  customer_name: string | null;
  scheduled_date: string | null;
}

// Normalize phone numbers: remove all non-digit characters
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Handle international format (remove leading 1 for US numbers if 11 digits)
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits.length >= 10 ? digits : null;
}

// Get last 7 digits for partial matching
function getLast7Digits(phone: string): string {
  return phone.slice(-7);
}

// Match call phone number to customer
function matchCustomer(
  phoneNumber: string | null,
  customers: HCPCustomer[]
): { customer: HCPCustomer | null; confidence: 'exact' | 'partial' | 'none' } {
  if (!phoneNumber) return { customer: null, confidence: 'none' };
  
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return { customer: null, confidence: 'none' };
  
  // Try exact match first
  for (const customer of customers) {
    if (!customer.phone_numbers) continue;
    
    for (const custPhone of customer.phone_numbers) {
      if (custPhone === normalized) {
        return { customer, confidence: 'exact' };
      }
    }
  }
  
  // Try partial match (last 7 digits)
  const last7 = getLast7Digits(normalized);
  for (const customer of customers) {
    if (!customer.phone_numbers) continue;
    
    for (const custPhone of customer.phone_numbers) {
      if (getLast7Digits(custPhone) === last7) {
        return { customer, confidence: 'partial' };
      }
    }
  }
  
  return { customer: null, confidence: 'none' };
}

// Find the closest job for a customer within ±7 days of call date
function findLinkedJob(
  customerHcpId: string,
  callDate: Date,
  jobs: HCPJob[]
): HCPJob | null {
  const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  
  const customerJobs = jobs.filter(
    job => job.customer_hcp_id === customerHcpId && job.scheduled_date
  );
  
  if (customerJobs.length === 0) return null;
  
  let closestJob: HCPJob | null = null;
  let closestDistance = Infinity;
  
  for (const job of customerJobs) {
    const jobDate = new Date(job.scheduled_date!);
    const distance = Math.abs(jobDate.getTime() - callDate.getTime());
    
    if (distance <= sevenDays && distance < closestDistance) {
      // Prefer upcoming jobs over past jobs
      const isUpcoming = jobDate >= callDate;
      const adjustedDistance = isUpcoming ? distance : distance + sevenDays;
      
      if (adjustedDistance < closestDistance) {
        closestDistance = adjustedDistance;
        closestJob = job;
      }
    }
  }
  
  return closestJob;
}

// Map RingCentral result to call_status enum
function mapCallStatus(result: string): 'completed' | 'missed' | 'voicemail' | 'rejected' | 'busy' {
  switch (result?.toLowerCase()) {
    case 'call connected':
    case 'accepted':
    case 'completed':
      return 'completed';
    case 'missed':
    case 'no answer':
      return 'missed';
    case 'voicemail':
    case 'voice mail':
      return 'voicemail';
    case 'rejected':
    case 'declined':
      return 'rejected';
    case 'busy':
      return 'busy';
    default:
      return 'completed';
  }
}

// Get access token from refresh token
async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string | null> {
  const tokenUrl = `${RC_API_BASE}/restapi/oauth/token`;
  
  const tokenBody = new URLSearchParams();
  tokenBody.append('grant_type', 'refresh_token');
  tokenBody.append('refresh_token', refreshToken);
  
  const authHeader = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authHeader}`,
    },
    body: tokenBody.toString(),
  });
  
  if (!response.ok) {
    console.error('Failed to refresh token:', response.status);
    return null;
  }
  
  const data = await response.json();
  return data.access_token;
}

// Fetch call log from RingCentral
async function fetchCallLog(
  accessToken: string,
  dateFrom: string,
  dateTo: string
): Promise<RCCall[]> {
  const allCalls: RCCall[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const url = new URL(`${RC_API_BASE}/restapi/v1.0/account/~/call-log`);
    url.searchParams.set('dateFrom', dateFrom);
    url.searchParams.set('dateTo', dateTo);
    url.searchParams.set('perPage', perPage.toString());
    url.searchParams.set('page', page.toString());
    url.searchParams.set('view', 'Detailed');
    
    console.log(`Fetching RC call log page ${page}...`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch call log:', response.status);
      break;
    }
    
    const data = await response.json();
    const calls = data.records || [];
    
    allCalls.push(...calls);
    
    if (calls.length < perPage) break;
    page++;
    
    // Safety limit
    if (page > 20) break;
  }
  
  return allCalls;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
      organization_id, 
      location_id,
      client_id, 
      client_secret, 
      refresh_token,
      hours_back = 24
    } = await req.json();

    if (!organization_id || !client_id || !client_secret || !refresh_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required credentials' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!location_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Location ID is required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting RC call sync for organization: ${organization_id}`);

    // Get access token
    const accessToken = await getAccessToken(client_id, client_secret, refresh_token);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to authenticate with RingCentral. Please re-test connection.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate date range
    const dateTo = new Date();
    const dateFrom = new Date(dateTo.getTime() - hours_back * 60 * 60 * 1000);

    console.log(`Fetching calls from ${dateFrom.toISOString()} to ${dateTo.toISOString()}`);

    // Fetch calls from RingCentral
    const calls = await fetchCallLog(
      accessToken, 
      dateFrom.toISOString(), 
      dateTo.toISOString()
    );

    console.log(`Fetched ${calls.length} calls from RingCentral`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch customers for matching
    const { data: customers } = await supabase
      .from('hcp_customers')
      .select('id, hcp_customer_id, name, phone_numbers')
      .eq('organization_id', organization_id);

    console.log(`Loaded ${customers?.length || 0} customers for matching`);

    // Fetch jobs for linking
    const { data: jobs } = await supabase
      .from('hcp_jobs')
      .select('id, hcp_job_id, customer_hcp_id, customer_name, scheduled_date')
      .eq('organization_id', organization_id);

    console.log(`Loaded ${jobs?.length || 0} jobs for linking`);

    const now = new Date().toISOString();
    let syncedCount = 0;
    let matchedCount = 0;
    let linkedCount = 0;

    // Process each call
    for (const call of calls) {
      // Determine the external phone number (for inbound, it's 'from'; for outbound, it's 'to')
      const isInbound = call.direction?.toLowerCase() === 'inbound';
      const externalPhone = isInbound ? call.from?.phoneNumber : call.to?.phoneNumber;
      
      // Match customer
      const { customer, confidence } = matchCustomer(externalPhone || null, customers || []);
      
      // Find linked job
      let linkedJob: HCPJob | null = null;
      if (customer) {
        matchedCount++;
        const callDate = new Date(call.startTime);
        linkedJob = findLinkedJob(customer.hcp_customer_id, callDate, jobs || []);
        if (linkedJob) linkedCount++;
      }

      // Calculate end time
      const startTime = new Date(call.startTime);
      const endTime = call.duration 
        ? new Date(startTime.getTime() + call.duration * 1000)
        : null;

      const record = {
        organization_id,
        location_id,
        rc_call_id: call.id || call.sessionId,
        direction: isInbound ? 'inbound' : 'outbound',
        from_number: call.from?.phoneNumber || '',
        to_number: call.to?.phoneNumber || '',
        started_at: call.startTime,
        ended_at: endTime?.toISOString() || null,
        duration_seconds: call.duration || null,
        status: mapCallStatus(call.result),
        matched_customer_id: customer?.hcp_customer_id || null,
        matched_customer_name: customer?.name || null,
        matched_customer_phone: normalizePhone(externalPhone),
        match_confidence: confidence,
        linked_job_id: linkedJob?.id || null,
        recording_url: call.recording?.contentUri || null,
        synced_at: now,
      };

      const { error } = await supabase
        .from('call_log')
        .upsert(record, { onConflict: 'rc_call_id' });

      if (!error) {
        syncedCount++;
      } else {
        console.error('Failed to upsert call:', error.message);
      }
    }

    console.log(`Sync complete: ${syncedCount} calls synced, ${matchedCount} matched, ${linkedCount} linked to jobs`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: {
          calls: syncedCount,
          matched: matchedCount,
          linked: linkedCount,
        },
        fetched: calls.length,
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
