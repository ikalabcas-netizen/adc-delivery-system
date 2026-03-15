// Edge Function: optimize-route
// Trigger: Called by Coordinator when assigning orders to a trip
// Cache-first: Redis → OpenRouteService API
import "https://deno.land/x/dotenv@v3.2.2/load.ts"
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

const ORS_API_KEY = Deno.env.get("ORS_API_KEY")!
const ORS_URL = "https://api.openrouteservice.org/optimization"

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 })
  }

  const { tripId } = await req.json()
  if (!tripId) {
    return new Response(JSON.stringify({ error: "tripId required" }), { status: 400 })
  }

  // 1. Fetch trip + orders + locations
  const { data: trip, error } = await supabase
    .from("trips")
    .select(`
      id, driver_id,
      orders:orders (
        id, type,
        pickup_location:locations!pickup_location_id (id, lat, lng, name),
        delivery_location:locations!delivery_location_id (id, lat, lng, name)
      )
    `)
    .eq("id", tripId)
    .single()

  if (error || !trip) {
    return new Response(JSON.stringify({ error: "Trip not found" }), { status: 404 })
  }

  // 2. Build cache key from sorted order IDs
  const orderIds = (trip.orders ?? []).map((o: any) => o.id).sort().join(",")
  const cacheKey = `route:${await sha256(orderIds)}`

  // 3. Redis cache check (TTL 15 min)
  const cached = await redis.get(cacheKey)
  if (cached) {
    return new Response(JSON.stringify({ optimized_route: cached, fromCache: true }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  // 4. Rate limit: max 500 ORS calls/day
  const dayKey = `ors:daily:${new Date().toISOString().slice(0, 10)}`
  const count = await redis.incr(dayKey)
  if (count === 1) await redis.expire(dayKey, 86400)
  if (count > 480) {  // Buffer before hitting 500
    return new Response(JSON.stringify({ error: "Daily route optimization limit reached" }), { status: 429 })
  }

  // 5. Build ORS optimization payload (VRPTW)
  const jobs = buildORSJobs(trip.orders ?? [])
  const vehicles = [{ id: 1, start: jobs[0]?.location }]  // Single vehicle per trip

  const orsPayload = { jobs, vehicles }

  const orsRes = await fetch(ORS_URL, {
    method: "POST",
    headers: {
      "Authorization": ORS_API_KEY,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(orsPayload),
  })

  if (!orsRes.ok) {
    const errText = await orsRes.text()
    console.error("ORS Error:", errText)
    return new Response(JSON.stringify({ error: "Route optimization failed" }), { status: 502 })
  }

  const orsData = await orsRes.json()
  const optimized_route = parseORSResult(orsData, trip.orders ?? [])

  // 6. Cache result (15 min) + save to DB
  await redis.set(cacheKey, JSON.stringify(optimized_route), { ex: 900 })

  await supabase
    .from("trips")
    .update({ optimized_route, route_cache_key: cacheKey })
    .eq("id", tripId)

  return new Response(JSON.stringify({ optimized_route, fromCache: false }), {
    headers: { "Content-Type": "application/json" },
  })
})

// Helper: build ORS jobs array from orders
function buildORSJobs(orders: any[]) {
  const jobs: any[] = []
  orders.forEach((order, idx) => {
    const base = idx * 2
    jobs.push({
      id:       base + 1,
      service:  300,  // 5 min service time (seconds)
      location: [order.pickup_location.lng, order.pickup_location.lat],
      type:     "pickup",
      description: order.id,
    })
    jobs.push({
      id:       base + 2,
      service:  300,
      location: [order.delivery_location.lng, order.delivery_location.lat],
      type:     "delivery",
      description: order.id,
    })
  })
  return jobs
}

// Helper: parse ORS result into RouteStop[]
function parseORSResult(orsData: any, orders: any[]) {
  const steps = orsData?.routes?.[0]?.steps ?? []
  return steps
    .filter((s: any) => s.type === "job")
    .map((s: any, idx: number) => ({
      sequence:   idx + 1,
      orderId:    s.description,
      locationId: undefined,
      lat:        s.location[1],
      lng:        s.location[0],
      type:       s.job_type ?? "delivery",
      eta:        s.arrival ? new Date(s.arrival * 1000).toISOString() : undefined,
    }))
}

// Helper: SHA-256 for cache key
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")
}
