import { useState } from 'react'
import { Route, Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { useDeliveryRoutes, useCreateDeliveryRoute, useUpdateDeliveryRoute, useDeleteDeliveryRoute } from '@/hooks/useDeliveryRoutes'
import type { DeliveryRoute } from '@adc/shared-types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#14b8a6', '#8b5cf6', '#e11d48', '#0891b2', '#7c3aed',
]

export function DeliveryRoutesPage() {
  const { data: routes = [], isLoading } = useDeliveryRoutes()
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<DeliveryRoute | null>(null)

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Tuyến giao nhận</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{routes.length} tuyến · mã màu hiển thị trên bản đồ</p>
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
          <Plus size={14} /> Thêm tuyến
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : routes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Route size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: 14 }}>Chưa có tuyến nào</p>
          <p style={{ fontSize: 12 }}>Tạo tuyến để phân nhóm địa điểm theo khu vực</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {routes.map(route => (
            <RouteCard key={route.id} route={route} onEdit={() => setEditing(route)} />
          ))}
        </div>
      )}

      {(showAdd || editing) && (
        <RouteModal route={editing} onClose={() => { setShowAdd(false); setEditing(null) }} />
      )}
    </div>
  )
}

function RouteCard({ route, onEdit }: { route: DeliveryRoute; onEdit: () => void }) {
  const deleteRoute = useDeleteDeliveryRoute()
  const [confirming, setConfirming] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      borderLeft: `4px solid ${route.color}`,
    }}>
      {/* Color dot */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: route.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 2px 8px ${route.color}40`,
      }}>
        <Route size={16} color="#fff" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{route.name}</span>
        {route.description && (
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{route.description}</p>
        )}
      </div>

      {confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#e11d48' }}>Xoá?</span>
          <button
            onClick={async () => { await deleteRoute.mutateAsync(route.id); setConfirming(false) }}
            disabled={deleteRoute.isPending}
            style={{ padding: '4px 8px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >
            {deleteRoute.isPending ? '...' : 'OK'}
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

function RouteModal({ route, onClose }: { route: DeliveryRoute | null; onClose: () => void }) {
  const isEdit = !!route
  const createRoute = useCreateDeliveryRoute()
  const updateRoute = useUpdateDeliveryRoute()
  const [name, setName]         = useState(route?.name ?? '')
  const [color, setColor]       = useState(route?.color ?? '#06b6d4')
  const [desc, setDesc]         = useState(route?.description ?? '')
  const [error, setError]       = useState('')

  async function handleSubmit() {
    if (!name.trim()) { setError('Tên tuyến bắt buộc'); return }
    try {
      if (isEdit) {
        await updateRoute.mutateAsync({ id: route!.id, name: name.trim(), color, description: desc.trim() || null })
      } else {
        await createRoute.mutateAsync({ name: name.trim(), color, description: desc.trim() || null })
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
        borderRadius: 16, padding: 28, width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid rgba(6,182,212,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            {isEdit ? 'Sửa tuyến' : '+ Thêm tuyến mới'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        <label style={labelStyle}>Tên tuyến <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Tuyến Quận 7, Tuyến Bình Thạnh..." style={inputStyle} autoFocus />

        <label style={labelStyle}>Mô tả</label>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Khu vực phụ trách..." style={inputStyle} />

        <label style={labelStyle}>Mã màu</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: c,
                border: color === c ? '3px solid #0f172a' : '2px solid transparent',
                cursor: 'pointer', boxShadow: color === c ? `0 0 0 2px ${c}40` : 'none',
                transition: 'all 0.1s',
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: color }} />
          <input
            value={color}
            onChange={e => setColor(e.target.value)}
            style={{ ...inputStyle, width: 100 }}
          />
        </div>

        {error && <p style={{ fontSize: 12, color: '#e11d48', marginTop: 8 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 10, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#475569', fontFamily: 'Outfit, sans-serif' }}>Huỷ</button>
          <button
            onClick={handleSubmit}
            disabled={createRoute.isPending || updateRoute.isPending}
            style={{ flex: 2, padding: 10, border: 'none', borderRadius: 9, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 8px rgba(6,182,212,0.3)' }}
          >
            {(createRoute.isPending || updateRoute.isPending) ? '...' : isEdit ? 'Lưu thay đổi' : (
              <><Check size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Thêm tuyến</>
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
