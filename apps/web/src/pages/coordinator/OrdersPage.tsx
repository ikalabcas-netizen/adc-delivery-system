import { useState } from 'react'
import { Plus, Clock, Truck, CheckCircle, XCircle, Package, AlertTriangle, UserPlus, Edit2, Trash2, X, User } from 'lucide-react'
import { useOrders, useUpdateOrderStatus, useDeleteOrder, useDeliveryDrivers } from '@/hooks/useOrders'
import { CreateOrderPanel } from './CreateOrderPanel'
import type { Order, OrderStatus } from '@adc/shared-types'

const TABS: { key: OrderStatus | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all',        label: 'Tất cả',     icon: <Package size={13} />,       color: '#475569' },
  { key: 'pending',    label: 'Chờ xử lý',  icon: <Clock size={13} />,         color: '#d97706' },
  { key: 'assigned',   label: 'Đã gán',     icon: <UserPlus size={13} />,      color: '#2563eb' },
  { key: 'in_transit', label: 'Đang giao',  icon: <Truck size={13} />,         color: '#7c3aed' },
  { key: 'delivered',  label: 'Đã giao',    icon: <CheckCircle size={13} />,   color: '#059669' },

  { key: 'cancelled',  label: 'Huỷ',        icon: <XCircle size={13} />,       color: '#94a3b8' },
]

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Chờ xử lý', bg: '#fffbeb', color: '#d97706' },
  assigned:   { label: 'Đã gán',    bg: '#eff6ff', color: '#2563eb' },
  in_transit: { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed' },
  delivered:  { label: 'Đã giao',   bg: '#f0fdf4', color: '#059669' },

  cancelled:  { label: 'Đã huỷ',   bg: '#f8fafc', color: '#94a3b8' },
}

export function OrdersPage() {
  const [tab, setTab]                       = useState<OrderStatus | 'all'>('all')
  const [showCreate, setShowCreate]         = useState(false)
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null)
  const { data: allOrders = [], isLoading } = useOrders()

  const filtered = tab === 'all' ? allOrders : allOrders.filter(o => o.status === tab)

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Đơn hàng</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{allOrders.length} đơn</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}
        >
          <Plus size={14} /> Tạo đơn
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const count = t.key === 'all' ? allOrders.length : allOrders.filter(o => o.status === t.key).length
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 20,
                border: isActive ? 'none' : '1px solid #e2e8f0',
                background: isActive ? t.color : '#fff',
                color: isActive ? '#fff' : t.color,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {t.icon} {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
          {tab === 'all' ? 'Chưa có đơn hàng nào' : `Không có đơn "${STATUS_MAP[tab]?.label ?? tab}"`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onAssign={() => setAssigningOrder(order)}
            />
          ))}
        </div>
      )}

      {/* Create panel */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.3)', zIndex: 40 }} />
          <CreateOrderPanel onClose={() => setShowCreate(false)} />
        </>
      )}

      {/* Assign driver modal */}
      {assigningOrder && (
        <AssignDriverModal order={assigningOrder} onClose={() => setAssigningOrder(null)} />
      )}
    </div>
  )
}

// ─── Order Card with action buttons ───────────────────
function OrderCard({ order, onAssign }: { order: Order; onAssign: () => void }) {
  const status = STATUS_MAP[order.status] ?? STATUS_MAP.pending
  const pickup  = order.pickup_location
  const delivery = order.delivery_location
  const deleteOrder = useDeleteOrder()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: order.status === 'pending' ? '1px solid rgba(217,119,6,0.2)' : '1px solid #e2e8f0',
      padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        {/* Left — route info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{order.code}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>

          {/* Route visualization */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#06b6d4', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#475569' }}>{pickup?.name ?? '—'}</span>
            </div>
            <div style={{ width: 1, height: 12, background: '#e2e8f0', marginLeft: 3.5 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#475569' }}>{delivery?.name ?? '—'}</span>
            </div>
          </div>

          {order.note && (
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>📝 {order.note}</p>
          )}

          {/* Assigned driver info */}
          {order.assigned_driver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#f0f9ff', borderRadius: 8 }}>
              {order.assigned_driver.avatar_url ? (
                <img src={order.assigned_driver.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={11} color="#0891b2" />
                </div>
              )}
              <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>{order.assigned_driver.full_name}</span>
              {(order.assigned_driver as { vehicle_plate?: string }).vehicle_plate && (
                <span style={{ fontSize: 10, color: '#94a3b8' }}>🚗 {(order.assigned_driver as { vehicle_plate?: string }).vehicle_plate}</span>
              )}
            </div>
          )}
        </div>

        {/* Right — time + actions */}
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#cbd5e1' }}>
            {new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>

          {/* Action buttons based on status */}
          {order.status === 'pending' && !confirmDelete && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={onAssign} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
              }}>
                <UserPlus size={14} /> Gán giao nhận
              </button>
              <button title="Sửa" style={actionBtn('#475569', '#f8fafc')}>
                <Edit2 size={13} />
              </button>
              <button onClick={() => setConfirmDelete(true)} title="Xoá" style={actionBtn('#e11d48', '#fff1f2')}>
                <Trash2 size={13} />
              </button>
            </div>
          )}

          {order.status === 'assigned' && (
            <button onClick={onAssign} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            }}>
              <UserPlus size={14} /> Đổi giao nhận
            </button>
          )}

          {/* Inline delete confirm */}
          {confirmDelete && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#fff1f2', borderRadius: 8, border: '1px solid rgba(225,29,72,0.15)' }}>
              <AlertTriangle size={12} color="#e11d48" />
              <span style={{ fontSize: 11, color: '#e11d48' }}>Xoá?</span>
              <button
                onClick={async () => { await deleteOrder.mutateAsync(order.id); setConfirmDelete(false) }}
                disabled={deleteOrder.isPending}
                style={{ padding: '3px 8px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
              >
                {deleteOrder.isPending ? '...' : 'OK'}
              </button>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '3px 6px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 10 }}>Huỷ</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function actionBtn(color: string, bg: string): React.CSSProperties {
  return {
    padding: 7, background: bg, border: `1px solid ${color}22`,
    borderRadius: 7, cursor: 'pointer', color, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  }
}

// ─── Assign Driver Modal ──────────────────────────────
function AssignDriverModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { data: drivers = [], isLoading } = useDeliveryDrivers()
  const updateStatus = useUpdateOrderStatus()
  const [selected, setSelected] = useState<string | null>(order.assigned_to ?? null)

  async function handleAssign() {
    if (!selected) return
    await updateStatus.mutateAsync({
      orderId: order.id,
      status: 'assigned',
      assigned_to: selected,
    })
    onClose()
  }

  async function handleUnassign() {
    await updateStatus.mutateAsync({
      orderId: order.id,
      status: 'pending',
      assigned_to: null,
    })
    onClose()
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
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Gán giao nhận</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{order.code}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Route preview */}
        <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4' }} />
            <span style={{ fontSize: 12, color: '#475569' }}>{order.pickup_location?.name ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }} />
            <span style={{ fontSize: 12, color: '#475569' }}>{order.delivery_location?.name ?? '—'}</span>
          </div>
        </div>

        {/* Driver list */}
        <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Chọn nhân viên giao nhận</p>
        {isLoading ? (
          <p style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>Đang tải...</p>
        ) : drivers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>Chưa có nhân viên giao nhận</p>
        ) : (
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {drivers.map(d => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: selected === d.id ? '#ecfeff' : '#f8fafc',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  outline: selected === d.id ? '2px solid #06b6d4' : 'none',
                  transition: 'all 0.1s',
                }}
              >
                {d.avatar_url ? (
                  <img src={d.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #cffafe, #a5f3fc)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} color="#0891b2" />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', margin: 0 }}>{d.full_name ?? '—'}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                    {d.vehicle_plate ? `🚗 ${d.vehicle_plate}` : ''}{d.phone ? ` · ${d.phone}` : ''}
                  </p>
                </div>
                {selected === d.id && <CheckCircle size={16} color="#06b6d4" />}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', fontSize: 13, cursor: 'pointer', color: '#475569', fontFamily: 'Outfit, sans-serif' }}>Huỷ</button>
            <button
              onClick={handleAssign}
              disabled={!selected || updateStatus.isPending}
              style={{
                flex: 2, padding: 10, border: 'none', borderRadius: 9,
                background: selected ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : '#e2e8f0',
                color: selected ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
                fontFamily: 'Outfit, sans-serif',
                boxShadow: selected ? '0 2px 8px rgba(6,182,212,0.3)' : 'none',
              }}
            >
              {updateStatus.isPending ? 'Đang gán...' : '✓ Gán giao nhận'}
            </button>
          </div>
          {order.status === 'assigned' && (
            <button
              onClick={handleUnassign}
              disabled={updateStatus.isPending}
              style={{
                width: '100%', padding: 9, border: '1px solid rgba(225,29,72,0.2)', borderRadius: 9,
                background: '#fff1f2', color: '#e11d48', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <XCircle size={13} /> Huỷ gán — đưa về Chờ xử lý
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
