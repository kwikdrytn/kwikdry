import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Get organization name for email
    const { data: orgData } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', requestingProfile.organization_id)
      .single();

    const organizationName = orgData?.name || 'KwikDry';

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
    let wasInvited = false;

    if (existingUser) {
      // User already exists in auth - check if they have an ACTIVE profile in this org
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, deleted_at, is_active')
        .eq('user_id', existingUser.id)
        .eq('organization_id', requestingProfile.organization_id)
        .single();

      if (existingProfile) {
        // If profile was soft-deleted, reactivate it instead of creating new
        if (existingProfile.deleted_at !== null || existingProfile.is_active === false) {
          const { error: reactivateError } = await supabaseAdmin
            .from('profiles')
            .update({
              first_name,
              last_name,
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
              deleted_at: null,
            })
            .eq('id', existingProfile.id);

          if (reactivateError) {
            console.error('Reactivate error:', reactivateError);
            return new Response(JSON.stringify({ error: reactivateError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Send reactivation email
          const appUrl = 'https://kwikdry.lovable.app';
          try {
            await resend.emails.send({
              from: 'KwikDry <notifications@kwikdrydealer.com>',
              to: [email],
              subject: `Welcome back to ${organizationName}`,
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome Back to ${organizationName}!</h1>
                  </div>
                  
                  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p style="font-size: 16px; margin-bottom: 20px;">
                      Hi <strong>${first_name}</strong>,
                    </p>
                    
                    <p style="font-size: 16px; margin-bottom: 20px;">
                      Your account has been reactivated on the <strong>${organizationName}</strong> team.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${appUrl}/auth" 
                         style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); 
                                color: white; 
                                padding: 14px 32px; 
                                text-decoration: none; 
                                border-radius: 8px; 
                                font-weight: 600; 
                                font-size: 16px;
                                display: inline-block;
                                box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);">
                        Sign In
                      </a>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                    
                    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                      ${organizationName} · Field Operations Management
                    </p>
                  </div>
                </body>
                </html>
              `,
            });
            console.log('Reactivation email sent to:', email);
          } catch (emailErr) {
            console.error('Failed to send reactivation email:', emailErr);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            profile: { id: existingProfile.id },
            reactivated: true,
            emailSent: true,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Profile is active - truly a duplicate
        return new Response(JSON.stringify({ error: 'User already exists in this organization' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = existingUser.id;
    } else {
      // Create new auth user with invite and generate the confirmation link
      const { data: linkData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          data: {
            first_name,
            last_name,
            full_name: `${first_name} ${last_name}`,
          },
          redirectTo: 'https://kwikdry.lovable.app/reset-password',
        },
      });

      if (inviteError || !linkData) {
        console.error('Invite error:', inviteError);
        return new Response(JSON.stringify({ error: inviteError?.message || 'Failed to generate invite link' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = linkData.user.id;
      wasInvited = true;

      // Build the confirmation URL that Supabase will process
      // The hashed_token from generateLink is used with the verify endpoint
      const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=invite&redirect_to=https://kwikdry.lovable.app/reset-password`;

      // Send custom invitation email via Resend with the actual confirmation link
      try {
        const { error: emailError } = await resend.emails.send({
          from: 'KwikDry <notifications@kwikdrydealer.com>',
          to: [email],
          subject: `You've been invited to join ${organizationName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${organizationName}!</h1>
              </div>
              
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; margin-bottom: 20px;">
                  Hi <strong>${first_name}</strong>,
                </p>
                
                <p style="font-size: 16px; margin-bottom: 20px;">
                  You've been invited to join the <strong>${organizationName}</strong> team on our Field Operations Management platform.
                </p>
                
                <p style="font-size: 16px; margin-bottom: 25px;">
                  Click the button below to set up your password and access your account:
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${confirmationUrl}" 
                     style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); 
                            color: white; 
                            padding: 14px 32px; 
                            text-decoration: none; 
                            border-radius: 8px; 
                            font-weight: 600; 
                            font-size: 16px;
                            display: inline-block;
                            box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);">
                    Set Up Your Password
                  </a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                  ${organizationName} · Field Operations Management
                </p>
              </div>
            </body>
            </html>
          `,
        });

        if (emailError) {
          console.error('Resend email error:', emailError);
        } else {
          console.log('Invitation email sent successfully to:', email);
        }
      } catch (emailErr) {
        console.error('Failed to send email via Resend:', emailErr);
      }
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
      invited: wasInvited,
      emailSent: wasInvited,
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
