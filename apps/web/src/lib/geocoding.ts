// ─── Geocoding Service ───────────────────────────────────
// Combines Nominatim (OSM, primary) + Mapbox Search Box (fallback)
// for accurate Vietnamese address geocoding with result selection

export interface GeocodingResult {
  id:         string
  name:       string
  address:    string
  lat:        number
  lng:        number
  source:     'nominatim' | 'mapbox'
}

// ── HCM area defaults ──
const HCM_CENTER = { lng: 106.6297, lat: 10.8231 }
const HCM_BBOX   = '106.3,10.5,107.0,11.1'

// ── Nominatim (free, no key needed) ──────────────────────
async function searchNominatim(query: string): Promise<GeocodingResult[]> {
  try {
    const q = encodeURIComponent(query.trim())
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search` +
      `?q=${q}&format=jsonv2&countrycodes=VN` +
      `&viewbox=106.3,11.1,107.0,10.5&bounded=1` +
      `&addressdetails=1&limit=5&accept-language=vi`,
      { headers: { 'User-Agent': 'ADC-Delivery-System/1.0' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data as any[]).map((item, idx) => ({
      id:      `nom-${idx}-${item.place_id}`,
      name:    item.display_name?.split(',').slice(0, 2).join(',').trim() || item.display_name,
      address: item.display_name || '',
      lat:     parseFloat(item.lat),
      lng:     parseFloat(item.lon),
      source:  'nominatim' as const,
    }))
  } catch {
    return []
  }
}

// ── Mapbox Search Box v1 (suggest + retrieve) ────────────
async function searchMapbox(query: string): Promise<GeocodingResult[]> {
  try {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) return []

    const sessionToken = crypto.randomUUID()
    const q = encodeURIComponent(query.trim())
    const suggestRes = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/suggest` +
      `?q=${q}&access_token=${token}` +
      `&session_token=${sessionToken}` +
      `&country=VN&language=vi&limit=5` +
      `&proximity=${HCM_CENTER.lng},${HCM_CENTER.lat}` +
      `&bbox=${HCM_BBOX}` +
      `&types=address,poi,street`
    )
    if (!suggestRes.ok) return []
    const suggestData = await suggestRes.json()
    const suggestions = suggestData.suggestions ?? []
    if (suggestions.length === 0) return []

    // Retrieve coordinates for each suggestion
    const results: GeocodingResult[] = []
    for (const s of suggestions.slice(0, 5)) {
      if (!s.mapbox_id) continue
      try {
        const retrieveRes = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${s.mapbox_id}` +
          `?access_token=${token}&session_token=${sessionToken}`
        )
        if (!retrieveRes.ok) continue
        const retrieveData = await retrieveRes.json()
        const feature = retrieveData.features?.[0]
        if (!feature?.geometry?.coordinates) continue
        const [lng, lat] = feature.geometry.coordinates
        results.push({
          id:      `mb-${s.mapbox_id}`,
          name:    s.name || s.full_address || '',
          address: s.full_address || s.place_formatted || s.name || '',
          lat,
          lng,
          source:  'mapbox' as const,
        })
      } catch {
        continue
      }
    }
    return results
  } catch {
    return []
  }
}

// ── Combined geocoding ───────────────────────────────────
// Strategy: Nominatim first (free), Mapbox fallback if < 3 results
// Merge + deduplicate by proximity (< 100m = same place)
export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return []

  const nomResults = await searchNominatim(query)

  // If Nominatim returns enough results, use them
  if (nomResults.length >= 3) {
    return nomResults.slice(0, 5)
  }

  // Otherwise, also fetch from Mapbox
  const mbResults = await searchMapbox(query)

  // Merge: Nominatim first, then Mapbox (deduped)
  const merged = [...nomResults]
  for (const mb of mbResults) {
    const isDupe = merged.some(existing => {
      const dlat = Math.abs(existing.lat - mb.lat)
      const dlng = Math.abs(existing.lng - mb.lng)
      return dlat < 0.001 && dlng < 0.001 // ~100m proximity
    })
    if (!isDupe) merged.push(mb)
  }

  return merged.slice(0, 5)
}
