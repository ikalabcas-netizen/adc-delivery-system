import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Clock, Truck, CheckCircle,
  Phone, XCircle, Plus, ChevronRight, AlertCircle,
} from 'lucide-react'
import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders'
import { useAuthStore } from '@/stores/authStore'
import { OrderDetailModal } from '@/components/order/OrderDetailModal'
import { supabase } from '@/lib/supabase'
import type { Order } from '@adc/shared-types'

// ─── Status badge map ───────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Chờ xử lý', bg: '#fffbeb', color: '#d97706', icon: <Clock size={11} /> },
  assigned:   { label: 'Đã gán',    bg: '#ecfdf5', color: '#059669', icon: <Package size={11} /> },
  in_transit: { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed', icon: <Truck size={11} /> },
  delivered:  { label: 'Đã giao',   bg: '#f0fdf4', color: '#047857', icon: <CheckCircle size={11} /> },
  cancelled:  { label: 'Đã huỷ',   bg: '#f8fafc', color: '#94a3b8', icon: <XCircle size={11} /> },
}

export function DeliveryOrdersPage() {
  const navigate  = useNavigate()
  const { profile } = useAuthStore()
  const { data: allOrders = [], isLoading, refetch } = useOrders()
  const updateStatus = useUpdateOrderStatus()

  const [accepting,   setAccepting]   = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

  // Multi-select for trip creation
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creatingTrip, setCreatingTrip] = useState(false)

  // Reason modal
  const [reasonModal, setReasonModal] = useState<{ orderId: string; type: 'reject' | 'unsuccessful' } | null>(null)
  const [reason,      setReason]      = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  const myId = profile?.id

  // ── Derived order lists ─────────────────────────────────────
  // Available orders: pending + no assigned_to → can be accepted
  const availableOrders = allOrders.filter(o => o.status === 'pending' && !o.assigned_to)

  // My orders = assigned to me
  const myOrders = allOrders.filter(o => o.assigned_to === myId)

  // Assigned but not yet in a trip → can be selected to start a trip
  const assignedOrders = myOrders.filter(o => o.status === 'assigned')

  // Currently in transit (in an active trip)
  const inTransitOrders = myOrders.filter(o => o.status === 'in_transit')

  // Done
  const doneOrders = myOrders.filter(o => ['delivered', 'failed', 'cancelled'].includes(o.status))

  // ── Accept a single order ───────────────────────────────────
  async function handleAccept(orderId: string) {
    if (!myId) return
    setAccepting(orderId)
    try {
      await updateStatus.mutateAsync({ orderId, status: 'assigned', assigned_to: myId })
    } catch (err) {
      console.error('Accept failed:', err)
    }
    setAccepting(null)
  }

  // ── Toggle selection ────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Create and start a trip ─────────────────────────────────
  /**
   * Mirrors TripService.createAndStartTrip() from the mobile app:
   *  1. Insert trips row → status: 'active', started_at: now
   *  2. Update selected orders → trip_id, status: 'in_transit'
   *  3. Update driver_shifts → status_log: 'delivering'
   */
  async function handleStartTrip() {
    if (!myId || selected.size === 0) return
    const orderIds = [...selected]
    setCreatingTrip(true)
    try {
      // 1. Create trip
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .insert({
          driver_id:  myId,
          status:     'active',
          started_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (tripErr) throw tripErr

      // 2. Assign orders → in_transit
      const { error: ordersErr } = await supabase
        .from('orders')
        .update({ trip_id: trip.id, status: 'in_transit' })
        .in('id', orderIds)
      if (ordersErr) throw ordersErr

      // 3. Update driver shift status → delivering
      const { data: shiftRows } = await supabase
        .from('driver_shifts')
        .select('id, status_log')
        .eq('driver_id', myId)
        .eq('status', 'active')
        .order('started_at', { ascending: false })
        .limit(1)

      if (shiftRows && shiftRows.length > 0) {
        const shift = shiftRows[0]
        const log = [...(shift.status_log ?? []), { status: 'delivering', ts: new Date().toISOString() }]
        await supabase.from('driver_shifts').update({ status_log: log }).eq('id', shift.id)
        await supabase.from('profiles').update({ driver_status: 'delivering' }).eq('id', myId)
      }

      setSelected(new Set())
      await refetch()

      // Navigate to trip detail
      navigate(`/delivery/trips/${trip.id}`)
    } catch (err: any) {
      alert('Lỗi khi bắt đầu chuyến: ' + err.message)
    }
    setCreatingTrip(false)
  }

  // ── Reject / return order ─────────────────────────────────
  async function handleReasonSubmit() {
    if (!reasonModal || !reason.trim()) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'pending', assigned_to: null, rejection_note: reason.trim() })
        .eq('id', reasonModal.orderId)
      if (error) throw error
      await refetch()
      setReasonModal(null)
      setReason('')
    } catch (err) {
      console.error('Reject failed:', err)
    }
    setSubmitting(false)
  }

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Đang tải đơn hàng...</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 600 }}>

      {/* ── SECTION 1: Available (pending) orders ──────────── */}
      <SectionHeader icon={<Package size={17} color="#d97706" />} title="Đơn hàng chờ nhận" count={availableOrders.length} />
      {availableOrders.length === 0 ? (
        <EmptyCard message="🎉 Không có đơn nào chờ nhận" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {availableOrders.map(order => (
            <div
              key={order.id}
              onClick={() => setDetailOrder(order)}
              style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderLeft: '4px solid #d97706', cursor: 'pointer', transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <code style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{order.code}</code>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <RoutePoint color="#10b981" label={order.pickup_location?.name ?? '—'} address={order.pickup_location?.address} />
                    <div style={{ width: 1, height: 8, background: '#e2e8f0', marginLeft: 3.5 }} />
                    <RoutePoint color="#d97706" label={order.delivery_location?.name ?? '—'} address={order.delivery_location?.address} />
                  </div>
                  {order.note && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>📝 {order.note}</p>}
                  {order.rejection_note && (
                    <p style={{ fontSize: 11, color: '#e11d48', marginTop: 4, background: '#fff1f2', padding: '4px 8px', borderRadius: 6 }}>
                      ⚠️ Lý do trả lại: {order.rejection_note}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAccept(order.id) }}
                  disabled={accepting === order.id}
                  style={{
                    padding: '10px 18px', borderRadius: 10,
                    background: accepting === order.id ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                    cursor: accepting === order.id ? 'wait' : 'pointer',
                    fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                  }}
                >
                  {accepting === order.id ? '⏳...' : '✋ Nhận đơn'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6 }}>
                {new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SECTION 2: Assigned orders → select to start trip ── */}
      <SectionHeader
        icon={<Plus size={17} color="#059669" />}
        title="Gom đơn & Bắt đầu chuyến"
        count={assignedOrders.length}
        subtitle="Chọn các đơn muốn giao cùng 1 chuyến"
      />

      {assignedOrders.length === 0 ? (
        <EmptyCard message="Không có đơn trong kho — nhận đơn bên trên trước." />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {assignedOrders.map(order => {
              const isSel = selected.has(order.id)
              return (
                <div
                  key={order.id}
                  onClick={() => { toggleSelect(order.id); }}
                  style={{
                    background: isSel ? '#f0fdf4' : '#fff',
                    borderRadius: 12,
                    border: `1.5px solid ${isSel ? '#059669' : '#e2e8f0'}`,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: isSel ? '#059669' : '#fff',
                    border: `2px solid ${isSel ? '#059669' : '#cbd5e1'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}>
                    {isSel && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <code style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{order.code}</code>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <RoutePoint color="#10b981" label={order.pickup_location?.name ?? '—'} address={order.pickup_location?.address} phone={order.pickup_location?.phone} />
                      <div style={{ width: 1, height: 6, background: '#e2e8f0', marginLeft: 3.5 }} />
                      <RoutePoint color="#d97706" label={order.delivery_location?.name ?? '—'} address={order.delivery_location?.address} phone={order.delivery_location?.phone} />
                    </div>
                    {order.note && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>📝 {order.note}</p>}
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setDetailOrder(order) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: 4 }}
                    title="Xem chi tiết"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Start trip CTA */}
          {selected.size > 0 && (
            <div style={{
              position: 'sticky', bottom: 16, zIndex: 50, padding: '0 0 4px'
            }}>
              <button
                onClick={handleStartTrip}
                disabled={creatingTrip}
                style={{
                  width: '100%', padding: '15px',
                  background: creatingTrip ? '#94a3b8' : 'linear-gradient(135deg, #059669, #047857)',
                  color: '#fff', border: 'none', borderRadius: 14,
                  fontSize: 15, fontWeight: 700, cursor: creatingTrip ? 'wait' : 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(5,150,105,0.4)',
                }}
              >
                <Truck size={18} />
                {creatingTrip ? 'Đang tạo chuyến...' : `🚀 Bắt đầu chuyến với ${selected.size} đơn`}
              </button>
            </div>
          )}

          {selected.size === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10, background: '#f8fafc',
              border: '1px solid #e2e8f0', color: '#64748b', fontSize: 12, marginBottom: 28,
            }}>
              <AlertCircle size={14} color="#d97706" />
              Chọn ít nhất 1 đơn rồi bấm "Bắt đầu chuyến"
            </div>
          )}
        </>
      )}

      {/* ── SECTION 3: In-transit orders (link to trip) ─────── */}
      {inTransitOrders.length > 0 && (
        <>
          <SectionHeader icon={<Truck size={17} color="#7c3aed" />} title="Đang trong chuyến giao" count={inTransitOrders.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {inTransitOrders.map(order => (
              <div
                key={order.id}
                onClick={() => order.trip_id ? navigate(`/delivery/trips/${order.trip_id}`) : setDetailOrder(order)}
                style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #ede9fe',
                  padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: '4px solid #7c3aed',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <code style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{order.code}</code>
                    <StatusBadge status="in_transit" />
                  </div>
                  <RoutePoint color="#10b981" label={order.pickup_location?.name ?? '—'} address={order.pickup_location?.address} phone={order.pickup_location?.phone} />
                  <div style={{ width: 1, height: 6, background: '#e2e8f0', marginLeft: 3.5 }} />
                  <RoutePoint color="#d97706" label={order.delivery_location?.name ?? '—'} address={order.delivery_location?.address} phone={order.delivery_location?.phone} />
                </div>
                <ChevronRight size={18} color="#cbd5e1" />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── SECTION 4: Done orders ───────────────────────────── */}
      {doneOrders.length > 0 && (
        <>
          <SectionHeader icon={<CheckCircle size={17} color="#047857" />} title="Đã hoàn thành" count={doneOrders.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {doneOrders.slice(0, 10).map(order => {
              const s = STATUS_MAP[order.status] ?? STATUS_MAP.delivered
              return (
                <div
                  key={order.id}
                  onClick={() => setDetailOrder(order)}
                  style={{
                    background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                    padding: '12px 14px', cursor: 'pointer', opacity: 0.85,
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderLeft: `4px solid ${s.color}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <code style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{order.code}</code>
                      <StatusBadge status={order.status} />
                    </div>
                    <RoutePoint color="#94a3b8" label={order.delivery_location?.name ?? '—'} address={order.delivery_location?.address} />
                  </div>
                  <span style={{ fontSize: 10, color: '#cbd5e1', flexShrink: 0 }}>
                    {order.delivered_at
                      ? new Date(order.delivered_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Reason Modal ────────────────────────────────────── */}
      {reasonModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 16,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)', borderRadius: 16, padding: 24,
            width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            border: '1px solid rgba(225,29,72,0.15)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#e11d48', display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={18} />
              {reasonModal.type === 'reject' ? 'Từ chối đơn hàng' : 'Giao không thành công'}
            </h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>
              {reasonModal.type === 'reject'
                ? 'Đơn hàng sẽ được trả lại cho điều phối viên xử lý.'
                : 'Đơn hàng sẽ quay về trạng thái Chờ xử lý để điều phối xử lý tiếp.'
              }
            </p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Lý do <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ghi rõ lý do..."
              rows={3}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #e2e8f0', borderRadius: 9,
                fontSize: 13, fontFamily: 'Outfit, sans-serif',
                color: '#1e293b', background: '#fff',
                outline: 'none', boxSizing: 'border-box', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => { setReasonModal(null); setReason('') }}
                style={{
                  flex: 1, padding: 10, border: '1px solid #e2e8f0', borderRadius: 9,
                  background: '#fff', fontSize: 13, cursor: 'pointer', color: '#475569',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                Huỷ
              </button>
              <button
                onClick={handleReasonSubmit}
                disabled={!reason.trim() || submitting}
                style={{
                  flex: 2, padding: 10, border: 'none', borderRadius: 9,
                  background: !reason.trim() ? '#e2e8f0' : 'linear-gradient(135deg, #e11d48, #be123c)',
                  color: !reason.trim() ? '#94a3b8' : '#fff',
                  fontSize: 13, fontWeight: 600, cursor: !reason.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function SectionHeader({ icon, title, count, subtitle }: {
  icon: React.ReactNode; title: string; count: number; subtitle?: string
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon} {title}
        <span style={{
          fontSize: 12, fontWeight: 700, background: '#f1f5f9', color: '#475569',
          padding: '2px 8px', borderRadius: 20, marginLeft: 4,
        }}>{count}</span>
      </h2>
      {subtitle && <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>{subtitle}</p>}
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '24px 16px',
      background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
      color: '#94a3b8', fontSize: 13, marginBottom: 28,
    }}>
      {message}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.assigned
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color,
      display: 'inline-flex', alignItems: 'center', gap: 3,
    }}>
      {s.icon} {s.label}
    </span>
  )
}

function RoutePoint({ color, label, address, phone }: {
  color: string; label: string; address?: string | null; phone?: string | null
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 4, flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</span>
        {address && <p style={{ fontSize: 11, color: '#94a3b8', margin: '1px 0 0' }}>{address}</p>}
        {phone && (
          <a href={`tel:${phone}`} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Phone size={9} /> {phone}
          </a>
        )}
      </div>
    </div>
  )
}


