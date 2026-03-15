// Edge Function: snapshot-order-logs
// Trigger: pg_cron every 5 minutes → Supabase Edge Function invoke
// Purpose: Snapshot active order statuses + driver positions into tracking log
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"
import { Redis } from "https://esm.sh/@upstash/redis@1.34.0"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)
const redis = new Redis({
  url:   Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
})

Deno.serve(async (req) => {
  // Security: only accept internal cron calls
  const authHeader = req.headers.get("Authorization")
  if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  // 1. Get all active orders
  const { data: activeOrders, error } = await supabase
    .from("orders")
    .select("id, status, assigned_to")
    .in("status", ["assigned", "in_transit"])

  if (error || !activeOrders?.length) {
    return new Response(JSON.stringify({ logged: 0 }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  const loggedAt = new Date().toISOString()

  // 2. Get driver positions from Redis (from Broadcast cache — no DB query)
  const logs = await Promise.all(
    activeOrders.map(async (order) => {
      let lat: number | null = null
      let lng: number | null = null

      if (order.assigned_to) {
        const loc = await redis.get<{ lat: number; lng: number }>(
          `driver_loc:${order.assigned_to}`
        )
        lat = loc?.lat ?? null
        lng = loc?.lng ?? null
      }

      return {
        order_id:  order.id,
        driver_id: order.assigned_to,
        status:    order.status,
        lat,
        lng,
        logged_at: loggedAt,
      }
    })
  )

  // 3. Bulk insert into partitioned table (single roundtrip)
  const { error: insertError } = await supabase
    .from("order_tracking_logs")
    .insert(logs)

  if (insertError) {
    console.error("Log insert error:", insertError)
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
  }

  // 4. Cache last 24h logs per order in Redis list (for fast dashboard queries)
  const MAX_ENTRIES = 288  // 24h × 12 snapshots/hour
  const pipeline = redis.pipeline()
  for (const log of logs) {
    const key = `order_logs:${log.order_id}`
    pipeline.lpush(key, JSON.stringify(log))
    pipeline.expire(key, 86400)   // 24h TTL
    pipeline.ltrim(key, 0, MAX_ENTRIES - 1)
  }
  await pipeline.exec()

  return new Response(
    JSON.stringify({ logged: logs.length, at: loggedAt }),
    { headers: { "Content-Type": "application/json" } }
  )
})
