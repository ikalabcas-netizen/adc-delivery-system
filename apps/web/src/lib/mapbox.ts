import mapboxgl from 'mapbox-gl'

const token = import.meta.env.VITE_MAPBOX_TOKEN as string

if (!token) {
  throw new Error('Missing VITE_MAPBOX_TOKEN. Check apps/web/.env.local')
}

mapboxgl.accessToken = token

export const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12'

// Vietnam bounding box — limits geocoding to VN addresses
export const VN_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [102.14441, 8.17966],   // SW
  [109.46924, 23.39325],  // NE
]

export const VN_CENTER: [number, number] = [106.6297, 10.8231] // Ho Chi Minh City

export { mapboxgl }
