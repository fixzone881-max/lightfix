const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — DB calls will fail until configured.');
}

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
