const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('collision_incidents')
    .select('count')
    .limit(1);
  
  if (error) {
    console.error('✗ Connection failed:', error.message);
  } else {
    console.log('✓ Supabase connected successfully!');
    console.log('Database is ready');
  }
}

test();
