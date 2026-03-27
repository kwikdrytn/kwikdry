import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    const supabase = createClient(supabaseUrl, serviceKey);

    const { organization_id, events } = await req.json();

    if (!organization_id || !events?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!fcmServerKey) {
      console.log('FCM_SERVER_KEY not set, skipping push notifications');
      return new Response(JSON.stringify({ success: true, sent: 0, reason: 'no_fcm_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get admin profiles with FCM tokens
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, fcm_token, first_name')
      .eq('organization_id', organization_id)
      .eq('role', 'admin')
      .eq('is_active', true)
      .not('fcm_token', 'is', null);

    // Also get push subscriptions for admins
    const adminIds = (admins || []).map(a => a.id);
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, fcm_token')
      .in('user_id', adminIds)
      .eq('is_active', true);

    // Collect unique tokens
    const tokens = new Set<string>();
    (admins || []).forEach(a => { if (a.fcm_token) tokens.add(a.fcm_token); });
    (subscriptions || []).forEach(s => { if (s.fcm_token) tokens.add(s.fcm_token); });

    if (tokens.size === 0) {
      console.log('No admin FCM tokens found');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build notification body
    const summary = events.map((e: any) => {
      switch (e.change_type) {
        case 'cancelled': return `❌ ${e.customer_name || 'Job'} cancelled`;
        case 'rescheduled': return `📅 ${e.customer_name || 'Job'} rescheduled`;
        case 'reassigned': return `👤 ${e.customer_name || 'Job'} reassigned`;
        default: return `${e.customer_name || 'Job'} changed`;
      }
    }).slice(0, 3).join('\n');

    const title = events.length === 1
      ? 'Job Change Detected'
      : `${events.length} Job Changes Detected`;

    // Determine click action - single event opens HCP directly, multiple opens activity feed
    const clickAction = events.length === 1 && events[0].hcp_job_id
      ? `https://pro.housecallpro.com/pro/jobs/${events[0].hcp_job_id}`
      : '/activity';

    let sent = 0;
    for (const token of tokens) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body: summary },
            data: { click_action: clickAction, type: 'job_change' },
          }),
        });
        if (res.ok) sent++;
      } catch (err) {
        console.log('FCM send error:', err);
      }
    }

    // Log notifications
    for (const adminId of adminIds) {
      await supabase.from('notification_log').insert({
        user_id: adminId,
        type: 'job_change',
        title,
        body: summary,
        click_action: clickAction,
        delivered: sent > 0,
      });
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Notification error:', error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
