import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://szwiejswmfivultxxywb.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_SERVICE_KEY || 
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY || 
  'sb_publishable_q2imOp6aORMPdq0tdGLhsw_e8aAXuTS';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const body = req.body || {};
    const { table, type, record } = body;

    if (!record) {
      return res.status(400).json({ error: 'No record provided' });
    }

    console.log('Backend sendEmail - Relaying email request to Supabase Edge Function (send-notification-email)...');

    // Relay request from Vercel Serverless Function to Supabase Edge Function with Master Authorization
    // This utilizes the GMAIL_USER & GMAIL_PASS secrets already configured on Supabase Secrets!
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      },
      body: JSON.stringify({
        table,
        type,
        record
      })
    });

    const data = await response.json().catch(() => ({ message: 'Non-JSON response from Edge Function' }));
    console.log('Backend sendEmail - Supabase Edge Function response status:', response.status, 'data:', data);

    return res.status(200).json({ success: true, edgeFunctionStatus: response.status, data });
  } catch (error) {
    console.error('Backend sendEmail Fatal Error:', error);
    return res.status(500).json({ error: 'Failed to trigger email notification', details: error.message || String(error) });
  }
}
