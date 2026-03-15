import { useState } from 'react'
import { Clock, Truck, CheckCircle, XCircle, Package, AlertTriangle, UserPlus, User } from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import type { Order, OrderStatus } from '@adc/shared-types'

const TABS: { key: OrderStatus | 'all'; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'all',        label: 'Tất cả',     icon: <Package size={13} />,       color: '#475569' },
  { key: 'pending',    label: 'Chờ xử lý',  icon: <Clock size={13} />,         color: '#d97706' },
  { key: 'assigned',   label: 'Đã gán',     icon: <UserPlus size={13} />,      color: '#2563eb' },
  { key: 'in_transit', label: 'Đang giao',  icon: <Truck size={13} />,         color: '#7c3aed' },
  { key: 'delivered',  label: 'Đã giao',    icon: <CheckCircle size={13} />,   color: '#059669' },
  { key: 'failed',     label: 'Thất bại',   icon: <AlertTriangle size={13} />, color: '#e11d48' },
  { key: 'cancelled',  label: 'Huỷ',        icon: <XCircle size={13} />,       color: '#94a3b8' },
]

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Chờ xử lý', bg: '#fffbeb', color: '#d97706' },
  assigned:   { label: 'Đã gán',    bg: '#eff6ff', color: '#2563eb' },
  in_transit: { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed' },
  delivered:  { label: 'Đã giao',   bg: '#f0fdf4', color: '#059669' },
  failed:     { label: 'Thất bại',  bg: '#fff1f2', color: '#e11d48' },
  cancelled:  { label: 'Đã huỷ',   bg: '#f8fafc', color: '#94a3b8' },
}

/**
 * SalesOrdersPage — Read-only order list for sales role.
 * No create, edit, delete, or assign buttons.
 */
export function SalesOrdersPage() {
  const [tab, setTab] = useState<OrderStatus | 'all'>('all')
  const { data: allOrders = [], isLoading } = useOrders()

  const filtered = tab === 'all' ? allOrders : allOrders.filter(o => o.status === tab)

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 900 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Đơn hàng</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{allOrders.length} đơn · chế độ xem</p>
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
            <ReadOnlyOrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReadOnlyOrderCard({ order }: { order: Order }) {
  const status = STATUS_MAP[order.status] ?? STATUS_MAP.pending
  const pickup = order.pickup_location
  const delivery = order.delivery_location

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid #e2e8f0',
      padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{order.code}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>

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
            </div>
          )}
        </div>

        <span style={{ fontSize: 11, color: '#cbd5e1', flexShrink: 0 }}>
          {new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
