import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, CheckCircle2, XCircle, Package,
  MapPin, Navigation, RefreshCw, DollarSign, X, Phone,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { compressImage } from '@/utils/imageCompressor'
import { stampImage } from '@/utils/imageStamp'
import { calcOptimizedRoute, ordersToWaypointsWithPickup } from '@/lib/routeOptimizer'

// ─── Types ───────────────────────────────────────────────────
type LocationRef = {
  id: string
  name: string
  address?: string
  phone?: string
  lat?: number   // ← bắt buộc cho việc tính route
  lng?: number   // ← bắt buộc cho việc tính route
}

type OrderRow = {
  id: string
  code: string
  status: string
  note?: string
  delivery_proof_url?: string
  extra_fee?: number
  extra_fee_note?: string
  extra_fee_status?: string
  rejection_note?: string
  trip_id?: string
  delivered_at?: string
  created_at: string
  pickup_location?:  LocationRef | null
  delivery_location?: LocationRef | null
}

const STATUS_COLORS: Record<string, string> = {
  in_transit: '#7c3aed',
  delivered:  '#059669',
  pending:    '#d97706',
  cancelled:  '#94a3b8',
  assigned:   '#2563eb',
}
const STATUS_LABELS: Record<string, string> = {
  in_transit: 'Đang giao',
  delivered:  'Đã giao',
  pending:    'Chờ xử lý',
  cancelled:  'Đã huỷ',
  assigned:   'Đã gán',
}

// ─── Main Page ───────────────────────────────────────────────
export function DeliveryTripDetailPage() {
  const { id: tripId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const [trip,    setTrip]    = useState<any>(null)
  const [orders,  setOrders]  = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  const [completeModal, setCompleteModal] = useState<OrderRow | null>(null)
  const [failModal,     setFailModal]     = useState<OrderRow | null>(null)
  const [optimizing,    setOptimizing]    = useState(false)
  const [routeInfo,     setRouteInfo]     = useState<{ km: number; min: number } | null>(
    trip != null && trip.optimized_distance_km ? { km: Number(trip.optimized_distance_km), min: trip.optimized_duration_min ?? 0 } : null
  )

  // ── Reorder callback sau khi kéo thả ───────────────────────────────
  const handleReorder = useCallback(async (reorderedActive: OrderRow[]) => {
    const doneOrders = orders.filter(o => o.status !== 'in_transit')
    setOrders([...reorderedActive, ...doneOrders])

    // Tính lại quãng đường theo thứ tự mới
    const waypoints = ordersToWaypointsWithPickup(reorderedActive)
    if (waypoints.length >= 2 && tripId) {
      try {
        const result = await calcOptimizedRoute(waypoints)
        await supabase.from('trips').update({
          optimized_distance_km:  result.optimized_distance_km,
          optimized_duration_min: result.optimized_duration_min,
        }).eq('id', tripId)
        setRouteInfo({ km: result.optimized_distance_km, min: result.optimized_duration_min })
      } catch {
        console.warn('[Reorder] Route recalc failed')
      }
    }
  }, [orders, tripId])

  // ── Fetch trip + orders ──────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    const [{ data: tripData }, { data: ordersData }] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('orders')
        .select(`
          id, code, status, note, delivery_proof_url,
          extra_fee, extra_fee_note, extra_fee_status, rejection_note,
          trip_id, delivered_at, created_at,
          pickup_location:locations!orders_pickup_location_id_fkey(id, name, address, phone, lat, lng),
          delivery_location:locations!orders_delivery_location_id_fkey(id, name, address, phone, lat, lng)
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true }),
    ])
    if (tripData) {
      setTrip(tripData)
      // Bug 1 fix: load route info từ DB ngay khi fetch
      if (tripData.optimized_distance_km != null) {
        setRouteInfo({
          km:  Number(tripData.optimized_distance_km),
          min: tripData.optimized_duration_min ?? 0,
        })
      }
    }
    if (ordersData) setOrders(ordersData as unknown as OrderRow[])
    setLoading(false)
  }, [tripId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Auto-recalculate route when orders change ─────────
  const recalcRoute = async (orderList: OrderRow[]) => {
    const active = orderList.filter(o => o.status === 'in_transit')
    if (active.length === 0) return
    const waypoints = ordersToWaypointsWithPickup(active)
    if (waypoints.length < 2) return   // cần ít nhất kho + 1 điểm giao
    const result = await calcOptimizedRoute(waypoints)
    await supabase.from('trips').update({
      optimized_distance_km: result.optimized_distance_km,
      optimized_duration_min: result.optimized_duration_min,
    }).eq('id', tripId!)
    setRouteInfo({ km: result.optimized_distance_km, min: result.optimized_duration_min })
  }

  // ── After any order action: refresh + auto-complete trip ──
  const afterOrderAction = async () => {
    setCompleteModal(null)
    setFailModal(null)
    const { data: freshOrders } = await supabase.from('orders')
      .select('id, status, delivery_location:locations!orders_delivery_location_id_fkey(id, name, lat, lng)')
      .eq('trip_id', tripId!)
    if (freshOrders) {
      await recalcRoute(freshOrders as unknown as OrderRow[])
    }
    await fetchData()

    // Mirror TripService.checkAndCompleteTrip — close trip when no order is in_transit
    const { data: rows } = await supabase
      .from('orders').select('status').eq('trip_id', tripId!)
    const noneInTransit = rows?.every((o: { status: string }) => o.status !== 'in_transit')
    if (noneInTransit && rows && rows.length > 0) {
      await supabase.from('trips').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', tripId!)

      // Update driver status → free
      if (profile?.id) {
        const { data: shifts } = await supabase
          .from('driver_shifts').select('id, status_log')
          .eq('driver_id', profile.id).eq('status', 'active')
          .order('started_at', { ascending: false }).limit(1)
        if (shifts && shifts.length > 0) {
          const log = [...(shifts[0].status_log ?? []), { status: 'free', ts: new Date().toISOString() }]
          await supabase.from('driver_shifts').update({ status_log: log }).eq('id', shifts[0].id)
        }
        await supabase.from('profiles').update({ driver_status: 'free' }).eq('id', profile.id)
      }

      alert('🎉 Tất cả đơn đã hoàn thành — Chuyến đi đã kết thúc!')
      navigate('/delivery/trips')
    }
  }

  if (loading) {
    return <div style={{ padding: 20, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Đang tải chuyến đi...</div>
  }
  if (!trip) {
    return <div style={{ padding: 20, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>Không tìm thấy chuyến đi</div>
  }

  const isCompleted = trip.status === 'completed'
  const activeOrders   = orders.filter(o => o.status === 'in_transit')
  const finishedOrders = orders.filter(o => o.status !== 'in_transit')

  const fmt = (ts?: string) => ts
    ? new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—'

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 600 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 4 }}
        >
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Đơn trong chuyến ({orders.length})
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {fmt(trip.started_at)} — {isCompleted ? `Kết thúc ${fmt(trip.completed_at)}` : 'Đang giao'}
          </p>
        </div>
        <button onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Route optimization info + button */}
      {!isCompleted && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', marginBottom: 12,
          background: routeInfo ? '#ecfeff' : '#f8fafc',
          borderRadius: 12, border: `1px solid ${routeInfo ? '#a5f3fc' : '#e2e8f0'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation size={15} color="#0891b2" />
            {routeInfo ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0891b2' }}>
                {routeInfo.km} km · ~{routeInfo.min} phút
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Chưa tính tuyến tối ưu</span>
            )}
          </div>
          <button
            onClick={async () => {
              if (!tripId) return
              setOptimizing(true)
              try {
                // Bug 2 fix: gọi Edge Function optimize-route (ORS VRPTW)
                // — tìm thứ tự tối ưu thực sự, không chỉ tính distance theo thứ tự hiện tại
                const { data, error } = await supabase.functions.invoke('optimize-route', {
                  body: { tripId },
                })
                if (error) throw error

                // Reorder active orders theo thứ tự tối ưu
                const optimizedRoute: Array<{ sequence: number; orderId: string; type: string }> =
                  data?.optimized_route ?? []

                if (optimizedRoute.length > 0) {
                  // Lấy orderId theo thứ tự (dùng delivery stop — mỗi đơn chỉ có 1)
                  const orderedIds = optimizedRoute
                    .filter((s) => s.type === 'delivery')
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((s) => s.orderId)

                  setOrders(prev => {
                    const active  = prev.filter(o => o.status === 'in_transit')
                    const done    = prev.filter(o => o.status !== 'in_transit')
                    const sorted  = orderedIds
                      .map(id => active.find(o => o.id === id))
                      .filter(Boolean) as OrderRow[]
                    // Đơn active không nằm trong route (edge case) — giữ cuối list
                    const missing = active.filter(o => !orderedIds.includes(o.id))
                    return [...sorted, ...missing, ...done]
                  })
                }

                setRouteInfo({
                  km:  data?.total_distance_km ?? 0,
                  min: data?.total_duration_min ?? 0,
                })
              } catch (err) {
                console.warn('[Optimize] Failed:', err)
              } finally {
                setOptimizing(false)
              }
            }}
            disabled={optimizing || orders.filter(o => o.status === 'in_transit').length === 0}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: optimizing ? '#e2e8f0' : '#0891b2',
              color: optimizing ? '#94a3b8' : '#fff',
              fontSize: 12, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {optimizing ? 'Đang tính...' : <><Navigation size={12} /> Tối ưu tuyến</>}
          </button>
        </div>
      )}

      {/* Trip status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 14px', borderRadius: 20, marginBottom: 20,
        background: isCompleted ? '#f0fdf4' : '#ede9fe',
        color: isCompleted ? '#059669' : '#7c3aed',
        fontSize: 13, fontWeight: 700,
      }}>
        {isCompleted ? <CheckCircle2 size={14} /> : <Navigation size={14} />}
        {isCompleted ? 'Chuyến đã hoàn thành' : `Đang giao · ${activeOrders.length} đơn còn lại`}
      </div>

      {/* Active (in_transit) orders */}
      {activeOrders.length > 0 && (
        <>
          <SectionLabel text={`🚚 Đang giao (${activeOrders.length})`} color="#7c3aed" />
          {activeOrders.length > 1 && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              ☰ Kéo thả để sắp xếp thứ tự giao hàng
            </div>
          )}
          {activeOrders.length > 1 ? (
            <div style={{ marginBottom: 24 }}>
              <SortableCardList
                items={activeOrders}
                onReorder={handleReorder}
                renderItem={(order, displayIdx, onHandlePointerDown) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    index={displayIdx}
                    onComplete={() => setCompleteModal(order)}
                    onFail={() => setFailModal(order)}
                    showDragHandle
                    onHandlePointerDown={onHandlePointerDown}
                  />
                )}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {activeOrders.map((order, idx) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  index={idx + 1}
                  onComplete={() => setCompleteModal(order)}
                  onFail={() => setFailModal(order)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Finished orders */}
      {finishedOrders.length > 0 && (
        <>
          <SectionLabel text={`✅ Đã xử lý (${finishedOrders.length})`} color="#059669" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {finishedOrders.map((order, idx) => (
              <OrderCard
                key={order.id}
                order={order}
                index={activeOrders.length + idx + 1}
                onComplete={null}
                onFail={null}
              />
            ))}
          </div>
        </>
      )}

      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8', fontSize: 14 }}>
          Không có đơn hàng trong chuyến này
        </div>
      )}

      {/* Modals */}
      {completeModal && (
        <CompleteOrderModal
          order={completeModal}
          onDone={afterOrderAction}
          onClose={() => setCompleteModal(null)}
        />
      )}
      {failModal && (
        <FailOrderModal
          order={failModal}
          actorId={profile?.id}
          onDone={afterOrderAction}
          onClose={() => setFailModal(null)}
        />
      )}
    </div>
  )
}

// ─── Section Label ────────────────────────────────────────────
function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 8, paddingLeft: 2 }}>
      {text}
    </div>
  )
}

// ─── Order Card ───────────────────────────────────────────────
function OrderCard({ order, index, onComplete, onFail, showDragHandle = false, onHandlePointerDown }: {
  order: OrderRow
  index: number
  onComplete: (() => void) | null
  onFail: (() => void) | null
  showDragHandle?: boolean
  onHandlePointerDown?: React.PointerEventHandler<HTMLSpanElement>
}) {
  const isDone = onComplete === null
  const statusColor = STATUS_COLORS[order.status] ?? '#94a3b8'
  const statusLabel = STATUS_LABELS[order.status] ?? order.status
  const hasProof = !!order.delivery_proof_url

  return (
    <div
      style={{
        background: isDone ? '#f8fafc' : '#fff',
        borderRadius: 14,
        border: `1px solid ${isDone ? '#e2e8f0' : '#e2e8f0'}`,
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 14px 10px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {showDragHandle && (
            <span
              onPointerDown={onHandlePointerDown}
              style={{
                color: '#cbd5e1', fontSize: 18, flexShrink: 0, lineHeight: 1,
                touchAction: 'none', userSelect: 'none',
                cursor: 'grab', padding: '2px 4px',
              }}
              title="Kéo thả để sắp xếp"
            >☰</span>
          )}
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: '#0a3444', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800,
          }}>
            {index}
          </div>
          <code style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', flex: 1 }}>{order.code}</code>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
            background: statusColor + '1a', color: statusColor,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Route */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <LocRow icon={<MapPin size={11} color="#0e7490" />} text={order.pickup_location?.name ?? '—'} sub={order.pickup_location?.address} phone={order.pickup_location?.phone} />
          <div style={{ width: 1, height: 8, background: '#e2e8f0', marginLeft: 5 }} />
          <LocRow icon={<Navigation size={11} color="#d97706" />} text={order.delivery_location?.name ?? '—'} sub={order.delivery_location?.address} phone={order.delivery_location?.phone} />
        </div>

        {order.note && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, fontStyle: 'italic' }}>📝 {order.note}</p>}
        {order.rejection_note && <p style={{ fontSize: 11, color: '#e11d48', marginTop: 4, background: '#fff1f2', padding: '3px 8px', borderRadius: 6 }}>⚠️ {order.rejection_note}</p>}

        {/* Extra fee (for delivered orders) */}
        {order.status === 'delivered' && order.extra_fee != null && order.extra_fee > 0 && (
          <div style={{
            marginTop: 8, padding: '7px 10px', borderRadius: 8,
            background: '#fefce8', border: '1px solid #fde68a',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                <DollarSign size={12} /> Phụ phí: {order.extra_fee.toLocaleString('vi-VN')} ₫
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                background: order.extra_fee_status === 'approved' ? '#f0fdf4' : order.extra_fee_status === 'rejected' ? '#fff1f2' : '#fef3c7',
                color: order.extra_fee_status === 'approved' ? '#059669' : order.extra_fee_status === 'rejected' ? '#dc2626' : '#d97706',
              }}>
                {order.extra_fee_status === 'approved' ? 'Đã duyệt' : order.extra_fee_status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}
              </span>
            </div>
            {order.extra_fee_note && <p style={{ fontSize: 11, color: '#78716c', margin: '2px 0 0' }}>📝 {order.extra_fee_note}</p>}
          </div>
        )}

        {/* Proof photo thumbnail */}
        {hasProof && (
          <img
            src={order.delivery_proof_url}
            alt="Ảnh giao hàng"
            style={{ marginTop: 10, width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }}
          />
        )}
      </div>

      {/* Action buttons */}
      {!isDone && (
        <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
          <button
            onClick={onFail!}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: '#fff1f2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}
          >
            <XCircle size={14} /> Không thành công
          </button>
          <button
            onClick={onComplete!}
            style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
            }}
          >
            <Camera size={14} /> Hoàn thành
          </button>
        </div>
      )}
    </div>
  )
}

function LocRow({ icon, text, sub, phone }: { icon: React.ReactNode; text: string; sub?: string; phone?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ marginTop: 3, flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{text}</span>
        {sub && <p style={{ fontSize: 11, color: '#94a3b8', margin: '1px 0 0' }}>{sub}</p>}
        {phone && (
          <a href={`tel:${phone}`} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            <Phone size={9} /> {phone}
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Complete Order Modal ─────────────────────────────────────
function CompleteOrderModal({ order, onDone, onClose }: {
  order: OrderRow
  onDone: () => void
  onClose: () => void
}) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [photo,     setPhoto]     = useState<Blob | null>(null)
  const [preview,   setPreview]   = useState<string | null>(null)
  const [sizeKb,    setSizeKb]    = useState<number | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [fee,       setFee]       = useState('')
  const [feeNote,   setFeeNote]   = useState('')
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleFile(file: File) {
    setCompressing(true)
    setError(null)
    try {
      const stamped = await stampImage(file, {
        title: order.code,
        subtitle: order.delivery_location?.name,
        watermark: 'ADC Delivery',
        capturedAt: new Date(),
      })
      const blob = await compressImage(stamped, 50)
      setPhoto(blob)
      setPreview(URL.createObjectURL(blob))
      setSizeKb(Math.round(blob.size / 1024))
    } catch {
      setError('Không thể xử lý ảnh. Thử lại.')
    } finally {
      setCompressing(false)
    }
  }

  async function confirm() {
    if (!photo) { setError('Bắt buộc phải chụp ảnh xác nhận'); return }
    setUploading(true)
    setError(null)
    try {
      const path = `proofs/${order.id}-${Date.now()}.jpg`
      const arr  = await photo.arrayBuffer()
      const { error: upErr } = await supabase.storage
        .from('delivery-proofs')
        .upload(path, arr, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('delivery-proofs').getPublicUrl(path)

      const feeVal = parseInt(fee.replace(/\D/g, '')) || 0
      const updates: Record<string, any> = {
        status:             'delivered',
        delivery_proof_url: publicUrl,
        delivered_at:       new Date().toISOString(),
      }
      if (feeVal > 0) {
        updates.extra_fee        = feeVal
        updates.extra_fee_status = 'pending'
        if (feeNote.trim()) updates.extra_fee_note = feeNote.trim()
      }

      const { error: dbErr } = await supabase.from('orders').update(updates).eq('id', order.id)
      if (dbErr) throw dbErr

      onDone()
    } catch (e: any) {
      setError('Lỗi: ' + e.message)
      setUploading(false)
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <div style={{ padding: 8, borderRadius: 10, background: 'rgba(5,150,105,0.1)' }}>
          <Camera size={22} color="#059669" />
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>Hoàn thành đơn</p>
          <p style={{ fontSize: 12, margin: 0, color: '#64748b' }}>{order.code}</p>
        </div>
      </div>
      <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 14px' }}>
        📸 Chụp ảnh bằng chứng giao hàng. Bắt buộc mới xác nhận được.
      </p>

      {/* Photo capture area — dùng <label> để trigger đúng cách trên Safari iOS */}
      <input
        ref={fileRef}
        id={`photo-${order.id}`}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          // Reset value để Safari cho phép chụp lại cùng file
          e.target.value = ''
        }}
      />
      <label
        htmlFor={compressing || uploading ? undefined : `photo-${order.id}`}
        style={{
          height: 180, borderRadius: 14, marginBottom: 14,
          border: `2px solid ${preview ? '#059669' : '#e2e8f0'}`,
          background: preview ? 'transparent' : '#f8fafc',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: compressing || uploading ? 'wait' : 'pointer', position: 'relative', overflow: 'hidden',
        }}
      >
        {preview ? (
          <>
            <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {sizeKb !== null && (
              <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(5,150,105,0.85)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                ✓ {sizeKb} KB
              </div>
            )}
            <label
              htmlFor={`photo-${order.id}`}
              onClick={e => e.stopPropagation()}
              style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
            >
              🔄 Chụp lại
            </label>
          </>
        ) : compressing ? (
          <>
            <div style={{ width: 32, height: 32, border: '3px solid #059669', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 10 }}>Đang xử lý ảnh...</p>
          </>
        ) : (
          <>
            <Camera size={48} color="#cbd5e1" />
            <p style={{ color: '#64748b', fontSize: 14, fontWeight: 500, margin: '10px 0 4px' }}>Nhấn để mở camera</p>
            <p style={{ color: '#cbd5e1', fontSize: 11 }}>Chỉ chụp trực tiếp</p>
          </>
        )}
      </label>

      {/* Extra fee */}
      <div style={{ padding: 12, borderRadius: 12, background: '#fefce8', border: '1px solid #fde68a', marginBottom: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
          <DollarSign size={12} /> Phụ phí thêm (không bắt buộc)
        </label>
        <input
          type="number"
          value={fee}
          onChange={e => setFee(e.target.value)}
          placeholder="Số tiền (VD: 20000)"
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid #fde68a', fontFamily: 'Outfit, sans-serif',
            fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {fee && parseInt(fee) > 0 && (
          <input
            type="text"
            value={feeNote}
            onChange={e => setFeeNote(e.target.value)}
            placeholder="Lý do phụ phí..."
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8, marginTop: 8,
              border: '1px solid #fde68a', fontFamily: 'Outfit, sans-serif',
              fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        )}
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      <button
        onClick={confirm}
        disabled={!photo || uploading || compressing}
        style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: photo ? 'linear-gradient(135deg, #059669, #047857)' : '#e2e8f0',
          color: photo ? '#fff' : '#94a3b8',
          fontSize: 15, fontWeight: 700, cursor: photo ? 'pointer' : 'not-allowed',
          fontFamily: 'Outfit, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {uploading ? '⏳ Đang tải ảnh...' : <><CheckCircle2 size={18} /> Xác nhận hoàn thành</>}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </BottomSheet>
  )
}

// ─── Fail Order Modal ─────────────────────────────────────────
const FAIL_PRESETS = ['Khách không có mặt', 'Sai địa chỉ', 'Khách từ chối nhận', 'Không liên lạc được', 'Hàng bị hỏng']

function FailOrderModal({ order, actorId, onDone, onClose }: {
  order: OrderRow
  actorId?: string
  onDone: () => void
  onClose: () => void
}) {
  const [reason,  setReason]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit() {
    if (!reason.trim()) { setError('Vui lòng nhập lý do'); return }
    setLoading(true)
    setError(null)
    try {
      // 1. Reset order back to pending, clear trip_id
      const { error: e1 } = await supabase.from('orders').update({
        status: 'pending',
        assigned_to: null,
        trip_id: null,
        rejection_note: reason.trim(),
      }).eq('id', order.id)
      if (e1) throw e1

      // 2. Log event in order_events
      await supabase.from('order_events').insert({
        order_id:   order.id,
        actor_id:   actorId,
        event_type: 'failed',
        metadata:   { reason: reason.trim() },
      })

      onDone()
    } catch (e: any) {
      setError('Lỗi: ' + e.message)
      setLoading(false)
    }
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{ padding: 8, borderRadius: 10, background: 'rgba(220,38,38,0.1)' }}>
          <XCircle size={22} color="#dc2626" />
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>Giao không thành công</p>
          <p style={{ fontSize: 12, margin: 0, color: '#64748b' }}>{order.code}</p>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>
        Đơn sẽ trở về trạng thái Chờ xử lý để điều phối lại.
      </p>

      {/* Preset reasons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {FAIL_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setReason(p)}
            style={{
              padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              background: reason === p ? '#fff1f2' : '#f8fafc',
              color: reason === p ? '#dc2626' : '#475569',
              border: `1px solid ${reason === p ? '#dc2626' : '#e2e8f0'}`,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Nhập lý do giao không thành công..."
        rows={3}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 12,
          border: '1px solid #e2e8f0', fontFamily: 'Outfit, sans-serif',
          fontSize: 13, color: '#1e293b', outline: 'none',
          resize: 'vertical', boxSizing: 'border-box', marginBottom: 12,
        }}
      />

      {error && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{error}</p>}

      <button
        onClick={submit}
        disabled={!reason.trim() || loading}
        style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: reason.trim() ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : '#e2e8f0',
          color: reason.trim() ? '#fff' : '#94a3b8',
          fontSize: 15, fontWeight: 700, cursor: reason.trim() ? 'pointer' : 'not-allowed',
          fontFamily: 'Outfit, sans-serif',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading ? '⏳ Đang xử lý...' : <><Package size={16} /> Xác nhận — trả về Chờ xử lý</>}
      </button>
    </BottomSheet>
  )
}

// ─── Smooth Sortable Card List (Pointer Events) ──────────────────────────────────────────────────
// Hiệu ứng mềm mại: ghost card theo cursor, siblings shift với translateY + transition
type SortableRenderFn = (
  item: OrderRow,
  displayIdx: number,
  onHandlePointerDown: React.PointerEventHandler<HTMLSpanElement>
) => React.ReactNode

function SortableCardList({
  items,
  onReorder,
  renderItem,
}: {
  items: OrderRow[]
  onReorder: (reordered: OrderRow[]) => void
  renderItem: SortableRenderFn
}) {
  const [localItems,  setLocalItems]  = useState<OrderRow[]>(items)
  const [draggingIdx, setDraggingIdx] = useState(-1)
  const [insertAt,    setInsertAt]    = useState(-1)
  const [ghostTop,    setGhostTop]    = useState(0)

  const draggingIdxRef = useRef(-1)
  const insertAtRef    = useRef(-1)
  const startClientY   = useRef(0)
  const startGhostTop  = useRef(0)
  const cardH          = useRef(90) // estimated card height + gap
  const containerRef   = useRef<HTMLDivElement>(null)
  const rowRefs        = useRef<(HTMLDivElement | null)[]>([])
  const GAP = 10

  // Sync khi items prop thay đổi (sau khi reorder commit)
  useEffect(() => { if (draggingIdx === -1) setLocalItems(items) }, [items, draggingIdx])

  const startDrag = useCallback((e: React.PointerEvent<HTMLSpanElement>, idx: number) => {
    e.preventDefault()
    const row = rowRefs.current[idx]
    if (row) {
      const rect = row.getBoundingClientRect()
      cardH.current = rect.height + GAP
      startGhostTop.current = rect.top
      setGhostTop(rect.top)
    }
    draggingIdxRef.current = idx
    insertAtRef.current    = idx
    startClientY.current   = e.clientY
    setDraggingIdx(idx)
    setInsertAt(idx)

    // Dùng global listeners — pointer capture không cần thiết vì listener trên window
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startClientY.current
      setGhostTop(startGhostTop.current + dy)

      // Tính insertAt mới theo cursor Y
      let newInsert = draggingIdxRef.current
      for (let i = 0; i < rowRefs.current.length; i++) {
        const r = rowRefs.current[i]?.getBoundingClientRect()
        if (!r) continue
        if (ev.clientY < r.top + r.height / 2) { newInsert = i; break }
        newInsert = i
      }
      insertAtRef.current = newInsert
      setInsertAt(newInsert)
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup',   onUp)
      window.removeEventListener('pointercancel', onUp)

      const from = draggingIdxRef.current
      const to   = insertAtRef.current
      draggingIdxRef.current = -1
      insertAtRef.current    = -1
      setDraggingIdx(-1)
      setInsertAt(-1)

      if (from !== to && from >= 0 && to >= 0) {
        setLocalItems(prev => {
          const arr = [...prev]
          const [moved] = arr.splice(from, 1)
          arr.splice(to, 0, moved)
          onReorder(arr)
          return arr
        })
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup',   onUp)
    window.addEventListener('pointercancel', onUp)
  }, [onReorder])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {localItems.map((item, idx) => {
        const isGhost = idx === draggingIdx
        // Shift siblings: items nhường chỗ cho card đang kéo
        let shift = 0
        if (draggingIdx >= 0 && !isGhost) {
          if (draggingIdx < insertAt && idx > draggingIdx && idx <= insertAt) shift = -cardH.current
          else if (draggingIdx > insertAt && idx >= insertAt && idx < draggingIdx) shift = cardH.current
        }

        return (
          <div
            key={item.id}
            ref={el => { rowRefs.current[idx] = el }}
            style={{
              marginBottom: GAP,
              transform: isGhost ? 'none' : `translateY(${shift}px)`,
              transition: isGhost
                ? 'none'
                : 'transform 180ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              opacity: isGhost ? 0 : 1,   // ẩn card gốc khi khư — ghost sẽ hiện thay
            }}
          >
            {renderItem(item, idx + 1, (e) => startDrag(e, idx))}
          </div>
        )
      })}

      {/* Ghost card — follow cursor, slight scale + shadow */}
      {draggingIdx >= 0 && draggingIdx < localItems.length && (
        <div
          style={{
            position: 'fixed',
            top: ghostTop,
            left: containerRef.current?.getBoundingClientRect().left ?? 0,
            width: containerRef.current?.getBoundingClientRect().width ?? 320,
            pointerEvents: 'none',
            zIndex: 9999,
            transform: 'scale(1.03) rotate(0.5deg)',
            filter: 'drop-shadow(0 16px 40px rgba(0,0,0,0.22))',
            borderRadius: 14,
            overflow: 'hidden',
            transition: 'none',
          }}
        >
          {renderItem(localItems[draggingIdx], draggingIdx + 1, () => {})}
        </div>
      )}
    </div>
  )
}

// ─── Bottom Sheet Wrapper ─────────────────────────────────────
function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end',
        zIndex: 200, fontFamily: 'Outfit, sans-serif',
      }}
      // Dùng onPointerDown + target check thay vì onClick để tránh bug Safari:
      // khi camera app trả về, Safari có thể fire click event trên overlay
      // dẫn đến modal bị đóng và mất ảnh đã chụp.
      onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600, margin: '0 auto',
          background: '#fff', borderRadius: '24px 24px 0 0',
          padding: '16px 20px 32px',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 16px' }} />
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
        >
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  )
}
