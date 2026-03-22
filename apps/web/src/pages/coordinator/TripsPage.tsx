import { useState, useMemo, useEffect } from 'react'
import { Truck, Calendar, ChevronDown, ChevronUp, Package, CheckCircle, Clock, CalendarRange, Navigation, Plus, X, Search } from 'lucide-react'
import { useTrips, TripFilters } from '@/hooks/useTrips'
import type { Trip, TripStatus, Order } from '@adc/shared-types'
import { supabase } from '@/lib/supabase'
import { calcOptimizedRoute, ordersToWaypointsWithPickup } from '@/lib/routeOptimizer'

// ── Status config ──────────────────────────────────────
const STATUS_CFG: Record<TripStatus, { label: string; bg: string; color: string; dot: string }> = {
  active:    { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed', dot: '#7c3aed' },
  completed: { label: 'Hoàn thành', bg: '#f0fdf4', color: '#059669', dot: '#059669' },
}

const ORDER_STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Chờ',       color: '#d97706' },
  assigned:   { label: 'Đã gán',    color: '#2563eb' },
  staging:    { label: 'Xếp chuyến',color: '#0891b2' },
  in_transit: { label: 'Đang giao', color: '#7c3aed' },
  delivered:  { label: 'Đã giao',   color: '#059669' },
  cancelled:  { label: 'Huỷ',       color: '#94a3b8' },
}

// ── Time helper ────────────────────────────────────────
type TimePeriod = 'today' | 'week' | 'month' | 'all' | 'custom'
function getDateRange(p: TimePeriod) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso  = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  if (p === 'today')  { const s = iso(now); return { from: `${s}T00:00:00`, to: `${s}T23:59:59` } }
  if (p === 'week')   { const d = new Date(now); d.setDate(now.getDate()-now.getDay()); return { from: `${iso(d)}T00:00:00`, to: `${iso(now)}T23:59:59` } }
  if (p === 'month')  { return { from: `${now.getFullYear()}-${pad(now.getMonth()+1)}-01T00:00:00`, to: `${iso(now)}T23:59:59` } }
  return {}
}

function durLabel(start?: string | null, end?: string | null) {
  if (!start) return null
  const from = new Date(start).getTime()
  const to   = end ? new Date(end).getTime() : Date.now()
  const m    = Math.round((to - from) / 60000)
  if (m < 60) return `${m} phút`
  return `${Math.floor(m/60)}h${m%60>0?` ${m%60}ph`:''}`
}

// ─────────────────────────────────────────────────────
export function TripsPage() {
  const [statusFilter, setStatusFilter] = useState<TripStatus | 'all'>('all')
  const [timePeriod,   setTimePeriod]   = useState<TimePeriod>('all')
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')

  const { from: dateFrom, to: dateTo } = useMemo(() => {
    if (timePeriod === 'custom') return {
      from: customFrom ? `${customFrom}T00:00:00` : undefined,
      to:   customTo   ? `${customTo}T23:59:59`   : undefined,
    }
    return getDateRange(timePeriod)
  }, [timePeriod, customFrom, customTo])

  const filters: TripFilters = { status: statusFilter, dateFrom, dateTo }
  const { data: trips = [], isLoading } = useTrips(filters)

  const activeCount    = trips.filter(t => t.status === 'active').length
  const completedCount = trips.filter(t => t.status === 'completed').length

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Chuyến đi</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{trips.length} chuyến</p>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng',        value: trips.length,    bg: '#f8fafc', color: '#475569' },
          { label: 'Đang giao',   value: activeCount,     bg: '#f3f0ff', color: '#7c3aed' },
          { label: 'Hoàn thành',  value: completedCount,  bg: '#f0fdf4', color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Time period filter */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <CalendarRange size={13} color="#94a3b8" style={{ marginRight: 2 }} />
          {(['today','week','month','all','custom'] as TimePeriod[]).map(p => {
            const labels: Record<TimePeriod, string> = { today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này', all: 'Toàn bộ', custom: 'Khoảng thời gian' }
            return (
              <button key={p} onClick={() => setTimePeriod(p)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                border: timePeriod === p ? 'none' : '1px solid #e2e8f0',
                background: timePeriod === p ? '#0891b2' : '#fff',
                color: timePeriod === p ? '#fff' : '#64748b',
              }}>{labels[p]}</button>
            )
          })}
        </div>
        {timePeriod === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Từ</span>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>đến</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }} />
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {([['all','Tất cả','#475569'],['active','Đang giao','#7c3aed'],['completed','Hoàn thành','#059669']] as const).map(([k, l, c]) => (
          <button key={k} onClick={() => setStatusFilter(k as TripStatus | 'all')} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', border: statusFilter === k ? 'none' : `1px solid #e2e8f0`,
            background: statusFilter === k ? c : '#fff', color: statusFilter === k ? '#fff' : c,
          }}>{l}</button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : trips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <Truck size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Chưa có chuyến đi nào trong khoảng này</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trips.map(trip => <TripCard key={trip.id} trip={trip} />)}
        </div>
      )}
    </div>
  )
}

// ── Trip Card ──────────────────────────────────────────
function TripCard({ trip }: { trip: Trip }) {
  const [expanded, setExpanded] = useState(false)
  const [addOrderOpen, setAddOrderOpen] = useState(false)
  const status  = STATUS_CFG[trip.status] ?? STATUS_CFG.active
  const driver  = trip.driver
  const orders  = (trip.orders ?? []) as Order[]
  const delivered  = orders.filter(o => o.status === 'delivered').length
  const total      = orders.length
  const pct        = total > 0 ? Math.round((delivered / total) * 100) : 0
  const dur        = durLabel(trip.started_at, trip.completed_at)

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      overflow: 'hidden', transition: 'box-shadow 0.15s',
    }}>
      {/* Card header — clickable */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}
      >
        {/* Driver avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg, #ecfeff, #cffafe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {driver?.avatar_url
            ? <img src={driver.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Truck size={20} color="#0891b2" />
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
              {driver?.full_name ?? 'Chưa gán tài xế'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: status.bg, color: status.color }}>
              {status.label}
            </span>
          </div>

          {driver?.vehicle_plate && (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>🚗 {driver.vehicle_plate}</p>
          )}

          {/* Progress bar */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 3 }}>
              <span>{delivered}/{total} đơn hoàn thành</span>
              <span style={{ fontWeight: 600, color: pct === 100 ? '#059669' : '#7c3aed' }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 99,
                background: pct === 100
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>

          {/* Optimized route metrics */}
          {trip.optimized_distance_km != null && (
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#0891b2', fontWeight: 600 }}>
                <Navigation size={10} /> {trip.optimized_distance_km} km
              </span>
              {trip.optimized_duration_min != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#64748b' }}>
                  <Clock size={10} /> ~{trip.optimized_duration_min} phút
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right — time + expand + add-order button */}
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#cbd5e1' }}>
            <Calendar size={11} />
            {new Date(trip.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
          </div>
          {dur && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
              <Clock size={11} />
              {dur}
            </div>
          )}
          {trip.status === 'active' && (
            <button
              onClick={e => { e.stopPropagation(); setAddOrderOpen(true) }}
              title="Thêm đơn vào chuyến"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: '#0891b2', color: '#fff', fontSize: 11, fontWeight: 700,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              <Plus size={12} /> Thêm đơn
            </button>
          )}
          <div style={{ color: '#94a3b8', marginTop: 2 }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {/* Expandable order list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 18px 14px' }}>
          {orders.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Chuyến này chưa có đơn hàng</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {orders.map(o => {
                const oc = ORDER_STATUS_CFG[o.status] ?? { label: o.status, color: '#94a3b8' }
                const loc = (o as any).delivery_location
                return (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: '#f8fafc', borderRadius: 9,
                    border: '1px solid #f1f5f9',
                  }}>
                    {/* Proof photo */}
                    {o.proof_photo_url ? (
                      <img src={o.proof_photo_url} alt="proof" style={{ width: 36, height: 36, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 7, background: '#e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={16} color="#94a3b8" />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{o.code}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: `${oc.color}15`, color: oc.color }}>{oc.label}</span>
                      </div>
                      {loc?.name && (
                        <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          📍 {loc.name}
                        </p>
                      )}
                    </div>

                    {o.status === 'delivered' && (
                      <CheckCircle size={16} color="#059669" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Order Modal */}
      {addOrderOpen && (
        <AddOrderModal
          tripId={trip.id}
          driverId={(trip as any).driver_id ?? ''}
          onClose={() => setAddOrderOpen(false)}
        />
      )}
    </div>
  )
}

// ── AddOrderModal ────────────────────────────────────
interface AddOrderModalProps {
  tripId: string
  driverId: string
  onClose: () => void
}

function AddOrderModal({ tripId, driverId, onClose }: AddOrderModalProps) {
  const [search,    setSearch]    = useState('')
  const [orders,    setOrders]    = useState<any[]>([])
  const [loading,   setLoading]   = useState(false)
  const [adding,    setAdding]    = useState<string | null>(null)
  const [done,      setDone]      = useState<string[]>([])

  // Load pending orders
  useEffect(() => {
    setLoading(true)
    supabase.from('orders')
      .select(`
        id, code, note, created_at,
        delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, lat, lng)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setOrders(data ?? []); setLoading(false) })
  }, [])

  const filtered = orders.filter(o =>
    !done.includes(o.id) &&
    (o.code?.toLowerCase().includes(search.toLowerCase()) ||
     o.delivery_location?.name?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleAdd = async (order: any) => {
    setAdding(order.id)
    try {
      // 1. Assign order to trip
      await supabase.from('orders').update({
        status:      'in_transit',
        trip_id:     tripId,
        assigned_to: driverId,
      }).eq('id', order.id)

      // 2. Fetch all trip orders for route recalc
      const { data: tripOrders } = await supabase.from('orders')
        .select(`
          id, status,
          pickup_location:locations!orders_pickup_location_id_fkey(id, name, lat, lng),
          delivery_location:locations!orders_delivery_location_id_fkey(id, name, lat, lng)
        `)
        .eq('trip_id', tripId)
        .not('status', 'in', '(cancelled)')

      // 3. Recalc route — dùng pickup của đơn đầu làm điểm xuất phát
      if (tripOrders && tripOrders.length >= 1) {
        const waypoints = ordersToWaypointsWithPickup(tripOrders as any[])
        if (waypoints.length >= 2) {
          const result = await calcOptimizedRoute(waypoints)
          await supabase.from('trips').update({
            optimized_distance_km: result.optimized_distance_km,
            optimized_duration_min: result.optimized_duration_min,
          }).eq('id', tripId)
        }
      }

      setDone(d => [...d, order.id])
    } finally {
      setAdding(null)
    }
  }

  const F = { fontFamily: 'Outfit, sans-serif' }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 480,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 18px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} color="#0891b2" />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', ...F }}>Thêm đơn vào chuyến</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 10, padding: '8px 12px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã đơn hoặc địa điểm..."
              style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, color: '#0f172a', outline: 'none', ...F }}
            />
          </div>
        </div>

        {/* Order list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13, ...F }}>Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13, ...F }}>
              Không có đơn chờ nhận nào
            </div>
          ) : filtered.map(o => {
            const isDone = done.includes(o.id)
            const isAdding = adding === o.id
            return (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 8px', borderRadius: 10,
                background: isDone ? '#f0fdf4' : '#fff',
                border: isDone ? '1px solid #bbf7d0' : '1px solid transparent',
                marginBottom: 4, transition: 'all 0.15s',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{o.code}</span>
                  {o.delivery_location?.name && (
                    <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📍 {o.delivery_location.name}
                    </p>
                  )}
                </div>
                {isDone ? (
                  <CheckCircle size={18} color="#059669" style={{ flexShrink: 0 }} />
                ) : (
                  <button
                    onClick={() => handleAdd(o)}
                    disabled={isAdding}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      background: isAdding ? '#e2e8f0' : '#0891b2', color: '#fff',
                      fontSize: 11, fontWeight: 700, ...F, flexShrink: 0,
                    }}
                  >
                    {isAdding ? '...' : 'Thêm'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {done.length > 0 && (
          <div style={{
            padding: '12px 18px', borderTop: '1px solid #f1f5f9',
            color: '#059669', fontSize: 13, fontWeight: 600, ...F, textAlign: 'center'
          }}>
            ✓ Đã thêm {done.length} đơn • Tuyến được tính lại tự động
          </div>
        )}
      </div>
    </div>
  )
}
