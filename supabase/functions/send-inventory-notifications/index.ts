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
  if (!FCM_SERVER_KEY) throw new Error('FCM_SERVER_KEY not configured');

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
        click_action: '/inventory',
      },
      data: payload.data || {},
      webpush: { fcm_options: { link: '/inventory' } },
    }),
  });

  return await response.json();
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

    if (!['low_stock', 'test'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Use: low_stock or test' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${type} inventory notifications`);

    // Get all organizations
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id');

    if (orgError) throw orgError;

    let totalSent = 0;
    let totalFailed = 0;

    for (const org of orgs || []) {
      // Find items at or below reorder threshold
      const { data: items, error: itemsError } = await supabase
        .from('inventory_items')
        .select('id, name, reorder_threshold, unit')
        .eq('organization_id', org.id)
        .is('deleted_at', null);

      if (itemsError) {
        console.error('Error fetching items for org:', org.id, itemsError);
        continue;
      }

      if (!items || items.length === 0) continue;

      // Get stock totals
      const itemIds = items.map(i => i.id);
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select('item_id, quantity')
        .in('item_id', itemIds)
        .is('deleted_at', null);

      const stockTotals: Record<string, number> = {};
      stockData?.forEach(s => {
        stockTotals[s.item_id] = (stockTotals[s.item_id] || 0) + Number(s.quantity);
      });

      const lowStockItems = items.filter(item => {
        const total = stockTotals[item.id] || 0;
        return total <= item.reorder_threshold;
      });

      if (lowStockItems.length === 0 && type !== 'test') continue;

      // Get admin users with FCM tokens for this org
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, first_name, fcm_token')
        .eq('organization_id', org.id)
        .eq('role', 'admin')
        .eq('is_active', true)
        .is('deleted_at', null)
        .not('fcm_token', 'is', null);

      if (!admins || admins.length === 0) continue;

      const itemNames = lowStockItems.slice(0, 3).map(i => i.name).join(', ');
      const extra = lowStockItems.length > 3 ? ` and ${lowStockItems.length - 3} more` : '';

      const payload: NotificationPayload = {
        title: '📦 Low Stock Alert',
        body: lowStockItems.length === 0
          ? 'All inventory items are stocked. This is a test notification.'
          : `${lowStockItems.length} item${lowStockItems.length !== 1 ? 's' : ''} low: ${itemNames}${extra}`,
        data: {
          type: 'low_stock_alert',
          count: String(lowStockItems.length),
        },
      };

      for (const admin of admins) {
        try {
          await sendFCMNotification(admin.fcm_token!, payload);
          totalSent++;

          await supabase.from('notification_log').insert({
            user_id: admin.id,
            type: 'low_stock_alert',
            title: payload.title,
            body: payload.body,
            data: payload.data,
            delivered: true,
            click_action: '/inventory',
          });
        } catch (error) {
          totalFailed++;
          await supabase.from('notification_log').insert({
            user_id: admin.id,
            type: 'low_stock_alert',
            title: payload.title,
            body: payload.body,
            data: payload.data,
            delivered: false,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            click_action: '/inventory',
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, type, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-inventory-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
