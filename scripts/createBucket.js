require('dotenv').config({path: '.env.development'});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.storage.createBucket('archive', { public: true });
  console.log('Bucket creation:', data, error);
}
run();
