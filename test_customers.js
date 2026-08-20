const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://szwiejswmfivultxxywb.supabase.co', 'sb_publishable_q2imOp6aORMPdq0tdGLhsw_e8aAXuTS');
supabase.from('customers').select('id, name, onesignal_id, login_id').then(res => console.log(JSON.stringify(res.data, null, 2))).catch(console.error);
