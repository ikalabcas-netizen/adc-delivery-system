/**
 * routeOptimizer.ts
 * Tính quãng đường tối ưu cho chuyến đi qua ORS Directions API.
 * Fallback: tổng khoảng cách Haversine (đường chim bay) nếu không có API key.
 */

export interface RouteResult {
  /** Km tối ưu tự động (ORS waypoint-optimized) */
  optimized_distance_km: number
  /** Phút ước tính */
  optimized_duration_min: number
  /** GeoJSON route để render map (null nếu dùng fallback) */
  route_geojson: any | null
}

export interface Waypoint {
  lat: number
  lng: number
  label?: string
}

// ─── ORS Directions API ────────────────────────────────────────
async function calcViaORS(waypoints: Waypoint[]): Promise<RouteResult | null> {
  const apiKey = import.meta.env.VITE_ORS_API_KEY as string | undefined
  if (!apiKey || waypoints.length < 2) return null

  try {
    const coordinates = waypoints.map(w => [w.lng, w.lat])
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ coordinates }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()

    const summary = data.features?.[0]?.properties?.summary
    if (!summary) return null

    return {
      optimized_distance_km: Math.round((summary.distance / 1000) * 10) / 10,
      optimized_duration_min: Math.round(summary.duration / 60),
      route_geojson:          data,
    }
  } catch {
    return null
  }
}

// ─── Haversine fallback ────────────────────────────────────────
function haversineKm(a: Waypoint, b: Waypoint): number {
  const R  = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

function calcViaHaversine(waypoints: Waypoint[]): RouteResult {
  let totalKm = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalKm += haversineKm(waypoints[i], waypoints[i + 1])
  }
  const distKm = Math.round(totalKm * 10) / 10
  return {
    optimized_distance_km: distKm,
    optimized_duration_min: Math.round((distKm / 30) * 60),  // assume avg 30 km/h
    route_geojson: null,
  }
}

/**
 * Main: tính route từ danh sách waypoints.
 * Thử ORS trước, nếu fail → Haversine.
 */
export async function calcOptimizedRoute(waypoints: Waypoint[]): Promise<RouteResult> {
  if (waypoints.length === 0) {
    return { optimized_distance_km: 0, optimized_duration_min: 0, route_geojson: null }
  }
  if (waypoints.length === 1) {
    return { optimized_distance_km: 0, optimized_duration_min: 0, route_geojson: null }
  }

  const ors = await calcViaORS(waypoints)
  if (ors) return ors
  return calcViaHaversine(waypoints)
}

/**
 * Lấy waypoints từ danh sách orders:
 * - Điểm xuất phát = pickup_location của đơn đầu (nếu có lat/lng)
 * - Các điểm đến = delivery_location của từng đơn
 * Cho phép tính route ngay cả khi chỉ có 1 điểm giao.
 */
export function ordersToWaypointsWithPickup(
  orders: Array<{
    pickup_location?:  { lat?: number; lng?: number; name?: string } | null
    delivery_location?: { lat?: number; lng?: number; name?: string } | null
  }>,
  driverPos?: { lat: number; lng: number } | null,
): Waypoint[] {
  const deliveries: Waypoint[] = orders
    .map(o => {
      const loc = o.delivery_location
      if (!loc?.lat || !loc?.lng) return null
      return { lat: loc.lat, lng: loc.lng, label: loc.name }
    })
    .filter(Boolean) as Waypoint[]

  if (deliveries.length === 0) return []

  // Ưu tiên: vị trí tài xế > pickup_location > chỉ dùng deliveries
  if (driverPos) {
    return [{ lat: driverPos.lat, lng: driverPos.lng, label: 'Vị trí hiện tại' }, ...deliveries]
  }

  const firstPickup = orders[0]?.pickup_location
  if (firstPickup?.lat && firstPickup?.lng) {
    return [{ lat: firstPickup.lat, lng: firstPickup.lng, label: firstPickup.name ?? 'Kho' }, ...deliveries]
  }

  return deliveries
}

/**
 * Legacy helper — chỉ dùng delivery_location (không có điểm xuất phát).
 * Dùng khi không có pickup info.
 */
export function ordersToWaypoints(
  orders: Array<{ delivery_location?: { lat?: number; lng?: number; name?: string } | null }>,
  driverPos?: { lat: number; lng: number } | null,
): Waypoint[] {
  const stops: Waypoint[] = orders
    .map(o => {
      const loc = o.delivery_location
      if (!loc?.lat || !loc?.lng) return null
      return { lat: loc.lat, lng: loc.lng, label: loc.name }
    })
    .filter(Boolean) as Waypoint[]

  if (stops.length === 0) return []
  if (driverPos) return [{ lat: driverPos.lat, lng: driverPos.lng, label: 'Vị trí hiện tại' }, ...stops]
  return stops
}
