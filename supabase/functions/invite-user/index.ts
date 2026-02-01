import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the request is from an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user's token to check permissions
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser } } = await userClient.auth.getUser();
    if (!requestingUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if requesting user is an admin
    const { data: requestingProfile } = await userClient
      .from('profiles')
      .select('role, organization_id')
      .eq('user_id', requestingUser.id)
      .single();

    if (!requestingProfile || requestingProfile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can invite users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { 
      email, 
      first_name, 
      last_name, 
      phone,
      role, 
      custom_role_id,
      location_id,
      address,
      city,
      state,
      zip,
      home_lat,
      home_lng,
    } = await req.json();

    if (!email || !first_name || !last_name) {
      return new Response(JSON.stringify({ error: 'Email, first name, and last name are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User already exists in auth - check if they have a profile in this org
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', existingUser.id)
        .eq('organization_id', requestingProfile.organization_id)
        .single();

      if (existingProfile) {
        return new Response(JSON.stringify({ error: 'User already exists in this organization' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = existingUser.id;
    } else {
      // Create new auth user with invite
      const { data: newUser, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`,
        },
      });

      if (inviteError) {
        console.error('Invite error:', inviteError);
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = newUser.user.id;
    }

    // Create the profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        organization_id: requestingProfile.organization_id,
        first_name,
        last_name,
        email,
        phone: phone || null,
        role: role || 'technician',
        custom_role_id: custom_role_id || null,
        location_id: location_id || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zip: zip || null,
        home_lat: home_lat || null,
        home_lng: home_lng || null,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      profile,
      invited: !existingUser,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
