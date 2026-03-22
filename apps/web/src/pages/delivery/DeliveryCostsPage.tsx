import { useState, useEffect, useCallback } from 'react'
import { Info, Receipt, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const fmt = (v: number) => v ? v.toLocaleString('vi-VN') + ' ₫' : '0 ₫'
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN')
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
const F: React.CSSProperties = { fontFamily: 'Outfit, sans-serif' }

// ── Status badge helper ──────────────────────────────
function computePaymentStatus(o: any): string {
  const base = o.extra_fee_status as string
  if (base === 'rejected') return 'rejected'
  if (base !== 'approved') return 'pending'
  const items: any[] = o.voucher_items ?? []
  if (items.length === 0) return 'approved'
  const voucher = items[0]?.voucher
  if (!voucher) return 'approved'
  if (voucher.status === 'paid' || voucher.status === 'confirmed') return 'approved_paid'
  return 'approved_vouchered'
}

const FEE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:           { label: '⏳ Chờ duyệt',    bg: '#fef9c3', color: '#92400e' },
  approved:          { label: '✅ Đã duyệt',      bg: '#dcfce7', color: '#166534' },
  approved_vouchered:{ label: '📋 Trong chứng từ', bg: '#eff6ff', color: '#1d4ed8' },
  approved_paid:     { label: '💵 Đã chi trả',    bg: '#f0fdf4', color: '#15803d' },
  rejected:          { label: '❌ Từ chối',        bg: '#fee2e2', color: '#991b1b' },
}

// ── Tab 1: Phụ phí đơn hàng ──────────────────────────
function ExtraFeesTab() {
  const { profile } = useAuthStore()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  const fetch = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select(`
        id, code, extra_fee, extra_fee_note, extra_fee_status, extra_fee_rejected_reason,
        delivered_at, delivery_proof_url,
        delivery_location:locations!orders_delivery_location_id_fkey(name),
        voucher_items:payment_voucher_items(
          id,
          voucher:payment_vouchers(id, voucher_code, status)
        )
      `)
      .eq('assigned_to', profile.id)
      .gt('extra_fee', 0)
      .order('delivered_at', { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { fetch() }, [fetch])

  const counts = {
    all: orders.length,
    pending: orders.filter(o => o.extra_fee_status === 'pending').length,
    approved: orders.filter(o => ['approved', 'approved_vouchered', 'approved_paid'].includes(computePaymentStatus(o))).length,
    rejected: orders.filter(o => o.extra_fee_status === 'rejected').length,
  }

  const filtered = filter === 'all' ? orders
    : filter === 'approved'
      ? orders.filter(o => ['approved', 'approved_vouchered', 'approved_paid'].includes(computePaymentStatus(o)))
      : orders.filter(o => o.extra_fee_status === filter)

  if (loading) return <div style={{ padding: 20, color: '#94a3b8', ...F }}>Đang tải...</div>

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(k => {
          const labels = { all: 'Tất cả', pending: '⏳ Chờ duyệt', approved: '✅ Đã duyệt', rejected: '❌ Từ chối' }
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...F,
              border: filter === k ? 'none' : '1px solid #e2e8f0',
              background: filter === k ? '#059669' : '#fff',
              color: filter === k ? '#fff' : '#64748b',
            }}>
              {labels[k]} ({counts[k]})
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: 14, ...F }}>
          Không có dữ liệu phụ phí.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(o => {
            const ps = computePaymentStatus(o)
            const s = FEE_STATUS[ps] ?? FEE_STATUS.pending
            const items: any[] = o.voucher_items ?? []
            const voucherCode = items[0]?.voucher?.voucher_code ?? null

            return (
              <div key={o.id} style={{
                background: '#fff', borderRadius: 14, border: `1px solid ${ps === 'rejected' ? '#fca5a5' : ps.startsWith('approved') ? '#86efac' : '#fde68a'}`,
                padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', ...F }}>{o.code}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{o.delivery_location?.name || '—'}</div>
                    {o.delivered_at && <div style={{ fontSize: 11, color: '#cbd5e1' }}>{fmtDate(o.delivered_at)}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: s.color, textDecoration: ps === 'rejected' ? 'line-through' : 'none', ...F }}>
                      {fmt(o.extra_fee)}
                    </div>
                    <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 10, fontWeight: 700, marginTop: 4 }}>
                      {s.label}
                    </div>
                    {voucherCode && <div style={{ fontSize: 10, color: '#1d4ed8', marginTop: 2, ...F }}>{voucherCode}</div>}
                  </div>
                </div>
                {o.extra_fee_note && (
                  <div style={{ background: '#fff7ed', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#92400e', fontStyle: 'italic', display: 'flex', gap: 6 }}>
                    <Info size={13} style={{ marginTop: 2, flexShrink: 0 }} /> "{o.extra_fee_note}"
                  </div>
                )}
                {ps === 'rejected' && o.extra_fee_rejected_reason && (
                  <div style={{ background: '#fef2f2', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#991b1b', display: 'flex', gap: 6 }}>
                    <Info size={13} style={{ marginTop: 2, flexShrink: 0 }} /> Lý do: {o.extra_fee_rejected_reason}
                  </div>
                )}
                {o.delivery_proof_url && (
                  <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
                    onClick={() => window.open(o.delivery_proof_url, '_blank')}>
                    <img src={o.delivery_proof_url} alt="Proof"
                      style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid #bae6fd', display: 'block' }} />
                    <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', borderRadius: 4, padding: '2px 7px', fontSize: 10, color: '#fff', ...F }}>Xem ảnh</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Thống kê KM ───────────────────────────────
function KmStatsTab() {
  const { profile } = useAuthStore()
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    setLoading(true)
    supabase.from('driver_shifts')
      .select('id, started_at, ended_at, km_in, km_out, km_driven, km_payment_amount, km_approval_status, km_approval_note')
      .eq('driver_id', profile.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .then(({ data }) => { if (data) setShifts(data); setLoading(false) })
  }, [profile?.id])

  if (loading) return <div style={{ padding: 20, color: '#94a3b8', ...F }}>Đang tải...</div>

  if (shifts.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: 14, ...F }}>
      Chưa có ca làm việc nào hoàn thành.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shifts.map(s => {
        const status = s.km_approval_status || 'pending'
        const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
          pending:  { label: '⏳ Chờ duyệt', bg: '#fef9c3', color: '#92400e' },
          approved: { label: '✅ Đã duyệt',  bg: '#dcfce7', color: '#166534' },
          rejected: { label: '❌ Từ chối',   bg: '#fee2e2', color: '#991b1b' },
        }
        const cfg = statusCfg[status] ?? statusCfg.pending

        const timeStr = s.started_at
          ? `${fmtDate(s.started_at)} • ${fmtTime(s.started_at)}${s.ended_at ? ' - ' + fmtTime(s.ended_at) : ''}`
          : '—'

        return (
          <div key={s.id} style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', ...F }}>Ca làm việc</span>
              <div style={{ padding: '3px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>{cfg.label}</div>
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>{timeStr}</div>
            <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Thực tế</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', ...F }}>{s.km_driven ?? 0} km</div>
                {(s.km_in != null || s.km_out != null) && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {s.km_in?.toLocaleString() ?? '—'} → {s.km_out?.toLocaleString() ?? '—'} km
                  </div>
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Thực nhận</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#059669', ...F }}>{fmt(s.km_payment_amount)}</div>
              </div>
            </div>
            {s.km_approval_note && (
              <div style={{ marginTop: 12, background: '#fef2f2', padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#991b1b', fontStyle: 'italic', display: 'flex', gap: 8 }}>
                <Info size={13} style={{ marginTop: 2, flexShrink: 0 }} /> Kế toán: "{s.km_approval_note}"
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab 3: Chứng từ chi trả ──────────────────────────
function VouchersTab() {
  const { profile } = useAuthStore()
  const [vouchers, setVouchers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('payment_vouchers')
      .select(`
        id, voucher_code, total_amount, status, type, paid_at, created_at, confirmed_at,
        items:payment_voucher_items(
          id, amount,
          order:orders(id, code, delivery_location:locations!orders_delivery_location_id_fkey(name)),
          shift:driver_shifts!payment_voucher_items_shift_id_fkey(started_at)
        )
      `)
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false })
    if (data) setVouchers(data)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { fetch() }, [fetch])

  const handleConfirm = async (id: string) => {
    await supabase.from('payment_vouchers').update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }).eq('id', id)
    fetch()
  }

  if (loading) return <div style={{ padding: 20, color: '#94a3b8', ...F }}>Đang tải...</div>

  if (vouchers.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 16px', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: 14, ...F }}>
      Chưa có chứng từ chi trả nào.
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {vouchers.map(v => {
        const isExpanded = expandedId === v.id
        const items: any[] = v.items || []
        const status = v.status || 'pending'
        const isKm = v.type === 'km_payment'

        const statusCfg: Record<string, { label: string; bg: string; color: string }> = {
          pending:   { label: '⏳ Chờ chi trả',  bg: '#fef9c3', color: '#92400e' },
          paid:      { label: '💵 Đã chi',        bg: '#dcfce7', color: '#166534' },
          confirmed: { label: '✅ Đã xác nhận',  bg: '#eff6ff', color: '#1d4ed8' },
        }
        const sc = statusCfg[status] ?? statusCfg.pending

        return (
          <div key={v.id} style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden'
          }}>
            {/* Header */}
            <div
              onClick={() => setExpandedId(isExpanded ? null : v.id)}
              style={{ padding: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: status === 'confirmed' ? '#dcfce7' : '#f0fdf4'
              }}>
                <Receipt size={22} color="#059669" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', ...F }}>{v.voucher_code}</span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                    background: isKm ? '#dcfce7' : '#ffedd5', color: isKm ? '#166534' : '#9a3412'
                  }}>{isKm ? '🛣️ KM' : '🚚 Phụ phí'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {items.length} mục • {v.paid_at ? fmtDate(v.paid_at) : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#059669', ...F }}>{fmt(v.total_amount)}</div>
                {isExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
              </div>
            </div>

            {/* Expanded items */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid #f1f5f9' }}>
                {items.map((item: any) => {
                  const order = item.order || {}
                  const shift = item.shift || {}
                  const title = isKm
                    ? `Ca làm việc ${shift.started_at ? fmtDate(shift.started_at) : '—'}`
                    : `${order.code || '—'} • ${order.delivery_location?.name || '—'}`
                  return (
                    <div key={item.id} style={{ padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 4, height: 4, borderRadius: 2, background: '#94a3b8' }} />
                      <div style={{ flex: 1, fontSize: 13, color: '#475569', ...F }}>{title}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', ...F }}>{fmt(item.amount)}</div>
                    </div>
                  )
                })}
                {status === 'confirmed' && v.confirmed_at && (
                  <div style={{ margin: '0 16px 14px', padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1d4ed8', ...F }}>
                    ✅ Bạn đã xác nhận nhận tiền lúc {fmtDate(v.confirmed_at)}
                  </div>
                )}
                {status === 'paid' && (
                  <div style={{ padding: 16, borderTop: '1px solid #f1f5f9' }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleConfirm(v.id) }}
                      style={{
                        width: '100%', padding: 12, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: '#059669', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...F
                      }}
                    >
                      <CheckCircle size={18} /> Xác nhận đã nhận {fmt(v.total_amount)}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────
export function DeliveryCostsPage() {
  const [tab, setTab] = useState<'fees' | 'km' | 'vouchers'>('fees')

  const tabs = [
    { key: 'fees' as const,     label: 'Phụ phí' },
    { key: 'km' as const,       label: 'Thống kê KM' },
    { key: 'vouchers' as const, label: 'Chứng từ' },
  ]

  return (
    <div style={{ ...F, maxWidth: 600 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Chi phí & Thanh toán</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Phụ phí đơn hàng, KM giao nhận và chứng từ chi trả</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f1f5f9', borderRadius: 24, padding: 4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '7px 0', borderRadius: 20, border: 'none', cursor: 'pointer', ...F,
            fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
            background: tab === t.key ? '#059669' : 'transparent',
            color: tab === t.key ? '#fff' : '#64748b',
            boxShadow: tab === t.key ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fees' && <ExtraFeesTab />}
      {tab === 'km' && <KmStatsTab />}
      {tab === 'vouchers' && <VouchersTab />}
    </div>
  )
}
