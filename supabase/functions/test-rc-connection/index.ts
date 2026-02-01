import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const RC_API_BASE = 'https://platform.ringcentral.com';

interface RCConnectionResult {
  success: boolean;
  account_name?: string;
  account_id?: string;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { client_id, client_secret, jwt_token } = await req.json();

    if (!jwt_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'JWT token is required for authentication' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Testing RingCentral connection with JWT auth...');

    // Use JWT token to get access token
    const tokenUrl = `${RC_API_BASE}/restapi/oauth/token`;
    
    const tokenBody = new URLSearchParams();
    tokenBody.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    tokenBody.append('assertion', jwt_token);
    
    const authHeader = btoa(`${client_id}:${client_secret}`);
    
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
      
      let errorMessage = 'Authentication failed';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error_description || errorData.message || errorMessage;
      } catch {
        // Use default error message
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `${errorMessage} (${tokenResponse.status})` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('Got access token, fetching account info...');

    // Get account info to verify connection
    const accountResponse = await fetch(`${RC_API_BASE}/restapi/v1.0/account/~`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!accountResponse.ok) {
      const errorText = await accountResponse.text();
      console.error('Account info failed:', accountResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to get account info (${accountResponse.status})` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountData = await accountResponse.json();
    
    console.log('Connection successful:', accountData.mainNumber, accountData.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        account_name: accountData.mainNumber || accountData.operator?.name || 'RingCentral Account',
        account_id: accountData.id,
        refresh_token: tokenData.refresh_token,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Connection test error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
