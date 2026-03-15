import { useState } from 'react'
import { MapPin, Search, Plus, X, Check, Navigation } from 'lucide-react'
import { useLocations, useCreateLocation } from '@/hooks/useLocations'
import { useDeliveryRoutes } from '@/hooks/useDeliveryRoutes'

/**
 * SalesLocationsPage — Sales can view all locations and CREATE new ones.
 * No edit/delete buttons (those are coordinator-only).
 */
export function SalesLocationsPage() {
  const { data: locations = [], isLoading } = useLocations()
  const { data: routes = [] } = useDeliveryRoutes()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const filtered = search.trim()
    ? locations.filter(l =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.address.toLowerCase().includes(search.toLowerCase()) ||
        (l.phone ?? '').includes(search)
      )
    : locations

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 860 }}>
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
              <div key={loc.id} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: route ? `4px solid ${route.color}` : undefined,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: route ? `${route.color}18` : 'linear-gradient(135deg, #ecfeff, #cffafe)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={16} color={route?.color ?? '#0891b2'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{loc.name}</span>
                    {route && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: `${route.color}18`, color: route.color }}>
                        {route.name}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loc.address}
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                    {loc.phone && <span style={{ fontSize: 11, color: '#cbd5e1' }}>📞 {loc.phone}</span>}
                    {loc.lat && loc.lng && (
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                        <Navigation size={9} style={{ verticalAlign: -1, marginRight: 2 }} />
                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddLocationModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

function AddLocationModal({ onClose }: { onClose: () => void }) {
  const createLoc = useCreateLocation()
  const { data: routes = [] } = useDeliveryRoutes()
  const [name, setName]       = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone]     = useState('')
  const [note, setNote]       = useState('')
  const [routeId, setRouteId] = useState('')
  const [error, setError]     = useState('')

  async function handleSubmit() {
    if (!name.trim() || !address.trim()) { setError('Tên và địa chỉ bắt buộc'); return }
    try {
      await createLoc.mutateAsync({
        name: name.trim(), address: address.trim(),
        phone: phone.trim() || null, note: note.trim() || null,
        lat: null, lng: null, route_id: routeId || null,
      })
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
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(6,182,212,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>+ Thêm địa điểm mới</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        <label style={labelStyle}>Tên <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Kho ADC, Nhà A..." style={inputStyle} autoFocus />

        <label style={labelStyle}>Địa chỉ <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Nguyễn Văn Linh, Q.7" style={inputStyle} />

        <label style={labelStyle}>Số điện thoại</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901..." style={inputStyle} />

        {/* Route selector */}
        <label style={labelStyle}>Tuyến giao nhận</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setRouteId('')} style={{
            padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
            border: !routeId ? '2px solid #0f172a' : '1px solid #e2e8f0',
            background: !routeId ? '#f1f5f9' : '#fff',
            fontSize: 12, fontWeight: 500, color: '#475569', fontFamily: 'Outfit, sans-serif',
          }}>Không</button>
          {routes.map(r => (
            <button key={r.id} onClick={() => setRouteId(r.id)} style={{
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
              border: routeId === r.id ? `2px solid ${r.color}` : '1px solid #e2e8f0',
              background: routeId === r.id ? `${r.color}18` : '#fff',
              fontSize: 12, fontWeight: 600, color: routeId === r.id ? r.color : '#475569',
              fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
            }}>
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
            disabled={createLoc.isPending}
            style={{ flex: 2, padding: 10, border: 'none', borderRadius: 9, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 8px rgba(6,182,212,0.3)' }}
          >
            {createLoc.isPending ? 'Đang lưu...' : <><Check size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Thêm địa điểm</>}
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
