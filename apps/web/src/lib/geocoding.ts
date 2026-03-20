// ─── Geocoding Service ───────────────────────────────────
// Primary: HERE Geocoding & Search API (250k free/month, no credit card)
//          Excellent for Vietnamese addresses
// Fallback: Nominatim (OSM, free, no key needed)

export interface GeocodingResult {
  id:         string
  name:       string
  address:    string
  lat:        number
  lng:        number
  source:     'here' | 'google' | 'nominatim'
}

// ── HERE Geocoding API ─────────────────────────────────────
// Sign up free at developer.here.com → project → API Key
// 250,000 free transactions/month, no credit card required
async function searchHere(query: string): Promise<GeocodingResult[]> {
  const apiKey = import.meta.env.VITE_HERE_API_KEY
  if (!apiKey) return []

  try {
    const res = await fetch(
      `https://geocode.search.hereapi.com/v1/geocode` +
      `?q=${encodeURIComponent(query)}` +
      `&apiKey=${apiKey}` +
      `&lang=vi` +
      `&in=countryCode:VNM` +   // restrict to Vietnam
      `&at=10.8231,106.6297` +  // HCM bias
      `&limit=5`
    )
    if (!res.ok) return []
    const data = await res.json()
    const items = data.items ?? []
    return items.map((item: any, idx: number) => ({
      id:      `here-${item.id ?? idx}`,
      name:    item.title?.split(',')[0] ?? item.title ?? '',
      address: item.title ?? '',
      lat:     item.position?.lat ?? 0,
      lng:     item.position?.lng ?? 0,
      source:  'here' as const,
    })).filter((r: GeocodingResult) => r.lat !== 0)
  } catch {
    return []
  }
}

// ── HERE Autocomplete (suggest while typing) ───────────────
export async function autocompleteHere(query: string): Promise<GeocodingResult[]> {
  const apiKey = import.meta.env.VITE_HERE_API_KEY
  if (!apiKey) return searchNominatim(query)

  try {
    const res = await fetch(
      `https://autocomplete.search.hereapi.com/v1/autocomplete` +
      `?q=${encodeURIComponent(query)}` +
      `&apiKey=${apiKey}` +
      `&lang=vi` +
      `&in=countryCode:VNM` +
      `&at=10.8231,106.6297` +
      `&limit=5`
    )
    if (!res.ok) return []
    const data = await res.json()
    const items = data.items ?? []

    // Autocomplete only gives IDs, need to look up coordinates
    const results: GeocodingResult[] = []
    for (const item of items.slice(0, 5)) {
      if (item.position) {
        // Some items already have position
        results.push({
          id:      `here-${item.id ?? results.length}`,
          name:    item.title?.split(',')[0] ?? item.title ?? '',
          address: item.title ?? item.address?.label ?? '',
          lat:     item.position.lat,
          lng:     item.position.lng,
          source:  'here' as const,
        })
      } else if (item.id) {
        // Lookup by place ID
        try {
          const detail = await fetch(
            `https://lookup.search.hereapi.com/v1/lookup` +
            `?id=${item.id}&apiKey=${apiKey}&lang=vi`
          )
          if (!detail.ok) continue
          const d = await detail.json()
          if (!d.position) continue
          results.push({
            id:      `here-${item.id}`,
            name:    (d.title ?? item.title)?.split(',')[0] ?? '',
            address: d.title ?? item.title ?? '',
            lat:     d.position.lat,
            lng:     d.position.lng,
            source:  'here' as const,
          })
        } catch { continue }
      }
    }
    return results
  } catch {
    return searchNominatim(query)
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
    return (data as any[]).map((item: any, idx: number) => ({
      id:      `nom-${idx}-${item.place_id}`,
      name:    item.display_name?.split(',').slice(0, 2).join(',').trim() ?? item.display_name,
      address: item.display_name ?? '',
      lat:     parseFloat(item.lat),
      lng:     parseFloat(item.lon),
      source:  'nominatim' as const,
    }))
  } catch {
    return []
  }
}

// ── Main export: combined geocoding ──────────────────────
// Strategy: HERE (accurate, 250k free/month) → Nominatim fallback
export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  if (!query.trim()) return []

  const hereKey = import.meta.env.VITE_HERE_API_KEY
  if (hereKey) {
    // Try HERE autocomplete first (better suggestions while typing)
    const hereResults = await autocompleteHere(query)
    if (hereResults.length > 0) return hereResults

    // Fallback to HERE geocode direct
    const geocodeResults = await searchHere(query)
    if (geocodeResults.length > 0) return geocodeResults
  }

  // Also try Google if configured
  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (googleKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?address=${encodeURIComponent(query)}` +
        `&key=${googleKey}` +
        `&language=vi&region=vn` +
        `&bounds=10.5,106.3|11.1,107.0`
      )
      if (res.ok) {
        const data = await res.json()
        const googleResults = (data.results ?? []).slice(0, 5).map((r: any, idx: number) => ({
          id:      `gm-${r.place_id ?? idx}`,
          name:    r.address_components?.[0]?.long_name ?? r.formatted_address?.split(',')[0] ?? '',
          address: r.formatted_address ?? '',
          lat:     r.geometry?.location?.lat ?? 0,
          lng:     r.geometry?.location?.lng ?? 0,
          source:  'google' as const,
        })).filter((r: GeocodingResult) => r.lat !== 0)
        if (googleResults.length > 0) return googleResults
      }
    } catch { /* fall through */ }
  }

  // Final fallback: Nominatim
  return searchNominatim(query)
}
