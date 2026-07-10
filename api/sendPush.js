export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const { title, message, include_player_ids } = body;
    const appId = process.env.REACT_APP_ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_API_KEY;

    if (!appId || !apiKey) {
      return res.status(500).json({ error: 'OneSignal App ID or API Key not configured' });
    }

    if (!include_player_ids || include_player_ids.length === 0) {
      return res.status(200).json({ success: true, message: 'No target users specified' });
    }

    // OneSignal API expects include_player_ids or include_subscription_ids
    const response = await fetch('https://api.onesignal.com/notifications?c=push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        include_subscription_ids: include_player_ids,
        headings: { en: title, ko: title },
        contents: { en: message, ko: message },
        target_channel: "push"
      })
    });

    const data = await response.json();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Fatal Error sending push notification:', error);
    return res.status(500).json({ error: 'Failed to send notification', details: error.message || String(error) });
  }
}
