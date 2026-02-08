import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Generate the password reset link using admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://kwikdry.lovable.app/reset-password',
      },
    });

    if (linkError) {
      console.error('Generate link error:', linkError);
      // Don't reveal whether the email exists - always show success
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract the hashed token from the generated link
    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      console.error('No action link generated');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the user's name for personalization
    const firstName = linkData?.user?.user_metadata?.first_name || 
                      linkData?.user?.user_metadata?.full_name?.split(' ')[0] || 
                      'there';

    // Send branded email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'KwikDry <notifications@kwikdrydealer.com>',
      to: [email],
      subject: 'Reset Your Password - KwikDry',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1f36; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f0f1f5;">
          <div style="padding: 20px;">
            <!-- Header with gradient -->
            <div style="background: linear-gradient(135deg, #35479e 0%, #50b849 100%); padding: 32px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">
                KwikDry
              </h1>
              <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; font-weight: 500;">
                Dealership Management
              </p>
            </div>
            
            <!-- Body -->
            <div style="background: #ffffff; padding: 36px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1a1f36; margin: 0 0 20px; font-size: 22px; font-weight: 700;">
                Reset Your Password
              </h2>
              
              <p style="font-size: 15px; margin-bottom: 16px; color: #4a5568;">
                Hi <strong>${firstName}</strong>,
              </p>
              
              <p style="font-size: 15px; margin-bottom: 24px; color: #4a5568;">
                We received a request to reset your password. Click the button below to choose a new password:
              </p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${actionLink}" 
                   style="background: linear-gradient(135deg, #35479e 0%, #2d3d8a 100%); 
                          color: white; 
                          padding: 14px 36px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          font-weight: 600; 
                          font-size: 15px;
                          display: inline-block;
                          box-shadow: 0 4px 12px rgba(53, 71, 158, 0.3);">
                  Reset Password
                </a>
              </div>

              <p style="font-size: 13px; color: #718096; margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
              </p>
              
              <p style="font-size: 12px; color: #a0aec0; margin-top: 16px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${actionLink}" style="color: #35479e; word-break: break-all; font-size: 11px;">${actionLink}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 28px 0;">
              
              <p style="font-size: 11px; color: #a0aec0; text-align: center; margin: 0;">
                KwikDry · Field Operations Management
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('Resend email error:', emailError);
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Password reset email sent to:', email);

    return new Response(JSON.stringify({ success: true }), {
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
