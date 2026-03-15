import { useEffect, useRef, useState } from 'react'
import { Layers, Navigation, Package } from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useLocations } from '@/hooks/useLocations'
import { useDeliveryRoutes } from '@/hooks/useDeliveryRoutes'
import type { Order } from '@adc/shared-types'

/**
 * MapPage — Mapbox GL realtime map for coordinator
 *
 * - Shows order pickup (cyan) and delivery (amber) markers
 * - Sidebar with live order stats
 * - Lazy-loads mapbox-gl to handle missing token gracefully
 */

const STATUS_COLORS: Record<string, string> = {
  pending:    '#d97706',
  assigned:   '#2563eb',
  in_transit: '#7c3aed',
  delivered:  '#059669',

  cancelled:  '#94a3b8',
}

export function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const [mapError, setMapError] = useState('')
  const [mapLoaded, setMapLoaded] = useState(false)
  const { data: orders = [] } = useOrders()
  const { data: locations = [] } = useLocations()
  const { data: routes = [] } = useDeliveryRoutes()

  // Build route color map
  const routeColorMap = new Map(routes.map(r => [r.id, r]))

  // Initialize map
  useEffect(() => {
    let map: any = null

    async function initMap() {
      if (!mapRef.current) return

      try {
        const { mapboxgl, MAPBOX_STYLE, VN_CENTER } = await import('@/lib/mapbox')
        await import('mapbox-gl/dist/mapbox-gl.css')

        map = new mapboxgl.Map({
          container: mapRef.current,
          style: MAPBOX_STYLE,
          center: VN_CENTER,
          zoom: 11,
          attributionControl: false,
        })

        map.addControl(new mapboxgl.NavigationControl(), 'top-right')
        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

        map.on('load', () => {
          mapInstance.current = map
          setMapLoaded(true)
        })

      } catch (err: any) {
        console.error('[MapPage] init error:', err)
        setMapError(err.message || 'Không thể tải bản đồ')
      }
    }

    initMap()

    return () => {
      if (map) {
        try { map.remove() } catch {}
      }
    }
  }, [])

  // Stats
  const activeOrders = orders.filter(o => ['pending', 'assigned', 'in_transit'].includes(o.status))
  const locationsWithCoords = locations.filter(l => l.lat && l.lng)

  // Add markers when map loaded + data changes
  useEffect(() => {
    if (!mapLoaded || !mapInstance.current) return

    const map = mapInstance.current as any
    let markers: any[] = []

    async function addMarkers() {
      const { mapboxgl } = await import('@/lib/mapbox')

      // Clear existing markers
      markers.forEach(m => m.remove())
      markers = []

      // Add location markers from orders
      orders.forEach((order: Order) => {
        const pickup = order.pickup_location
        const delivery = order.delivery_location
        const statusColor = STATUS_COLORS[order.status] ?? '#94a3b8'

        if (pickup?.lat && pickup?.lng) {
          const el = createMarkerEl('#06b6d4', 'P')
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([pickup.lng, pickup.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(`
                <div style="font-family:Outfit,sans-serif;padding:4px 0">
                  <p style="font-weight:600;font-size:13px;margin:0;color:#0f172a">${pickup.name}</p>
                  <p style="font-size:11px;color:#94a3b8;margin:2px 0 0">${order.code} · Lấy hàng</p>
                  <span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;color:${statusColor};background:${statusColor}18">${order.status}</span>
                </div>
              `))
            .addTo(map)
          markers.push(marker)
        }

        if (delivery?.lat && delivery?.lng) {
          const el = createMarkerEl(statusColor, 'D')
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([delivery.lng, delivery.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setHTML(`
                <div style="font-family:Outfit,sans-serif;padding:4px 0">
                  <p style="font-weight:600;font-size:13px;margin:0;color:#0f172a">${delivery.name}</p>
                  <p style="font-size:11px;color:#94a3b8;margin:2px 0 0">${order.code} · Giao hàng</p>
                  <span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;color:${statusColor};background:${statusColor}18">${order.status}</span>
                </div>
              `))
            .addTo(map)
          markers.push(marker)
        }
      })

      // Add saved location markers (colored by route)
      locationsWithCoords.forEach(loc => {
        const isUsedInOrder = orders.some(o =>
          o.pickup_location_id === loc.id || o.delivery_location_id === loc.id
        )
        if (isUsedInOrder) return // Already shown via order markers

        const route = loc.route_id ? routeColorMap.get(loc.route_id) : null
        const bubbleColor = route?.color ?? '#94a3b8'
        const routeLabel = route?.name ?? ''

        const el = createMarkerEl(bubbleColor, '', 10)
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([loc.lng!, loc.lat!])
          .setPopup(new mapboxgl.Popup({ offset: 15, closeButton: false })
            .setHTML(`
              <div style="font-family:Outfit,sans-serif;padding:4px 0">
                <p style="font-weight:600;font-size:13px;margin:0">${loc.name}</p>
                <p style="font-size:11px;color:#94a3b8;margin:2px 0 0">${loc.address}</p>
                ${routeLabel ? `<span style="display:inline-block;margin-top:4px;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:600;color:${bubbleColor};background:${bubbleColor}18">${routeLabel}</span>` : ''}
              </div>
            `))
          .addTo(map)
        markers.push(marker)
      })
    }

    addMarkers()

    return () => {
      markers.forEach(m => m.remove())
    }
  }, [mapLoaded, orders, locations, locationsWithCoords, routeColorMap])

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '0 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Bản đồ</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Theo dõi đơn hàng và giao nhận</p>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatChip icon={<Package size={13} />} label="Đơn đang xử lý" value={activeOrders.length} color="#06b6d4" />
        <StatChip icon={<Navigation size={13} />} label="Địa điểm có toạ độ" value={locationsWithCoords.length} color="#059669" />
        <StatChip icon={<Layers size={13} />} label="Tổng đơn" value={orders.length} color="#475569" />
      </div>

      {/* Map container */}
      <div style={{
        flex: 1, minHeight: 400, borderRadius: 12, overflow: 'hidden',
        border: '1px solid #e2e8f0', position: 'relative',
        background: '#f1f5f9',
      }}>
        {mapError ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
          }}>
            <Navigation size={36} color="#94a3b8" style={{ opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
              {mapError.includes('VITE_MAPBOX_TOKEN')
                ? 'Chưa cấu hình Mapbox token. Thêm VITE_MAPBOX_TOKEN vào biến môi trường Vercel.'
                : mapError
              }
            </p>
            <p style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center' }}>
              Các chức năng khác (đơn hàng, địa điểm) vẫn hoạt động bình thường.
            </p>
          </div>
        ) : (
          <>
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
            {!mapLoaded && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.8)',
              }}>
                <p style={{ fontSize: 14, color: '#94a3b8' }}>Đang tải bản đồ...</p>
              </div>
            )}
          </>
        )}

        {/* Legend — routes + order statuses */}
        {mapLoaded && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12,
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
            borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11,
          }}>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: 2 }}>Tuyến giao nhận</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {routes.map(r => <LegendItem key={r.id} color={r.color} label={r.name} />)}
              <LegendItem color="#94a3b8" label="Chưa gán tuyến" />
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 4, marginTop: 2, fontWeight: 600, color: '#475569' }}>Trạng thái đơn</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <LegendItem color="#06b6d4" label="Lấy hàng" />
              <LegendItem color="#d97706" label="Chờ giao" />
              <LegendItem color="#2563eb" label="Đã gán" />
              <LegendItem color="#7c3aed" label="Đang giao" />
              <LegendItem color="#059669" label="Đã giao" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────
function StatChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px', background: '#fff', borderRadius: 10,
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{value}</span>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ color: '#475569' }}>{label}</span>
    </div>
  )
}

function createMarkerEl(color: string, text: string, size = 12) {
  const el = document.createElement('div')
  el.style.cssText = `
    width: ${size * 2.5}px; height: ${size * 2.5}px;
    background: ${color}; border: 2px solid #fff;
    border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: ${size}px; font-weight: 700;
    color: #fff; font-family: Outfit, sans-serif;
  `
  el.textContent = text
  return el
}
