import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client with service role key to bypass RLS policies securely on the server
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const { title, message, targetStaffIds, targetCustomerId, include_player_ids, url } = body;
    const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_API_KEY;

    if (!appId || !apiKey) {
      console.error('Backend sendPush - ERROR: OneSignal App ID or API Key not configured');
      return res.status(500).json({ error: 'OneSignal App ID or API Key not configured' });
    }

    const finalPlayerIds = [];

    // 1. If explicit player IDs are provided by the client, include them
    if (include_player_ids && Array.isArray(include_player_ids)) {
      finalPlayerIds.push(...include_player_ids);
    }

    // 2. Query staff onesignal_ids on the server side (bypassing RLS with service_role key)
    let hasStaffTarget = true;
    
    // If only targetCustomerId is explicitly provided without staff targets, skip staff queries
    if (targetCustomerId && targetStaffIds === undefined) {
      hasStaffTarget = false;
    }
    // If targetStaffIds is explicitly set to empty array, skip staff queries
    if (Array.isArray(targetStaffIds) && targetStaffIds.length === 0) {
      hasStaffTarget = false;
    }

    if (hasStaffTarget) {
      let staffQuery = supabase.from('staff').select('onesignal_id').not('onesignal_id', 'is', null);
      
      if (targetStaffIds === 'member_only') {
        staffQuery = staffQuery.in('role', ['member', 'admin']);
      } else if (Array.isArray(targetStaffIds) && targetStaffIds.length > 0) {
        staffQuery = staffQuery.in('id', targetStaffIds);
      }

      const { data: staffData } = await staffQuery;
      if (staffData) {
        finalPlayerIds.push(...staffData.map(s => s.onesignal_id).filter(Boolean));
      }
    }

    // 3. Query customer onesignal_ids on the server side (bypassing RLS with service_role key)
    if (targetCustomerId) {
      const { data: custData } = await supabase
        .from('customers')
        .select('onesignal_id')
        .eq('id', targetCustomerId)
        .not('onesignal_id', 'is', null);

      if (custData) {
        finalPlayerIds.push(...custData.map(c => c.onesignal_id).filter(Boolean));
      }
    }

    const uniquePlayerIds = Array.from(new Set(finalPlayerIds));
    console.log('Backend sendPush - Target Staff Filter:', targetStaffIds);
    console.log('Backend sendPush - Target Customer Filter:', targetCustomerId);
    console.log('Backend sendPush - Final Target subscription/player IDs:', uniquePlayerIds);

    if (uniquePlayerIds.length === 0) {
      console.warn('Backend sendPush - Cancelled. No valid recipient push IDs found in database.');
      return res.status(200).json({ success: true, message: 'No target users found in database', targetIdsCount: 0 });
    }

    // OneSignal REST API Call
    // support both legacy include_player_ids and modern include_subscription_ids for wide compatibility
    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        include_subscription_ids: uniquePlayerIds,
        include_player_ids: uniquePlayerIds,
        headings: { en: title, ko: title },
        contents: { en: message, ko: message },
        target_channel: "push",
        ...(url && { url })
      })
    });

    const data = await response.json();
    console.log('Backend sendPush - OneSignal REST API response status:', response.status, 'data:', data);
    return res.status(200).json({ success: true, data, targetIdsCount: uniquePlayerIds.length });
  } catch (error) {
    console.error('Fatal Error sending push notification:', error);
    return res.status(500).json({ error: 'Failed to send notification', details: error.message || String(error) });
  }
}
