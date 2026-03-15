import { useState, useRef, useEffect } from 'react'
import { Plus, MapPin, Package, Send, FileText, Calendar, X, Check } from 'lucide-react'
import { useLocationSearch, useRecentLocations, useCreateLocation } from '@/hooks/useLocations'
import { useCreateOrder } from '@/hooks/useOrders'
import type { Location, OrderType } from '@adc/shared-types'

interface CreateOrderPanelProps {
  onClose: () => void
}

export function CreateOrderPanel({ onClose }: CreateOrderPanelProps) {
  const createOrder = useCreateOrder()
  const [pickupId, setPickupId]     = useState<string | null>(null)
  const [pickupLabel, setPickupLabel] = useState('')
  const [deliveryId, setDeliveryId] = useState<string | null>(null)
  const [deliveryLabel, setDeliveryLabel] = useState('')
  const [note, setNote]             = useState('')
  const [type, setType]             = useState<OrderType>('delivery')
  const [successCount, setSuccessCount] = useState(0)
  const [error, setError]           = useState('')
  const deliveryRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(continueMode: boolean) {
    if (!pickupId || !deliveryId) {
      setError('Vui lòng chọn cả nơi lấy và nơi giao')
      return
    }
    setError('')
    try {
      await createOrder.mutateAsync({
        pickup_location_id: pickupId,
        delivery_location_id: deliveryId,
        type,
        note: note.trim() || undefined,
      })
      setSuccessCount(c => c + 1)

      if (continueMode) {
        // Keep pickup, reset delivery + note for rapid creation
        setDeliveryId(null)
        setDeliveryLabel('')
        setNote('')
        deliveryRef.current?.focus()
      } else {
        onClose()
      }
    } catch (err) {
      setError((err as Error).message ?? 'Lỗi tạo đơn')
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 400, maxWidth: '100vw',
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(20px)',
      boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      borderLeft: '1px solid rgba(6,182,212,0.15)',
      display: 'flex', flexDirection: 'column',
      zIndex: 50, fontFamily: 'Outfit, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={15} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Tạo đơn nhanh</h2>
            {successCount > 0 && (
              <span style={{ fontSize: 11, color: '#059669' }}>✓ Đã tạo {successCount} đơn</span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Pickup */}
        <FieldLabel icon={<MapPin size={13} color="#06b6d4" />} label="Nơi lấy hàng" required />
        <LocationPicker
          value={pickupLabel}
          selectedId={pickupId}
          onSelect={(loc) => { setPickupId(loc.id); setPickupLabel(loc.name) }}
          placeholder="Tìm kho, cửa hàng..."
          autoFocus
        />

        <div style={{ height: 16 }} />

        {/* Delivery */}
        <FieldLabel icon={<Send size={13} color="#d97706" />} label="Nơi giao hàng" required />
        <LocationPicker
          ref={deliveryRef}
          value={deliveryLabel}
          selectedId={deliveryId}
          onSelect={(loc) => { setDeliveryId(loc.id); setDeliveryLabel(loc.name) }}
          placeholder="Tìm khách hàng, địa chỉ..."
        />

        <div style={{ height: 16 }} />

        {/* Note */}
        <FieldLabel icon={<FileText size={13} color="#94a3b8" />} label="Ghi chú" />
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Nhập ghi chú cho đơn hàng..."
          style={inputStyle}
        />

        <div style={{ height: 16 }} />

        {/* Type + Schedule row */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <FieldLabel icon={<Package size={13} color="#94a3b8" />} label="Loại đơn" />
            <select value={type} onChange={e => setType(e.target.value as OrderType)} style={inputStyle}>
              <option value="delivery">Giao hàng</option>
              <option value="pickup">Lấy hàng</option>
              <option value="mixed">Hỗn hợp</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel icon={<Calendar size={13} color="#94a3b8" />} label="Lịch" />
            <input type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={inputStyle} disabled />
          </div>
        </div>

        {error && <p style={{ fontSize: 12, color: '#e11d48', marginTop: 12 }}>{error}</p>}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
        <button
          onClick={() => handleSubmit(false)}
          disabled={createOrder.isPending}
          style={{
            flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: 9,
            background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            color: '#475569', fontWeight: 500,
          }}
        >
          <Check size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
          Tạo đơn
        </button>
        <button
          onClick={() => handleSubmit(true)}
          disabled={createOrder.isPending}
          style={{
            flex: 2, padding: '10px', border: 'none', borderRadius: 9,
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}
        >
          {createOrder.isPending ? 'Đang tạo...' : '⚡ Lưu & Tạo tiếp'}
        </button>
      </div>
    </div>
  )
}

// ─── Location Picker ──────────────────────────────────
import { forwardRef } from 'react'

interface LocationPickerProps {
  value: string
  selectedId: string | null
  onSelect: (loc: Location) => void
  placeholder?: string
  autoFocus?: boolean
}

const LocationPicker = forwardRef<HTMLInputElement, LocationPickerProps>(
  ({ value, selectedId, onSelect, placeholder, autoFocus }, ref) => {
    const [query, setQuery]     = useState(value)
    const [open, setOpen]       = useState(false)
    const [adding, setAdding]   = useState(false)
    const results               = useLocationSearch(query)
    const recent                = useRecentLocations(5)
    const createLoc             = useCreateLocation()
    const [newName, setNewName] = useState('')
    const [newAddr, setNewAddr] = useState('')

    useEffect(() => { setQuery(value) }, [value])

    const displayed = query.trim() ? results : recent

    async function handleAddNew() {
      if (!newName.trim() || !newAddr.trim()) return
      const loc = await createLoc.mutateAsync({ name: newName.trim(), address: newAddr.trim(), phone: null, lat: null, lng: null, note: null, route_id: null })
      onSelect(loc)
      setAdding(false)
      setOpen(false)
      setNewName('')
      setNewAddr('')
    }

    return (
      <div style={{ position: 'relative' }}>
        <input
          ref={ref}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); if (selectedId) onSelect({ id: '' } as Location) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          style={{
            ...inputStyle,
            borderColor: selectedId ? '#06b6d4' : '#e2e8f0',
            background: selectedId ? '#ecfeff' : '#fff',
          }}
        />

        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)', marginTop: 4,
            maxHeight: 260, overflowY: 'auto',
          }}>
            {/* Results */}
            {displayed.length > 0 ? displayed.slice(0, 8).map(loc => (
              <button
                key={loc.id}
                onClick={() => {
                  onSelect(loc)
                  setQuery(loc.name)
                  setOpen(false)
                }}
                style={{
                  width: '100%', display: 'flex', flexDirection: 'column', gap: 1,
                  padding: '9px 14px', background: loc.id === selectedId ? '#ecfeff' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{loc.name}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{loc.address}</span>
              </button>
            )) : (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                Không tìm thấy
              </div>
            )}

            {/* Add New */}
            {!adding ? (
              <button
                onClick={() => setAdding(true)}
                style={{
                  width: '100%', padding: '10px 14px', background: '#f8fafc',
                  border: 'none', borderTop: '1px solid #e2e8f0', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: '#06b6d4', fontWeight: 600, fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Plus size={13} /> Thêm địa điểm mới
              </button>
            ) : (
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Tên địa điểm *"
                  autoFocus
                  style={{ ...inputStyle, fontSize: 12, padding: '7px 10px', marginBottom: 6 }}
                />
                <input
                  value={newAddr}
                  onChange={e => setNewAddr(e.target.value)}
                  placeholder="Địa chỉ *"
                  style={{ ...inputStyle, fontSize: 12, padding: '7px 10px', marginBottom: 8 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNew() }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setAdding(false)} style={{ flex: 1, padding: 6, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', fontSize: 11, cursor: 'pointer' }}>Huỷ</button>
                  <button onClick={handleAddNew} disabled={createLoc.isPending} style={{ flex: 2, padding: 6, border: 'none', borderRadius: 6, background: '#06b6d4', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {createLoc.isPending ? '...' : 'Thêm'}
                  </button>
                </div>
              </div>
            )}

            {/* Close overlay */}
            <button
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'transparent',
                border: 'none', zIndex: -1, cursor: 'default',
              }}
            />
          </div>
        )}
      </div>
    )
  }
)
LocationPicker.displayName = 'LocationPicker'

// ─── Shared ───────────────────────────────────────────
function FieldLabel({ icon, label, required }: { icon: React.ReactNode; label: string; required?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
      {icon} {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #e2e8f0', borderRadius: 9,
  fontSize: 13, fontFamily: 'Outfit, sans-serif',
  color: '#1e293b', background: '#fff',
  outline: 'none', boxSizing: 'border-box',
}
