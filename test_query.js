const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, 'apps/web/.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) throw new Error('Missing env vars');

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('driver_shifts').select(`
    id, started_at, ended_at, km_in, km_out, km_driven, status,
    odometer_photo_in_url, odometer_photo_out_url,
    km_approval_status, km_approval_note, km_payment_amount,
    driver:profiles!driver_shifts_driver_id_fkey(id, full_name, avatar_url),
    trips(id, optimized_distance_km)
  `).eq('status', 'ended').order('ended_at', { ascending: false })

  console.log('Without vouchers: Error:', error?.message?.substring(0, 100) || null, '| Count:', data?.length);

  const { data: d2, error: e2 } = await supabase.from('driver_shifts').select(`
    id,
    voucher_items:payment_voucher_items(voucher:payment_vouchers(id, voucher_code, status))
  `).limit(1);

  console.log('With vouchers: Error:', e2?.message?.substring(0, 100) || null, '| Count:', d2?.length);
}

test();
