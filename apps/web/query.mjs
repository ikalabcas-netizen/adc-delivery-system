import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.from('payment_vouchers').select(`
      id, voucher_code, type,
      items:payment_voucher_items(
        id, amount, order_id, shift_id,
        order:orders!payment_voucher_items_order_id_fkey(code),
        shift:driver_shifts!payment_voucher_items_shift_id_fkey(started_at)
      )
  `).order('created_at', { ascending: false }).limit(2);
  
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
run();
