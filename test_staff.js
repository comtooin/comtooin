const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://szwiejswmfivultxxywb.supabase.co', 'sb_publishable_q2imOp6aORMPdq0tdGLhsw_e8aAXuTS');
supabase.from('staff').select('*').then(res => console.log(JSON.stringify(res.data, null, 2))).catch(console.error);
