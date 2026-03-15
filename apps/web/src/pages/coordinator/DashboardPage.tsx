import { useMemo } from 'react'
import {
  Package, MapPin, Truck, Users, GitBranchPlus,
  Clock, CheckCircle, XCircle, UserPlus,
  TrendingUp, Activity, BarChart3,
} from 'lucide-react'
import { useOrders } from '@/hooks/useOrders'
import { useLocations } from '@/hooks/useLocations'
import { useDeliveryRoutes } from '@/hooks/useDeliveryRoutes'
import { useDeliveryDrivers } from '@/hooks/useOrders'

export function DashboardPage() {
  const { data: orders = [], isLoading: loadO } = useOrders()
  const { data: locations = [], isLoading: loadL } = useLocations()
  const { data: routes = [] } = useDeliveryRoutes()
  const { data: drivers = [] } = useDeliveryDrivers()

  // ── Computed stats ──────────────────────────────────
  const stats = useMemo(() => {
    const byStatus = {
      pending:    orders.filter(o => o.status === 'pending').length,
      assigned:   orders.filter(o => o.status === 'assigned').length,
      in_transit: orders.filter(o => o.status === 'in_transit').length,
      delivered:  orders.filter(o => o.status === 'delivered').length,

      cancelled:  orders.filter(o => o.status === 'cancelled').length,
    }

    const today = new Date().toISOString().slice(0, 10)
    const todayOrders = orders.filter(o => o.created_at?.slice(0, 10) === today)
    const todayDelivered = orders.filter(o => o.status === 'delivered' && o.delivered_at?.slice(0, 10) === today)

    const locsWithCoords = locations.filter(l => l.lat && l.lng).length
    const locsWithRoute = locations.filter(l => l.route_id).length

    const activeDrivers = new Set(
      orders.filter(o => ['assigned', 'in_transit'].includes(o.status) && o.assigned_to)
        .map(o => o.assigned_to)
    ).size

    // Orders per route
    const routeStats = routes.map(r => {
      const routeLocs = locations.filter(l => l.route_id === r.id)
      const routeLocIds = new Set(routeLocs.map(l => l.id))
      const routeOrders = orders.filter(o =>
        routeLocIds.has(o.pickup_location_id) || routeLocIds.has(o.delivery_location_id)
      )
      return { ...r, locationCount: routeLocs.length, orderCount: routeOrders.length }
    })

    return { byStatus, todayOrders, todayDelivered, locsWithCoords, locsWithRoute, activeDrivers, routeStats }
  }, [orders, locations, routes])

  const isLoading = loadO || loadL

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Đang tải dữ liệu...</p>
      </div>
    )
  }

  const successRate = orders.length > 0
    ? Math.round((stats.byStatus.delivered / orders.length) * 100)
    : 0

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={22} color="#06b6d4" /> Dashboard
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Tổng quan hệ thống · {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── KPI Cards ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard icon={<Package size={18} />} label="Tổng đơn hàng" value={orders.length} color="#06b6d4" />
        <KpiCard icon={<TrendingUp size={18} />} label="Đơn hôm nay" value={stats.todayOrders.length} color="#8b5cf6" />
        <KpiCard icon={<CheckCircle size={18} />} label="Đã giao hôm nay" value={stats.todayDelivered.length} color="#059669" />
        <KpiCard icon={<Activity size={18} />} label="Tỷ lệ thành công" value={`${successRate}%`} color="#f59e0b" />
        <KpiCard icon={<MapPin size={18} />} label="Địa điểm" value={locations.length} color="#0891b2" sub={`${stats.locsWithCoords} có toạ độ`} />
        <KpiCard icon={<Users size={18} />} label="Giao nhận" value={drivers.length} color="#2563eb" sub={`${stats.activeDrivers} đang hoạt động`} />
        <KpiCard icon={<GitBranchPlus size={18} />} label="Tuyến GN" value={routes.length} color="#e11d48" sub={`${stats.locsWithRoute} đ.điểm gán tuyến`} />
      </div>

      {/* ── Order Status Breakdown ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Status bars */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: 20,
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={14} color="#06b6d4" /> Trạng thái đơn hàng
          </h3>
          <StatusBar label="Chờ xử lý" value={stats.byStatus.pending} total={orders.length} color="#d97706" icon={<Clock size={12} />} />
          <StatusBar label="Đã gán" value={stats.byStatus.assigned} total={orders.length} color="#2563eb" icon={<UserPlus size={12} />} />
          <StatusBar label="Đang giao" value={stats.byStatus.in_transit} total={orders.length} color="#7c3aed" icon={<Truck size={12} />} />
          <StatusBar label="Đã giao" value={stats.byStatus.delivered} total={orders.length} color="#059669" icon={<CheckCircle size={12} />} />

          <StatusBar label="Đã huỷ" value={stats.byStatus.cancelled} total={orders.length} color="#94a3b8" icon={<XCircle size={12} />} />
        </div>

        {/* Route breakdown */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: 20,
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranchPlus size={14} color="#e11d48" /> Tuyến giao nhận
          </h3>
          {stats.routeStats.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Chưa có tuyến nào</p>
          ) : (
            stats.routeStats.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{r.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{r.locationCount} đ.điểm</span>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{r.orderCount} đơn</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Recent Orders ──────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 20,
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={14} color="#d97706" /> Đơn hàng gần đây
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                <th style={thStyle}>Mã</th>
                <th style={thStyle}>Lấy hàng</th>
                <th style={thStyle}>Giao hàng</th>
                <th style={thStyle}>Giao nhận</th>
                <th style={thStyle}>Trạng thái</th>
                <th style={thStyle}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map(order => {
                const status = STATUS_MAP[order.status]
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={tdStyle}><code style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>{order.code}</code></td>
                    <td style={tdStyle}>{order.pickup_location?.name ?? '—'}</td>
                    <td style={tdStyle}>{order.delivery_location?.name ?? '—'}</td>
                    <td style={tdStyle}>
                      {order.assigned_driver ? (
                        <span style={{ fontSize: 12, color: '#2563eb' }}>{order.assigned_driver.full_name}</span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: status.bg, color: status.color,
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#94a3b8', fontSize: 11 }}>
                      {new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )
              })}
              {orders.length === 0 && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }}>Chưa có đơn hàng</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Driver List ────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: 20, marginTop: 16,
        border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Truck size={14} color="#2563eb" /> Nhân viên giao nhận
        </h3>
        {drivers.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Chưa có giao nhận nào</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {drivers.map(d => {
              const activeOrders = orders.filter(o =>
                o.assigned_to === d.id && ['assigned', 'in_transit'].includes(o.status)
              ).length
              const delivered = orders.filter(o => o.assigned_to === d.id && o.status === 'delivered').length
              return (
                <div key={d.id} style={{
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid #e2e8f0', background: activeOrders > 0 ? '#f0f9ff' : '#fff',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: activeOrders > 0 ? '#dbeafe' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Users size={14} color={activeOrders > 0 ? '#2563eb' : '#94a3b8'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.full_name ?? 'Chưa có tên'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: activeOrders > 0 ? '#2563eb' : '#94a3b8' }}>
                        {activeOrders > 0 ? `⚡ ${activeOrders} đơn` : '💤 Rảnh'}
                      </span>
                      <span style={{ fontSize: 10, color: '#059669' }}>✓ {delivered}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────
function KpiCard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; sub?: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 16px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{label}</span>
      </div>
      <span style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</span>}
    </div>
  )
}

function StatusBar({ label, value, total, color, icon }: {
  label: string; value: number; total: number; color: string; icon: React.ReactNode
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color }}>{icon}</span> {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          width: `${pct}%`, transition: 'width 0.5s ease',
          minWidth: value > 0 ? 4 : 0,
        }} />
      </div>
    </div>
  )
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending:    { label: 'Chờ xử lý', bg: '#fffbeb', color: '#d97706' },
  assigned:   { label: 'Đã gán',    bg: '#eff6ff', color: '#2563eb' },
  in_transit: { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed' },
  delivered:  { label: 'Đã giao',   bg: '#f0fdf4', color: '#059669' },

  cancelled:  { label: 'Đã huỷ',   bg: '#f8fafc', color: '#94a3b8' },
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 600,
  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 10px', color: '#475569',
}
