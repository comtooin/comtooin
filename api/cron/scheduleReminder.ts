import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client to bypass RLS for cron job
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel Cron passes a specific header we can check (optional security)
  // if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!appId || !apiKey) {
    return res.status(500).json({ error: 'OneSignal Config Missing' });
  }

  try {
    // 1. Get tomorrow's date range in KST
    const now = new Date();
    // Move to KST (UTC+9)
    const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    // Add 1 day
    kstDate.setDate(kstDate.getDate() + 1);
    
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    
    // YYYY-MM-DD format
    const tomorrowStr = `${year}-${month}-${day}`;
    const startOfTomorrow = `${tomorrowStr}T00:00:00.000Z`;
    const endOfTomorrow = `${tomorrowStr}T23:59:59.999Z`;

    // 2. Fetch schedules for tomorrow
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('id, title, staff_ids')
      .gte('start_time', startOfTomorrow)
      .lte('start_time', endOfTomorrow);

    if (error) throw error;
    if (!schedules || schedules.length === 0) {
      return res.status(200).json({ message: 'No schedules for tomorrow.' });
    }

    // 3. Collect unique staff IDs who have schedules tomorrow
    const targetStaffIds = new Set<string>();
    const staffScheduleTitles: Record<string, string[]> = {};

    for (const schedule of schedules) {
      if (schedule.staff_ids && Array.isArray(schedule.staff_ids)) {
        for (const staffId of schedule.staff_ids) {
          targetStaffIds.add(staffId);
          if (!staffScheduleTitles[staffId]) staffScheduleTitles[staffId] = [];
          staffScheduleTitles[staffId].push(schedule.title);
        }
      }
    }

    if (targetStaffIds.size === 0) {
      return res.status(200).json({ message: 'No staff assigned to tomorrow\'s schedules.' });
    }

    // 4. Fetch valid OneSignal IDs for these staff (excluding admins)
    const { data: staffData, error: staffError } = await supabase
      .from('staff')
      .select('id, onesignal_id, role')
      .in('id', Array.from(targetStaffIds))
      .not('onesignal_id', 'is', null)
      .neq('role', 'admin');

    if (staffError) throw staffError;
    if (!staffData || staffData.length === 0) {
      return res.status(200).json({ message: 'No valid non-admin staff found with push IDs.' });
    }

    // 5. Send push notifications per user (since titles differ)
    let sendCount = 0;
    for (const staff of staffData) {
      const titles = staffScheduleTitles[staff.id];
      if (!titles) continue;

      const title = '내일 일정 알림';
      const message = `내일 ${titles.length}개의 일정이 있습니다: ${titles.join(', ')}`;

      const response = await fetch('https://api.onesignal.com/notifications?c=push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${apiKey}`,
          'accept': 'application/json'
        },
        body: JSON.stringify({
          app_id: appId,
          include_subscription_ids: [staff.onesignal_id],
          headings: { en: title, ko: title },
          contents: { en: message, ko: message },
          target_channel: "push"
        })
      });

      if (response.ok) sendCount++;
    }

    return res.status(200).json({ success: true, message: `Sent ${sendCount} notifications.` });
  } catch (error: any) {
    console.error('Cron Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
