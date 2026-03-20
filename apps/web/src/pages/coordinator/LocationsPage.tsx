import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Search, Plus, Edit2, Trash2, X, Check, Navigation, Crosshair, Loader } from 'lucide-react'
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/hooks/useLocations'
import { useDeliveryRoutes } from '@/hooks/useDeliveryRoutes'
import type { Location } from '@adc/shared-types'

export function LocationsPage() {
  const { data: locations = [], isLoading } = useLocations()
  const { data: routes = [] } = useDeliveryRoutes()
  const [search, setSearch]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<Location | null>(null)

  const filtered = search.trim()
    ? locations.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.address.toLowerCase().includes(search.toLowerCase()) ||
        (l.phone ?? '').includes(search)
      )
    : locations

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Địa điểm</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{locations.length} địa điểm</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}
        >
          <Plus size={14} /> Thêm mới
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm tên, địa chỉ, SĐT..."
          style={{
            width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13,
            fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff',
            color: '#1e293b', boxSizing: 'border-box',
          }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
          {search ? 'Không tìm thấy' : 'Chưa có địa điểm nào'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(loc => {
            const route = routes.find(r => r.id === loc.route_id)
            return (
              <LocationCard
                key={loc.id}
                location={loc}
                routeColor={route?.color}
                routeName={route?.name}
                onEdit={() => setEditing(loc)}
              />
            )
          })}
        </div>
      )}

      {/* Add/Edit modal */}
      {(showAdd || editing) && (
        <LocationModal
          location={editing}
          onClose={() => { setShowAdd(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function LocationCard({ location, routeColor, routeName, onEdit }: {
  location: Location; routeColor?: string; routeName?: string; onEdit: () => void
}) {
  const deleteLocation = useDeleteLocation()
  const [confirming, setConfirming] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      borderLeft: routeColor ? `4px solid ${routeColor}` : undefined,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: routeColor ? `${routeColor}18` : 'linear-gradient(135deg, #ecfeff, #cffafe)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MapPin size={16} color={routeColor ?? '#0891b2'} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{location.name}</span>
          {routeName && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
              background: `${routeColor}18`, color: routeColor,
            }}>{routeName}</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {location.address}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          {location.phone && (
            <span style={{ fontSize: 11, color: '#cbd5e1' }}>📞 {location.phone}</span>
          )}
          {location.lat && location.lng && (
            <span style={{ fontSize: 11, color: '#cbd5e1' }}>
              <Navigation size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </span>
          )}
        </div>
      </div>

      {confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#e11d48' }}>Xoá?</span>
          <button
            onClick={async () => { await deleteLocation.mutateAsync(location.id); setConfirming(false) }}
            disabled={deleteLocation.isPending}
            style={{ padding: '4px 8px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {deleteLocation.isPending ? '...' : 'OK'}
          </button>
          <button onClick={() => setConfirming(false)} style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>Huỷ</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onEdit} style={{ padding: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>
            <Edit2 size={13} color="#475569" />
          </button>
          <button onClick={() => setConfirming(true)} style={{ padding: 6, background: '#fff1f2', border: '1px solid rgba(225,29,72,0.15)', borderRadius: 6, cursor: 'pointer' }}>
            <Trash2 size={13} color="#e11d48" />
          </button>
        </div>
      )}
    </div>
  )
}

function LocationModal({ location, onClose }: { location: Location | null; onClose: () => void }) {
  const isEdit = !!location
  const createLoc = useCreateLocation()
  const updateLoc = useUpdateLocation()
  const { data: routes = [] } = useDeliveryRoutes()
  const [name, setName]       = useState(location?.name ?? '')
  const [address, setAddress] = useState(location?.address ?? '')
  const [phone, setPhone]     = useState(location?.phone ?? '')
  const [note, setNote]       = useState(location?.note ?? '')
  const [lat, setLat]         = useState(location?.lat?.toString() ?? '')
  const [lng, setLng]         = useState(location?.lng?.toString() ?? '')
  const [routeId, setRouteId] = useState(location?.route_id ?? '')
  const [error, setError]     = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeMsg, setGeocodeMsg] = useState('')
  const miniMapRef = useRef<HTMLDivElement>(null)
  const miniMapInstance = useRef<any>(null)
  const markerRef = useRef<any>(null)

  // Initialize mini-map
  useEffect(() => {
    let map: any = null
    async function init() {
      if (!miniMapRef.current) return
      try {
        const { mapboxgl, MAPBOX_STYLE, VN_CENTER } = await import('@/lib/mapbox')
        await import('mapbox-gl/dist/mapbox-gl.css')
        const center: [number, number] = lng && lat
          ? [parseFloat(lng), parseFloat(lat)]
          : VN_CENTER
        map = new mapboxgl.Map({
          container: miniMapRef.current,
          style: MAPBOX_STYLE,
          center,
          zoom: lng && lat ? 15 : 11,
          attributionControl: false,
        })
        map.addControl(new mapboxgl.NavigationControl(), 'top-right')

        // Add draggable marker if we have coords
        if (lng && lat) {
          const marker = new mapboxgl.Marker({ draggable: true, color: '#06b6d4' })
            .setLngLat(center)
            .addTo(map)
          marker.on('dragend', () => {
            const lngLat = marker.getLngLat()
            setLat(lngLat.lat.toFixed(6))
            setLng(lngLat.lng.toFixed(6))
          })
          markerRef.current = marker
        }

        // Click to place/move marker
        map.on('click', (e: any) => {
          const { lng: clickLng, lat: clickLat } = e.lngLat
          setLat(clickLat.toFixed(6))
          setLng(clickLng.toFixed(6))
          if (markerRef.current) {
            markerRef.current.setLngLat([clickLng, clickLat])
          } else {
            const marker = new mapboxgl.Marker({ draggable: true, color: '#06b6d4' })
              .setLngLat([clickLng, clickLat])
              .addTo(map)
            marker.on('dragend', () => {
              const lngLat = marker.getLngLat()
              setLat(lngLat.lat.toFixed(6))
              setLng(lngLat.lng.toFixed(6))
            })
            markerRef.current = marker
          }
        })

        miniMapInstance.current = map
      } catch {
        // Mapbox not available — silent fail, manual input still works
      }
    }
    init()
    return () => { if (map) try { map.remove() } catch {} }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Geocode — autocomplete with Nominatim + Mapbox
  const [geocodeResults, setGeocodeResults] = useState<import('@/lib/geocoding').GeocodingResult[]>([])
  const [showGeocodeDropdown, setShowGeocodeDropdown] = useState(false)
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced autocomplete on address change
  const handleAddressChange = useCallback((value: string) => {
    setAddress(value)
    setGeocodeMsg('')
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current)
    if (!value.trim() || value.trim().length < 3) {
      setGeocodeResults([])
      setShowGeocodeDropdown(false)
      return
    }
    geocodeTimer.current = setTimeout(async () => {
      setGeocoding(true)
      try {
        const { geocodeAddress } = await import('@/lib/geocoding')
        const results = await geocodeAddress(value)
        setGeocodeResults(results)
        setShowGeocodeDropdown(results.length > 0)
      } catch {
        setGeocodeResults([])
      } finally {
        setGeocoding(false)
      }
    }, 300)
  }, [])

  // Select a geocode result
  const selectGeoResult = useCallback(async (result: import('@/lib/geocoding').GeocodingResult) => {
    setLat(result.lat.toFixed(6))
    setLng(result.lng.toFixed(6))
    setGeocodeMsg(`✓ ${result.address}`)
    setShowGeocodeDropdown(false)
    // Fly map + update marker
    if (miniMapInstance.current) {
      miniMapInstance.current.flyTo({ center: [result.lng, result.lat], zoom: 16, duration: 800 })
      const { mapboxgl } = await import('@/lib/mapbox')
      if (markerRef.current) {
        markerRef.current.setLngLat([result.lng, result.lat])
      } else {
        const marker = new mapboxgl.Marker({ draggable: true, color: '#06b6d4' })
          .setLngLat([result.lng, result.lat])
          .addTo(miniMapInstance.current)
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat()
          setLat(lngLat.lat.toFixed(6))
          setLng(lngLat.lng.toFixed(6))
        })
        markerRef.current = marker
      }
    }
  }, [])

  // Manual search fallback
  const handleGeocode = useCallback(async () => {
    if (!address.trim()) { setGeocodeMsg('Nhập địa chỉ trước'); return }
    setGeocoding(true)
    setGeocodeMsg('')
    try {
      const { geocodeAddress } = await import('@/lib/geocoding')
      const results = await geocodeAddress(address)
      if (results.length > 0) {
        setGeocodeResults(results)
        setShowGeocodeDropdown(true)
      } else {
        setGeocodeMsg('Không tìm thấy toạ độ cho địa chỉ này')
      }
    } catch {
      setGeocodeMsg('Lỗi kết nối geocoding')
    } finally {
      setGeocoding(false)
    }
  }, [address])

  async function handleSubmit() {
    if (!name.trim() || !address.trim()) { setError('Tên và địa chỉ bắt buộc'); return }
    const payload = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim() || null,
      note: note.trim() || null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      route_id: routeId || null,
    }
    try {
      if (isEdit) {
        await updateLoc.mutateAsync({ id: location!.id, ...payload })
      } else {
        await createLoc.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(6,182,212,0.15)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {isEdit ? 'Sửa địa điểm' : '+ Thêm địa điểm mới'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        <label style={labelStyle}>Tên <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Kho ADC, Nhà A..." style={inputStyle} autoFocus />

        <label style={labelStyle}>Địa chỉ <span style={{ color: '#ef4444' }}>*</span></label>
        <div style={{ position: 'relative' }}>
          <input value={address} onChange={e => handleAddressChange(e.target.value)} placeholder="123 Nguyễn Văn Linh, Q.7" style={inputStyle} />
          {geocoding && <Loader size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: '#94a3b8' }} />}
          {/* Autocomplete dropdown */}
          {showGeocodeDropdown && geocodeResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 0 10px 10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
            }}>
              {geocodeResults.map(r => (
                <div
                  key={r.id}
                  onClick={() => selectGeoResult(r)}
                  style={{
                    padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8,
                    borderBottom: '1px solid #f1f5f9', fontSize: 12, fontFamily: 'Outfit, sans-serif',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{r.source === 'nominatim' ? '🗺️' : '📍'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</div>
                  </div>
                  <span style={{ fontSize: 9, color: '#cbd5e1', fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
                    {r.source === 'nominatim' ? 'OSM' : 'Mapbox'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <label style={labelStyle}>Số điện thoại</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901..." style={inputStyle} />

        {/* Coordinates — Geocode + Mini Map */}
        <label style={labelStyle}>
          Toạ độ
          <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>
            {lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : 'chưa có'}
          </span>
        </label>

        {/* Manual geocode button (fallback) */}
        <button
          onClick={handleGeocode}
          disabled={geocoding || !address.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '8px 12px', marginBottom: 8,
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 600, cursor: address.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'Outfit, sans-serif',
            opacity: address.trim() ? 1 : 0.5,
            boxShadow: '0 2px 6px rgba(6,182,212,0.25)',
          }}
        >
          {geocoding ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Crosshair size={13} />}
          {geocoding ? 'Đang tìm...' : '📍 Tìm toạ độ từ địa chỉ'}
        </button>
        {geocodeMsg && (
          <p style={{ fontSize: 11, color: geocodeMsg.startsWith('✓') ? '#059669' : '#d97706', marginBottom: 6 }}>
            {geocodeMsg}
          </p>
        )}

        {/* Mini map */}
        <div style={{
          width: '100%', height: 180, borderRadius: 10, overflow: 'hidden',
          border: '1px solid #e2e8f0', marginBottom: 4, position: 'relative',
          background: '#f1f5f9',
        }}>
          <div ref={miniMapRef} style={{ width: '100%', height: '100%' }} />
          {!miniMapInstance.current && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f1f5f9', fontSize: 12, color: '#94a3b8',
            }}>
              Đang tải bản đồ...
            </div>
          )}
        </div>
        <p style={{ fontSize: 10, color: '#cbd5e1', margin: '0 0 4px', textAlign: 'center' }}>
          Click để đặt · kéo marker để tinh chỉnh
        </p>

        {/* Manual inputs (collapsed) */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={lat} onChange={e => setLat(e.target.value)} placeholder="Vĩ độ (lat)" type="number" step="any" style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '6px 8px' }} />
          <input value={lng} onChange={e => setLng(e.target.value)} placeholder="Kinh độ (lng)" type="number" step="any" style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '6px 8px' }} />
        </div>

        {/* Route selector */}
        <label style={labelStyle}>Tuyến giao nhận</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setRouteId('')}
            style={{
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
              border: !routeId ? '2px solid #0f172a' : '1px solid #e2e8f0',
              background: !routeId ? '#f1f5f9' : '#fff',
              fontSize: 12, fontWeight: 500, color: '#475569', fontFamily: 'Outfit, sans-serif',
            }}
          >
            Không
          </button>
          {routes.map(r => (
            <button
              key={r.id}
              onClick={() => setRouteId(r.id)}
              style={{
                padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                border: routeId === r.id ? `2px solid ${r.color}` : '1px solid #e2e8f0',
                background: routeId === r.id ? `${r.color}18` : '#fff',
                fontSize: 12, fontWeight: 600, color: routeId === r.id ? r.color : '#475569',
                fontFamily: 'Outfit, sans-serif',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
              {r.name}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Ghi chú</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú thêm..." style={inputStyle} />

        {error && <p style={{ fontSize: 12, color: '#e11d48', marginTop: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#475569', fontFamily: 'Outfit, sans-serif' }}>Huỷ</button>
          <button
            onClick={handleSubmit}
            disabled={createLoc.isPending || updateLoc.isPending}
            style={{ flex: 2, padding: 10, border: 'none', borderRadius: 9, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 8px rgba(6,182,212,0.3)' }}
          >
            {(createLoc.isPending || updateLoc.isPending) ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : (
              <><Check size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Thêm địa điểm</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6, marginTop: 12 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, fontFamily: 'Outfit, sans-serif', color: '#1e293b', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}
