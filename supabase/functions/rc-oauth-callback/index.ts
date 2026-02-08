import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const RC_API_BASE = 'https://platform.ringcentral.com';
const REDIRECT_URI = 'https://kwikdry.lovable.app';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  scope: string;
  owner_id: string;
  endpoint_id: string;
}

interface AccountInfo {
  id: string;
  uri: string;
  mainNumber: string;
  operator?: {
    id: string;
    extensionNumber: string;
    name: string;
  };
  serviceInfo?: {
    uri: string;
    brand?: {
      id: string;
      name: string;
    };
  };
  setupWizardState: string;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuthUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseAuthUrl, anonKey, {
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

    if (!authProfile || authProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organization_id = authProfile.organization_id;

    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client credentials from environment
    const clientId = Deno.env.get('RC_CLIENT_ID');
    const clientSecret = Deno.env.get('RC_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing RC_CLIENT_ID or RC_CLIENT_SECRET environment variables');
      return new Response(
        JSON.stringify({ success: false, error: 'RingCentral not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Exchanging authorization code for tokens...');

    // Exchange authorization code for tokens
    const tokenUrl = `${RC_API_BASE}/restapi/oauth/token`;
    
    const tokenBody = new URLSearchParams();
    tokenBody.append('grant_type', 'authorization_code');
    tokenBody.append('code', code);
    tokenBody.append('redirect_uri', REDIRECT_URI);
    
    const authHeader = btoa(`${clientId}:${clientSecret}`);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
      body: tokenBody.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      
      let errorMessage = 'Failed to exchange authorization code';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error_description || errorData.message || errorMessage;
      } catch {
        // Use default error message
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `${errorMessage} (${tokenResponse.status})` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData: TokenResponse = await tokenResponse.json();
    console.log('Got tokens, fetching account info...');

    // Get account info to verify connection and get account details
    const accountResponse = await fetch(`${RC_API_BASE}/restapi/v1.0/account/~`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error('Account info failed:', accountResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ success: false, error: `Failed to get account info (${accountResponse.status})` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountData: AccountInfo = await accountResponse.json();
    console.log('Account info retrieved:', accountData.id, accountData.mainNumber);

    // Store the refresh token in the organization record
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        rc_refresh_token: tokenData.refresh_token,
        rc_account_id: accountData.id,
      })
      .eq('id', organization_id);

    if (updateError) {
      console.error('Failed to save refresh token:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save connection details' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('RingCentral OAuth successful for organization:', organization_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        account_name: accountData.mainNumber || accountData.operator?.name || 'RingCentral Account',
        account_id: accountData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
