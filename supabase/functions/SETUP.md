## Panduan Supabase Edge Function — Secrets

Set secrets bằng Supabase CLI sebelum deploy:

```bash
supabase secrets set ORS_API_KEY=your_openrouteservice_key
supabase secrets set MAPBOX_TOKEN=pk.your_mapbox_token
supabase secrets set UPSTASH_REDIS_REST_URL=https://...upstash.io
supabase secrets set UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

Supabase secara otomatis menyediakan:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

## Setup Cron Job (5 menit / snapshot log)

Jalankan SQL berikut di Supabase SQL Editor setelah deploy function `snapshot-order-logs`:

```sql
SELECT cron.schedule(
  'snapshot-order-logs',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/snapshot-order-logs',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      )
    )
  $$
);
```
