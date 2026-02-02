import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function sendFCMNotification(fcmToken: string, payload: NotificationPayload) {
  const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
  
  if (!FCM_SERVER_KEY) {
    throw new Error('FCM_SERVER_KEY not configured');
  }

  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Authorization': `key=${FCM_SERVER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icons/icon-192.png',
        click_action: '/checklists',
      },
      data: payload.data || {},
      webpush: {
        fcm_options: {
          link: '/checklists',
        },
      },
    }),
  });

  const result = await response.json();
  console.log('FCM response:', result);
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type } = await req.json();
    
    // Validate type
    if (!['daily', 'weekly', 'test'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid notification type. Use: daily, weekly, or test' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const today = now.toISOString().split('T')[0];

    console.log(`Processing ${type} checklist notifications for ${today}, day ${dayOfWeek}`);

    // Get all active technicians with push subscriptions
    const { data: technicians, error: techError } = await supabase
      .from('profiles')
      .select(`
        id,
        first_name,
        fcm_token,
        organization_id
      `)
      .eq('role', 'technician')
      .eq('is_active', true)
      .is('deleted_at', null)
      .not('fcm_token', 'is', null);

    if (techError) {
      console.error('Error fetching technicians:', techError);
      throw techError;
    }

    console.log(`Found ${technicians?.length || 0} technicians with FCM tokens`);

    if (!technicians || technicians.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No technicians with push tokens found', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notificationsSent = 0;
    let notificationsFailed = 0;

    for (const tech of technicians) {
      // Check if technician has already submitted today's checklist
      let hasSubmitted = false;

      if (type === 'daily') {
        const { data: submission } = await supabase
          .from('checklist_submissions')
          .select(`
            id,
            checklist_templates!inner(frequency)
          `)
          .eq('technician_id', tech.id)
          .eq('period_date', today)
          .eq('checklist_templates.frequency', 'daily')
          .maybeSingle();

        hasSubmitted = !!submission;
      } else if (type === 'weekly') {
        // For weekly, check if they submitted this week (week starts Monday)
        const startOfWeek = new Date(now);
        const daysSinceMonday = (dayOfWeek + 6) % 7;
        startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
        const weekStart = startOfWeek.toISOString().split('T')[0];

        const { data: submission } = await supabase
          .from('checklist_submissions')
          .select(`
            id,
            checklist_templates!inner(frequency)
          `)
          .eq('technician_id', tech.id)
          .gte('period_date', weekStart)
          .lte('period_date', today)
          .eq('checklist_templates.frequency', 'weekly')
          .maybeSingle();

        hasSubmitted = !!submission;
      }

      // Skip if already submitted (unless it's a test)
      if (hasSubmitted && type !== 'test') {
        console.log(`Technician ${tech.first_name} already submitted ${type} checklist, skipping`);
        continue;
      }

      // Send notification
      const payload: NotificationPayload = {
        title: type === 'weekly' 
          ? '📋 Weekly Checklist Due' 
          : '📋 Daily Checklist Reminder',
        body: type === 'weekly'
          ? `Hey ${tech.first_name || 'there'}! Your weekly checklist is due today.`
          : `Hey ${tech.first_name || 'there'}! Don't forget to complete your daily checklist.`,
        data: {
          type: `${type}_checklist_reminder`,
          date: today,
        },
      };

      try {
        await sendFCMNotification(tech.fcm_token!, payload);
        notificationsSent++;

        // Log the notification
        await supabase.from('notification_log').insert({
          user_id: tech.id,
          type: `${type}_checklist_reminder`,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          delivered: true,
          click_action: '/checklists',
        });

        console.log(`Sent ${type} notification to ${tech.first_name}`);
      } catch (error) {
        notificationsFailed++;
        console.error(`Failed to send notification to ${tech.first_name}:`, error);

        // Log failed notification
        await supabase.from('notification_log').insert({
          user_id: tech.id,
          type: `${type}_checklist_reminder`,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          delivered: false,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          click_action: '/checklists',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        type,
        date: today,
        sent: notificationsSent,
        failed: notificationsFailed,
        total_technicians: technicians.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-checklist-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
