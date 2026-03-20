// ─── Geocoding Service ───────────────────────────────────
// Primary: Google Maps Places Autocomplete API (most accurate for VN)
// Fallback: Nominatim (OSM, free, no key) if Google key not configured
//
// Google Maps free tier: $200/month credit = ~40,000 geocode requests free
// At a few hundred addresses/month → completely free forever

export interface GeocodingResult {
  id:         string
  name:       string
  address:    string
  lat:        number
  lng:        number
  source:     'google' | 'nominatim'
}

// ── HCM area focus ──
const HCM_LOCATION = '10.8231,106.6297'   // lat,lng for Google bias
const HCM_RADIUS   = 50000                  // 50km radius bias

// ── Google Maps Places Autocomplete + Place Details ────────
// Uses the newer Places API (New) — no session token billing complexity
async function searchGoogle(query: string): Promise<GeocodingResult[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return []

  try {
    // Autocomplete to get place IDs
    const acRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&key=${apiKey}` +
      `&language=vi` +
      `&components=country:vn` +
      `&location=${HCM_LOCATION}` +
      `&radius=${HCM_RADIUS}` +
      `&types=geocode|establishment`,
      { headers: { 'Accept': 'application/json' } }
    )
    if (!acRes.ok) return []
    const acData = await acRes.json()
    const predictions = acData.predictions ?? []
    if (predictions.length === 0) return []

    // Get coordinates for each prediction via Place Details
    const results: GeocodingResult[] = []
    for (const p of predictions.slice(0, 5)) {
      try {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${p.place_id}` +
          `&fields=geometry,name,formatted_address` +
          `&key=${apiKey}` +
          `&language=vi`
        )
        if (!detailRes.ok) continue
        const detailData = await detailRes.json()
        const loc = detailData.result?.geometry?.location
        if (!loc) continue
        results.push({
          id:      `gm-${p.place_id}`,
          name:    p.structured_formatting?.main_text || detailData.result?.name || p.description,
          address: p.description || detailData.result?.formatted_address || '',
          lat:     loc.lat,
          lng:     loc.lng,
          source:  'google' as const,
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

// ── Nominatim fallback (free, no key) ────────────────────
async function searchNominatim(query: string): Promise<GeocodingResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query.trim())}` +
      `&format=jsonv2&countrycodes=VN` +
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

// ── Combined geocoding ───────────────────────────────────
// Strategy: Google Maps (accurate) → Nominatim fallback if no Google key
export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return []

  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (googleKey) {
    const googleResults = await searchGoogle(query)
    if (googleResults.length > 0) return googleResults
  }

  // Fallback to Nominatim
  return searchNominatim(query)
}
