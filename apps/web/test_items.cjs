const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('payment_vouchers').select(`
      id, voucher_code, type,
      items:payment_voucher_items(
        id, amount, order_id, shift_id,
        order:orders!payment_voucher_items_order_id_fkey(code),
        shift:driver_shifts!payment_voucher_items_shift_id_fkey(started_at)
      )
  `).order('created_at', { ascending: false }).limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}
test();
