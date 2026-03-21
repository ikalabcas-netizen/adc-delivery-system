import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) throw new Error('Missing env vars');

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('driver_shifts').select(`
    id, started_at, ended_at, km_in, km_out, km_driven, status,
    odometer_photo_in_url, odometer_photo_out_url,
    km_approval_status, km_approval_note, km_payment_amount,
    driver:profiles!driver_shifts_driver_id_fkey(id, full_name, avatar_url),
    trips(id, optimized_distance_km),
    voucher_items:payment_voucher_items(voucher:payment_vouchers(id, voucher_code, status))
  `).eq('status', 'ended').order('ended_at', { ascending: false })

  console.log('Error:', error?.message || null, '| Count:', data?.length);
}

test();
