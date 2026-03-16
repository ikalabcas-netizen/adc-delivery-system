/**
 * OrderDetailModal — Shared modal for viewing order details + event timeline.
 * Used across Coordinator, Sales, and Delivery modules.
 */
import { useEffect, useState } from 'react'
import {
  X, Clock, Package, Truck, CheckCircle, XCircle,
  MapPin, Phone, User, RotateCcw, ArrowRight, Route, Camera, Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Order } from '@adc/shared-types'

interface OrderEvent {
  id: string
  order_id: string
  actor_id: string | null
  event_type: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: { full_name: string | null } | null
}

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending:    { label: 'Chờ xử lý', bg: '#fffbeb', color: '#d97706', icon: <Clock size={12} /> },
  assigned:   { label: 'Đã gán',    bg: '#eff6ff', color: '#2563eb', icon: <Package size={12} /> },
  staging:    { label: 'Đang xếp chuyến', bg: '#ecfeff', color: '#0891b2', icon: <Route size={12} /> },
  in_transit: { label: 'Đang giao', bg: '#f3f0ff', color: '#7c3aed', icon: <Truck size={12} /> },
  delivered:  { label: 'Đã giao',   bg: '#f0fdf4', color: '#059669', icon: <CheckCircle size={12} /> },
  cancelled:  { label: 'Đã huỷ',   bg: '#f8fafc', color: '#94a3b8', icon: <XCircle size={12} /> },
}

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created:    { label: 'Tạo đơn',           color: '#06b6d4', icon: <Package size={13} /> },
  assigned:   { label: 'Gán giao nhận',     color: '#2563eb', icon: <User size={13} /> },
  in_transit: { label: 'Bắt đầu giao',     color: '#7c3aed', icon: <Truck size={13} /> },
  delivered:  { label: 'Giao thành công',   color: '#059669', icon: <CheckCircle size={13} /> },
  rejected:   { label: 'Từ chối / Trả lại', color: '#e11d48', icon: <RotateCcw size={13} /> },
  re_routed:  { label: 'Đổi giao nhận',    color: '#d97706', icon: <ArrowRight size={13} /> },
  cancelled:  { label: 'Huỷ đơn',          color: '#94a3b8', icon: <XCircle size={13} /> },
}

interface OrderDetailModalProps {
  order: Order | null
  onClose: () => void
}

export function OrderDetailModal({ order, onClose }: OrderDetailModalProps) {
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!order) return
    setLoading(true)
    supabase
      .from('order_events')
      .select('*, actor:profiles!order_events_actor_id_fkey(full_name)')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setEvents((data ?? []) as OrderEvent[])
        setLoading(false)
      })
  }, [order?.id])

  if (!order) return null

  const status = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          border: '1px solid rgba(6,182,212,0.12)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <code style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: 'Outfit, monospace' }}>{order.code}</code>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                background: status.bg, color: status.color,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>
                {status.icon} {status.label}
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
              {new Date(order.created_at).toLocaleString('vi-VN')}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={14} color="#64748b" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px' }}>

          {/* Route info */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 8 }}>
              Hành trình
            </div>
            <LocationInfo icon={<MapPin size={13} color="#06b6d4" />} label="Lấy hàng" location={order.pickup_location} />
            <div style={{ width: 1, height: 10, background: '#e2e8f0', marginLeft: 6, marginTop: 2, marginBottom: 2 }} />
            <LocationInfo icon={<MapPin size={13} color="#d97706" />} label="Giao hàng" location={order.delivery_location} />
          </div>

          {/* Driver info */}
          {order.assigned_driver && (
            <div style={{
              background: '#f8fafc', borderRadius: 10, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
              border: '1px solid #f1f5f9',
            }}>
              {order.assigned_driver.avatar_url
                ? <img src={order.assigned_driver.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={14} color="#0891b2" /></div>
              }
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: 0 }}>{order.assigned_driver.full_name ?? '—'}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                  {order.assigned_driver.phone && (
                    <a href={`tel:${order.assigned_driver.phone}`} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Phone size={9} /> {order.assigned_driver.phone}
                    </a>
                  )}
                  {order.assigned_driver.vehicle_plate && (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>🚗 {order.assigned_driver.vehicle_plate}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.note && (
            <div style={{ background: '#fffbeb', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
              📝 {order.note}
            </div>
          )}

          {/* Delivery Proof Photo */}
          {order.delivery_proof_url && (
            <DeliveryProofPhoto url={order.delivery_proof_url} />
          )}

          {/* ── Timeline ─────────────────────── */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 10 }}>
              Lịch sử thao tác
            </div>

            {loading ? (
              <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 16 }}>Đang tải...</p>
            ) : events.length === 0 ? (
              <p style={{ fontSize: 12, color: '#cbd5e1', textAlign: 'center', padding: 16 }}>Chưa có lịch sử</p>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 22 }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute', left: 6, top: 4, bottom: 4,
                  width: 1, background: '#e2e8f0',
                }} />

                {events.map((ev, i) => {
                  const cfg = EVENT_CONFIG[ev.event_type] ?? { label: ev.event_type, color: '#94a3b8', icon: <Clock size={13} /> }
                  const isLast = i === events.length - 1
                  const meta = ev.metadata as Record<string, string> | null
                  const rejectionNote = meta?.rejection_note

                  return (
                    <div key={ev.id} style={{ position: 'relative', marginBottom: isLast ? 0 : 14 }}>
                      {/* Dot */}
                      <div style={{
                        position: 'absolute', left: -22, top: 2,
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#fff', border: `2px solid ${cfg.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1,
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div style={{
                        background: '#f8fafc', borderRadius: 8, padding: '8px 12px',
                        border: '1px solid #f1f5f9',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: cfg.color }}>{cfg.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{cfg.label}</span>
                          </div>
                          <span style={{ fontSize: 10, color: '#cbd5e1' }}>
                            {new Date(ev.created_at).toLocaleString('vi-VN', {
                              day: '2-digit', month: '2-digit',
                              hour: '2-digit', minute: '2-digit', second: '2-digit',
                            })}
                          </span>
                        </div>

                        <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>
                          {ev.actor?.full_name
                            ? <span>bởi <strong>{ev.actor.full_name}</strong></span>
                            : <span style={{ color: '#cbd5e1' }}>Hệ thống</span>
                          }
                        </div>

                        {rejectionNote && rejectionNote !== 'null' && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#e11d48', background: '#fff1f2', padding: '3px 8px', borderRadius: 6 }}>
                            Lý do: {rejectionNote}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delivery Proof Photo ─────────────────────────────
function DeliveryProofPhoto({ url }: { url: string }) {
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Camera size={11} color="#059669" /> Ảnh xác nhận giao hàng
        </div>

        {/* Thumbnail — click to open lightbox */}
        <div
          onClick={() => setLightbox(true)}
          style={{ cursor: 'zoom-in', borderRadius: 10, overflow: 'hidden', position: 'relative' }}
        >
          <img
            src={url}
            alt="Delivery proof"
            style={{
              width: '100%', maxHeight: 220, objectFit: 'cover',
              display: 'block',
              border: '2px solid #059669',
              borderRadius: 10,
            }}
          />
          {/* Hover overlay hint */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10,
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
          >
            <span style={{
              fontSize: 11, color: '#fff', padding: '3px 10px', borderRadius: 20,
              background: 'rgba(0,0,0,0.45)',
            }}>🔍 Nhấn để xem toàn màn hình</span>
          </div>
        </div>

        {/* Download link */}
        <a
          href={url}
          download
          target="_blank"
          rel="noreferrer"
          style={{
            marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: '#0891b2', textDecoration: 'none', fontWeight: 600,
          }}
        >
          <Download size={11} /> Tải ảnh xuống
        </a>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, cursor: 'zoom-out',
          }}
        >
          <img
            src={url}
            alt="Delivery proof full"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'fixed', top: 16, right: 16,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </>
  )
}

// ─── Helper ──────────────────────────────────────────
function LocationInfo({ icon, label, location }: {
  icon: React.ReactNode
  label: string
  location?: { name: string; address: string; phone?: string | null } | null
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {icon}
      <div>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', margin: '1px 0 0' }}>{location?.name ?? '—'}</p>
        {location?.address && <p style={{ fontSize: 11, color: '#94a3b8', margin: '1px 0 0' }}>{location.address}</p>}
        {location?.phone && (
          <a href={`tel:${location.phone}`} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Phone size={9} /> {location.phone}
          </a>
        )}
      </div>
    </div>
  )
}
