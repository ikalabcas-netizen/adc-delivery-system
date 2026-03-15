import { useState } from 'react'
import { MapPin, Search, Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '@/hooks/useLocations'
import type { Location } from '@adc/shared-types'

export function LocationsPage() {
  const { data: locations = [], isLoading } = useLocations()
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
          {filtered.map(loc => (
            <LocationCard
              key={loc.id}
              location={loc}
              onEdit={() => setEditing(loc)}
            />
          ))}
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

function LocationCard({ location, onEdit }: { location: Location; onEdit: () => void }) {
  const deleteLocation = useDeleteLocation()
  const [confirming, setConfirming] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, #ecfeff, #cffafe)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <MapPin size={16} color="#0891b2" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{location.name}</span>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {location.address}
        </p>
        {location.phone && (
          <p style={{ fontSize: 11, color: '#cbd5e1', margin: '1px 0 0' }}>📞 {location.phone}</p>
        )}
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
  const [name, setName]       = useState(location?.name ?? '')
  const [address, setAddress] = useState(location?.address ?? '')
  const [phone, setPhone]     = useState(location?.phone ?? '')
  const [note, setNote]       = useState(location?.note ?? '')
  const [error, setError]     = useState('')

  async function handleSubmit() {
    if (!name.trim() || !address.trim()) { setError('Tên và địa chỉ bắt buộc'); return }
    try {
      if (isEdit) {
        await updateLoc.mutateAsync({ id: location!.id, name: name.trim(), address: address.trim(), phone: phone.trim() || null, note: note.trim() || null })
      } else {
        await createLoc.mutateAsync({ name: name.trim(), address: address.trim(), phone: phone.trim() || null, lat: null, lng: null, note: note.trim() || null })
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
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(6,182,212,0.15)',
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
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Nguyễn Văn Linh, Q.7" style={inputStyle} />

        <label style={labelStyle}>Số điện thoại</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901..." style={inputStyle} />

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
