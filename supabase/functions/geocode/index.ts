// Edge Function: geocode
// Cache-first: PostgreSQL locations table → Redis → Mapbox Geocoding API
// Saves on API calls by caching at DB level (permanent) + Redis (fast lookup)
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

const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN")!
// Vietnam bounding box for proximity bias
const VN_PROXIMITY = "106.6297,10.8231"  // HCMC center
const VN_BBOX = "102.14441,8.17966,109.46924,23.39325"

Deno.serve(async (req) => {
  const { address } = await req.json()
  if (!address?.trim()) {
    return new Response(JSON.stringify({ error: "address required" }), { status: 400 })
  }

  const normalizedAddress = address.trim().toLowerCase()
  const cacheKey = `geo:${await sha256(normalizedAddress)}`

  // 1. Redis cache check (permanent — geocode results don't change)
  const cached = await redis.get<{ lat: number; lng: number }>(cacheKey)
  if (cached) {
    return new Response(JSON.stringify({ ...cached, fromCache: "redis" }), {
      headers: { "Content-Type": "application/json" },
    })
  }

  // 2. Mapbox Geocoding API
  const encoded = encodeURIComponent(address)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
    + `?access_token=${MAPBOX_TOKEN}`
    + `&bbox=${VN_BBOX}`
    + `&proximity=${VN_PROXIMITY}`
    + `&country=VN`
    + `&limit=1`
    + `&language=vi`

  const res = await fetch(url)
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "Geocoding API failed" }), { status: 502 })
  }

  const data = await res.json()
  const feature = data.features?.[0]
  if (!feature) {
    return new Response(JSON.stringify({ error: "Address not found" }), { status: 404 })
  }

  const [lng, lat] = feature.center
  const result = { lat, lng, place_name: feature.place_name }

  // 3. Cache permanently in Redis (no TTL — geocode results are stable)
  await redis.set(cacheKey, JSON.stringify({ lat, lng }))

  return new Response(JSON.stringify({ ...result, fromCache: false }), {
    headers: { "Content-Type": "application/json" },
  })
})

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")
}
