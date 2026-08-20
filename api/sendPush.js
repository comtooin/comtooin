import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client to bypass RLS policies securely
// Supports various environment variable configurations to ensure master privileges
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY || ''
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

    // 2. Query staff onesignal_ids via RLS-bypassing RPC function with table fallback
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
      let rpcRole = null;
      if (targetStaffIds === 'member_only') {
        rpcRole = 'member_only';
      }

      // Try secure Definier RPC first
      let { data: staffData, error: staffError } = await supabase.rpc('get_staff_onesignal_ids', {
        target_role: rpcRole
      });

      // If RPC is missing or fails (e.g. database migrations not applied yet), fallback to direct select
      if (staffError || !staffData) {
        console.warn('Backend sendPush - Staff RPC query failed or not deployed, falling back to direct table select. Error:', staffError);
        
        let staffQuery = supabase.from('staff').select('onesignal_id').not('onesignal_id', 'is', null);
        if (targetStaffIds === 'member_only') {
          staffQuery = staffQuery.in('role', ['member', 'admin']);
        } else if (Array.isArray(targetStaffIds) && targetStaffIds.length > 0) {
          staffQuery = staffQuery.in('id', targetStaffIds);
        }

        const { data: fallbackStaffData, error: fallbackStaffError } = await staffQuery;
        if (fallbackStaffError) {
          console.error('Backend sendPush - Staff fallback direct select also failed:', fallbackStaffError);
        } else if (fallbackStaffData) {
          staffData = fallbackStaffData;
        }
      }

      if (staffData) {
        finalPlayerIds.push(...staffData.map(s => s.onesignal_id).filter(Boolean));
      }
    }

    // 3. Query customer onesignal_ids via RLS-bypassing RPC function with table fallback
    if (targetCustomerId) {
      // Try secure Definier RPC first
      let { data: custData, error: custError } = await supabase.rpc('get_customer_onesignal_id', {
        target_cust_id: targetCustomerId
      });

      // If RPC is missing or fails, fallback to direct select
      if (custError || !custData) {
        console.warn('Backend sendPush - Customer RPC query failed or not deployed, falling back to direct table select. Error:', custError);
        
        const { data: fallbackCustData, error: fallbackCustError } = await supabase
          .from('customers')
          .select('onesignal_id')
          .eq('id', targetCustomerId)
          .not('onesignal_id', 'is', null);

        if (fallbackCustError) {
          console.error('Backend sendPush - Customer fallback direct select also failed:', fallbackCustError);
        } else if (fallbackCustData) {
          custData = fallbackCustData;
        }
      }

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

    // OneSignal REST API Call (v1 endpoint)
    // include_player_ids accepts array of Subscription IDs / Player IDs
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: uniquePlayerIds,
        headings: { en: title, ko: title },
        contents: { en: message, ko: message },
        ...(url && { url })
      })
    });

    const data = await response.json();
    console.log('Backend sendPush - OneSignal REST API response status:', response.status, 'data:', data);

    if (data?.errors && data.errors.length > 0) {
      console.error('Backend sendPush - OneSignal API returned errors:', data.errors);
      return res.status(400).json({ success: false, errors: data.errors, data, targetIdsCount: uniquePlayerIds.length });
    }

    return res.status(200).json({ success: true, data, targetIdsCount: uniquePlayerIds.length });
  } catch (error) {
    console.error('Fatal Error sending push notification:', error);
    return res.status(500).json({ error: 'Failed to send notification', details: error.message || String(error) });
  }
}
