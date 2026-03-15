import { useState } from 'react'
import {
  Package, Clock, Truck, CheckCircle,
  Phone, XCircle,
} from 'lucide-react'
import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders'
import { useAuthStore } from '@/stores/authStore'
import { OrderDetailModal } from '@/components/order/OrderDetailModal'
import { supabase } from '@/lib/supabase'
import type { Order, OrderStatus } from '@adc/shared-types'

const MY_TABS: { key: 'active' | 'delivered' | 'all'; label: string }[] = [
  { key: 'active',    label: 'Đang giao' },
  { key: 'delivered', label: 'Đã giao' },
  { key: 'all',       label: 'Tất cả' },
]

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Chờ xử lý', bg: '#fffbeb', color: '#d97706', icon: <Clock size={11} /> },
  assigned:   { label: 'Đã gán',    bg: '#eff6ff', color: '#2563eb', icon: <Package size={11} /> },
  in_transit: { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed', icon: <Truck size={11} /> },
  delivered:  { label: 'Đã giao',   bg: '#f0fdf4', color: '#059669', icon: <CheckCircle size={11} /> },
  cancelled:  { label: 'Đã huỷ',   bg: '#f8fafc', color: '#94a3b8', icon: <XCircle size={11} /> },
}

export function DeliveryOrdersPage() {
  const { profile } = useAuthStore()
  const { data: allOrders = [], isLoading, refetch } = useOrders()
  const updateStatus = useUpdateOrderStatus()
  const [myTab, setMyTab] = useState<'active' | 'delivered' | 'all'>('active')
  const [accepting, setAccepting] = useState<string | null>(null)
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)

  // Reason modal state
  const [reasonModal, setReasonModal] = useState<{
    orderId: string
    type: 'reject' | 'unsuccessful'
  } | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const myId = profile?.id

  // Pending orders that are unassigned → available to accept
  const availableOrders = allOrders.filter(o => o.status === 'pending' && !o.assigned_to)

  // My orders (assigned to me)
  const myOrders = allOrders.filter(o => o.assigned_to === myId)
  const filteredMyOrders = myTab === 'all'
    ? myOrders
    : myTab === 'active'
      ? myOrders.filter(o => ['assigned', 'in_transit'].includes(o.status))
      : myOrders.filter(o => o.status === 'delivered')

  // Accept an order
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

  // Update order status (assigned → in_transit → delivered)
  async function handleStatusUpdate(orderId: string, newStatus: OrderStatus) {
    try {
      await updateStatus.mutateAsync({ orderId, status: newStatus })
    } catch (err) {
      console.error('Status update failed:', err)
    }
  }

  // Reject or return order to pending with reason
  async function handleReasonSubmit() {
    if (!reasonModal || !reason.trim()) return
    setSubmitting(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status: 'pending',
          assigned_to: null,
          rejection_note: reason.trim(),
        })
        .eq('id', reasonModal.orderId)

      if (error) throw error
      await refetch()
      setReasonModal(null)
      setReason('')
    } catch (err) {
      console.error('Reject/return failed:', err)
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
      {/* ── Available orders ───────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={18} color="#d97706" /> Đơn hàng chờ nhận
        </h2>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>{availableOrders.length} đơn chờ giao nhận</p>

        {availableOrders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
            color: '#94a3b8', fontSize: 13,
          }}>
            🎉 Không có đơn nào chờ nhận
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableOrders.map(order => (
              <div key={order.id} onClick={() => setDetailOrder(order)} style={{
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
                      <RoutePoint color="#06b6d4" label={order.pickup_location?.name ?? '—'} address={order.pickup_location?.address} />
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
                      background: accepting === order.id ? '#94a3b8' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
                      color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                      cursor: accepting === order.id ? 'wait' : 'pointer',
                      fontFamily: 'Outfit, sans-serif',
                      boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    {accepting === order.id ? '⏳...' : '✋ Nhận đơn'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 10, color: '#cbd5e1' }}>
                  <span>{new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My orders ──────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Truck size={18} color="#2563eb" /> Đơn của tôi
        </h2>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>{myOrders.length} đơn đã nhận</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {MY_TABS.map(t => {
            const count = t.key === 'all'
              ? myOrders.length
              : t.key === 'active'
                ? myOrders.filter(o => ['assigned', 'in_transit'].includes(o.status)).length
                : myOrders.filter(o => o.status === 'delivered').length
            return (
              <button
                key={t.key}
                onClick={() => setMyTab(t.key)}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  border: myTab === t.key ? 'none' : '1px solid #e2e8f0',
                  background: myTab === t.key ? '#2563eb' : '#fff',
                  color: myTab === t.key ? '#fff' : '#475569',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {t.label} ({count})
              </button>
            )
          })}
        </div>

        {filteredMyOrders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
            color: '#94a3b8', fontSize: 13,
          }}>
            {myTab === 'active' ? 'Không có đơn đang giao' : myTab === 'delivered' ? 'Chưa giao xong đơn nào' : 'Chưa nhận đơn nào'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredMyOrders.map(order => {
              const status = STATUS_MAP[order.status] ?? STATUS_MAP.assigned
              const canStartDelivery = order.status === 'assigned'
              const canComplete = order.status === 'in_transit'
              const canReject = order.status === 'assigned'

              return (
                <div key={order.id} onClick={() => setDetailOrder(order)} style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                  padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  borderLeft: `4px solid ${status.color}`, cursor: 'pointer', transition: 'box-shadow 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{order.code}</code>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: status.bg, color: status.color,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                        {status.icon} {status.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#cbd5e1' }}>
                      {new Date(order.created_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <RoutePoint color="#06b6d4" label={order.pickup_location?.name ?? '—'} address={order.pickup_location?.address} phone={order.pickup_location?.phone} />
                    <div style={{ width: 1, height: 8, background: '#e2e8f0', marginLeft: 3.5 }} />
                    <RoutePoint color="#d97706" label={order.delivery_location?.name ?? '—'} address={order.delivery_location?.address} phone={order.delivery_location?.phone} />
                  </div>

                  {order.note && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>📝 {order.note}</p>}

                  {/* Action buttons */}
                  {canStartDelivery && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'in_transit') }}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 9,
                          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                          color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Truck size={14} /> Bắt đầu giao
                      </button>
                      {canReject && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setReasonModal({ orderId: order.id, type: 'reject' }); setReason('') }}
                          style={{
                            padding: '10px 14px', borderRadius: 9,
                            background: '#fff1f2', color: '#e11d48',
                            border: '1px solid rgba(225,29,72,0.15)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            fontFamily: 'Outfit, sans-serif',
                          }}
                        >
                          Từ chối
                        </button>
                      )}
                    </div>
                  )}

                  {canComplete && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, 'delivered') }}
                        style={{
                          flex: 1, padding: '10px', borderRadius: 9,
                          background: 'linear-gradient(135deg, #059669, #047857)',
                          color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <CheckCircle size={14} /> Đã giao xong
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setReasonModal({ orderId: order.id, type: 'unsuccessful' }); setReason('') }}
                        style={{
                          padding: '10px 14px', borderRadius: 9,
                          background: '#fff7ed', color: '#c2410c',
                          border: '1px solid rgba(194,65,12,0.15)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'Outfit, sans-serif',
                        }}
                      >
                        Không thành công
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Reason Modal ──────────────────────────────── */}
      {reasonModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 16,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            border: `1px solid ${reasonModal.type === 'reject' ? 'rgba(225,29,72,0.15)' : 'rgba(194,65,12,0.15)'}`,
          }}>
            <h3 style={{
              fontSize: 16, fontWeight: 700, margin: '0 0 4px',
              color: reasonModal.type === 'reject' ? '#e11d48' : '#c2410c',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {reasonModal.type === 'reject' ? (
                <><XCircle size={18} /> Từ chối đơn hàng</>
              ) : (
                <><XCircle size={18} /> Giao không thành công</>
              )}
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
              placeholder={reasonModal.type === 'reject' ? 'Ví dụ: Không thể đến khu vực này...' : 'Ví dụ: Khách hàng không liên lạc được...'}
              rows={3}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #e2e8f0', borderRadius: 9,
                fontSize: 13, fontFamily: 'Outfit, sans-serif',
                color: '#1e293b', background: '#fff',
                outline: 'none', boxSizing: 'border-box',
                resize: 'vertical',
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
                  background: !reason.trim()
                    ? '#e2e8f0'
                    : reasonModal.type === 'reject'
                      ? 'linear-gradient(135deg, #e11d48, #be123c)'
                      : 'linear-gradient(135deg, #c2410c, #9a3412)',
                  color: !reason.trim() ? '#94a3b8' : '#fff',
                  fontSize: 13, fontWeight: 600, cursor: !reason.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                {submitting ? 'Đang xử lý...' : reasonModal.type === 'reject' ? 'Xác nhận từ chối' : 'Xác nhận'}
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

// ─── Helper ──────────────────────────────────────────────
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
