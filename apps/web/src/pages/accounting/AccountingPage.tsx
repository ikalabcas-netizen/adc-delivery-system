import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, CheckCircle, DollarSign, Clock, X, ZoomIn } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { PaymentVoucher } from '@adc/shared-types'

// ── Formatting ─────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ── Hooks ──────────────────────────────────────────────
function usePendingFees() {
  return useQuery({
    queryKey: ['accounting', 'pending-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, code, status, extra_fee, extra_fee_note, extra_fee_status, extra_fee_rejected_reason,
          delivery_proof_url, proof_photo_url,
          created_at, delivered_at,
          assigned_driver:profiles!orders_assigned_to_fkey(id, full_name, avatar_url, phone),
          delivery_location:locations!orders_delivery_location_id_fkey(id, name, address)
        `)
        .gt('extra_fee', 0)
        .order('delivered_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
    staleTime: 1000 * 30,
  })
}

function useVouchers() {
  return useQuery({
    queryKey: ['accounting', 'vouchers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_vouchers')
        .select(`
          *,
          driver:profiles!payment_vouchers_driver_id_fkey(id, full_name, avatar_url, vehicle_plate),
          items:payment_voucher_items(
            id, amount, order_id,
            order:orders(id, code, delivery_location:locations!orders_delivery_location_id_fkey(id, name))
          )
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PaymentVoucher[]
    },
    staleTime: 1000 * 30,
  })
}

function useAccountingStats() {
  return useQuery({
    queryKey: ['accounting', 'stats'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('extra_fee, extra_fee_status')
        .gt('extra_fee', 0)

      const { data: vouchers } = await supabase
        .from('payment_vouchers')
        .select('total_amount, status, paid_at')

      const pending  = (orders ?? []).filter(o => o.extra_fee_status === 'pending').reduce((s, o) => s + (o.extra_fee ?? 0), 0)
      const approved = (orders ?? []).filter(o => o.extra_fee_status === 'approved').reduce((s, o) => s + (o.extra_fee ?? 0), 0)
      const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
      const paidThisMonth = (vouchers ?? [])
        .filter(v => v.status === 'paid' && v.paid_at && new Date(v.paid_at) >= thisMonth)
        .reduce((s, v) => s + v.total_amount, 0)

      return { pending, approved, paidThisMonth }
    },
    staleTime: 1000 * 60,
  })
}

function useApproveFee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, approve, reason }: { orderId: string; approve: boolean; reason?: string }) => {
      const { error } = await supabase.from('orders').update({
        extra_fee_status: approve ? 'approved' : 'rejected',
        ...(approve ? {} : { extra_fee_rejected_reason: reason }),
      }).eq('id', orderId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting'] })
    },
  })
}

function useCreateVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ driverId, orderIds }: { driverId: string; orderIds: string[] }) => {
      // Only use approved orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, extra_fee, extra_fee_status')
        .in('id', orderIds)

      const approvedOrders = (orders ?? []).filter(o => o.extra_fee_status === 'approved')
      if (approvedOrders.length === 0) throw new Error('Không có đơn nào đã được duyệt')

      const total = approvedOrders.reduce((s, o) => s + (o.extra_fee ?? 0), 0)
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const dateStr = `${today.getFullYear()}${pad(today.getMonth()+1)}${pad(today.getDate())}`
      const rand = Math.floor(Math.random() * 900 + 100)
      const voucherCode = `PAY-${dateStr}-${rand}`

      const { data: voucher, error: vErr } = await supabase
        .from('payment_vouchers')
        .insert({ driver_id: driverId, voucher_code: voucherCode, total_amount: total })
        .select().single()
      if (vErr) throw vErr

      const items = approvedOrders.map(o => ({
        voucher_id: voucher.id, order_id: o.id, amount: o.extra_fee ?? 0,
      }))
      if (items.length > 0) {
        const { error: iErr } = await supabase.from('payment_voucher_items').insert(items)
        if (iErr) throw iErr
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting'] }),
  })
}

function useMarkPaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (voucherId: string) => {
      const { error } = await supabase.from('payment_vouchers')
        .update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', voucherId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting'] }),
  })
}

// ── Components ─────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', gap: 14, alignItems: 'center', flex: '1 1 160px' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{value}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{label}</div>
      </div>
    </div>
  )
}

function VoucherStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: '⏳ Chờ chi trả',  bg: '#fef9c3', color: '#92400e' },
    paid:      { label: '✅ Đã chi trả',   bg: '#dcfce7', color: '#166534' },
    confirmed: { label: '✓ Hoàn tất',      bg: '#f0f9ff', color: '#0369a1' },
  }
  const c = cfg[status] ?? cfg.pending
  return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{c.label}</span>
}

function FeeStatusBadge({ status }: { status?: string | null }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    pending:  { label: 'Chờ duyệt', bg: '#fef9c3', color: '#92400e' },
    approved: { label: 'Đã duyệt',  bg: '#dcfce7', color: '#166534' },
    rejected: { label: 'Từ chối',   bg: '#fee2e2', color: '#991b1b' },
  }
  const c = cfg[status ?? 'pending'] ?? cfg.pending
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{c.label}</span>
}

// ── Fee Detail Modal ───────────────────────────────────
function FeeDetailModal({
  order,
  onClose,
  onApprove,
  onReject,
  isActing,
}: {
  order: any
  onClose: () => void
  onApprove: () => void
  onReject: (reason: string) => void
  isActing: boolean
}) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [imgZoomed, setImgZoomed] = useState(false)

  const proofUrl = order.delivery_proof_url || order.proof_photo_url
  const status = order.extra_fee_status as string

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9998, backdropFilter: 'blur(2px)' }}
      />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: '#fff', borderRadius: 20, width: 520, maxWidth: '95vw', maxHeight: '90vh',
        overflow: 'auto', zIndex: 9999, boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        fontFamily: 'Outfit, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Chi tiết phụ phí</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{order.code}</div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
            <X size={16} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Driver info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f8fafc', borderRadius: 12 }}>
            {order.assigned_driver?.avatar_url
              ? <img src={order.assigned_driver.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0891b2' }}>{order.assigned_driver?.full_name?.[0] ?? '?'}</div>
            }
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{order.assigned_driver?.full_name ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{order.assigned_driver?.phone ?? ''}</div>
            </div>
          </div>

          {/* Order info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>Địa điểm giao</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{order.delivery_location?.name ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{order.delivery_location?.address ?? ''}</div>
            </div>
            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>Ngày giao</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{order.delivered_at ? fmtDate(order.delivered_at) : '—'}</div>
            </div>
          </div>

          {/* Fee details */}
          <div style={{ padding: '14px 16px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#92400e', marginBottom: 4, fontWeight: 600 }}>Phụ phí phát sinh</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{fmt(order.extra_fee ?? 0)}</div>
              </div>
              <FeeStatusBadge status={status} />
            </div>
            {order.extra_fee_note && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#78350f', fontStyle: 'italic' }}>
                "{order.extra_fee_note}"
              </div>
            )}
            {status === 'rejected' && order.extra_fee_rejected_reason && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: '#fee2e2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                <strong>Lý do từ chối:</strong> {order.extra_fee_rejected_reason}
              </div>
            )}
          </div>

          {/* Delivery proof photo */}
          {proofUrl ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>📷 Ảnh chứng minh / Bill</div>
              <div
                style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                onClick={() => setImgZoomed(true)}
              >
                <img
                  src={proofUrl}
                  alt="Ảnh giao hàng"
                  style={{ width: '100%', maxHeight: 280, objectFit: 'cover', display: 'block' }}
                />
                <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ZoomIn size={12} color="#fff" />
                  <span style={{ fontSize: 11, color: '#fff' }}>Xem rõ</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              📷 Chưa có ảnh chứng minh
            </div>
          )}

          {/* Action buttons — only for pending */}
          {status === 'pending' && !showReject && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onApprove}
                disabled={isActing}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: '#059669', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', opacity: isActing ? 0.7 : 1 }}
              >
                {isActing ? '...' : '✓ Duyệt phụ phí'}
              </button>
              <button
                onClick={() => setShowReject(true)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: '#fee2e2', color: '#991b1b', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
              >
                ✕ Từ chối
              </button>
            </div>
          )}

          {/* Reject form */}
          {showReject && (
            <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>Lý do từ chối</div>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Nhập lý do từ chối phụ phí..."
                rows={3}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 13, fontFamily: 'Outfit, sans-serif', resize: 'vertical', boxSizing: 'border-box', background: '#fff' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => setShowReject(false)}
                  style={{ flex: 1, padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 13 }}
                >
                  Huỷ
                </button>
                <button
                  onClick={() => { onReject(rejectReason); setShowReject(false) }}
                  disabled={!rejectReason.trim() || isActing}
                  style={{ flex: 1, padding: 10, border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 13, opacity: !rejectReason.trim() || isActing ? 0.6 : 1 }}
                >
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image zoom overlay */}
      {imgZoomed && proofUrl && (
        <div
          onClick={() => setImgZoomed(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
        >
          <img
            src={proofUrl}
            alt="Ảnh giao hàng"
            style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12 }}
          />
          <button
            onClick={() => setImgZoomed(false)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}
          >
            <X size={20} color="#fff" />
          </button>
        </div>
      )}
    </>
  )
}

// ── Main Page ──────────────────────────────────────────
export function AccountingPage() {
  const [tab, setTab] = useState<'fees' | 'vouchers'>('fees')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null)
  const [feeFilter, setFeeFilter] = useState<'all'|'pending'|'approved'|'rejected'>('pending')
  const [detailOrder, setDetailOrder] = useState<any | null>(null)

  const { data: fees = [],     isLoading: feesLoading }    = usePendingFees()
  const { data: vouchers = [], isLoading: vouchersLoading } = useVouchers()
  const { data: stats }                                     = useAccountingStats()
  const approve      = useApproveFee()
  const createVoucher = useCreateVoucher()
  const markPaid     = useMarkPaid()

  const filteredFees = feeFilter === 'all' ? fees : fees.filter(f => f.extra_fee_status === feeFilter)

  // Count by status
  const countByStatus = useMemo(() => ({
    pending:  fees.filter(f => f.extra_fee_status === 'pending').length,
    approved: fees.filter(f => f.extra_fee_status === 'approved').length,
    rejected: fees.filter(f => f.extra_fee_status === 'rejected').length,
  }), [fees])

  // Group selected orders by driver for voucher creation
  const selectedOrders = fees.filter(f => selected.has(f.id))
  const selectedGroups = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const o of selectedOrders) {
      const drv = o.assigned_driver?.id
      if (!drv) continue
      if (!m.has(drv)) m.set(drv, [])
      m.get(drv)!.push(o.id)
    }
    return m
  }, [selectedOrders])

  const hasPendingInSelection = selectedOrders.some(o => o.extra_fee_status === 'pending')

  const handleCreateVouchers = async () => {
    for (const [driverId, orderIds] of selectedGroups) {
      await createVoucher.mutateAsync({ driverId, orderIds })
    }
    setSelected(new Set())
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #059669, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Kế toán & Phụ phí</h1>
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, marginLeft: 46 }}>Dành cho kế toán và quản lý</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <SummaryCard icon={<Clock size={18} color="#d97706" />} label="Chờ duyệt" value={fmt(stats?.pending ?? 0)} color="#d97706" />
        <SummaryCard icon={<CheckCircle size={18} color="#059669" />} label="Đã duyệt chưa chi" value={fmt(stats?.approved ?? 0)} color="#059669" />
        <SummaryCard icon={<DollarSign size={18} color="#0891b2" />} label="Chi trả tháng này" value={fmt(stats?.paidThisMonth ?? 0)} color="#0891b2" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
        {(['fees','vouchers'] as const).map(t => {
          const labels = { fees: 'Phụ phí chờ duyệt', vouchers: 'Chứng từ chi trả' }
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', fontFamily: 'Outfit, sans-serif',
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#059669' : '#94a3b8',
              borderBottom: tab === t ? '2px solid #059669' : '2px solid transparent',
            }}>{labels[t]}</button>
          )
        })}
      </div>

      {/* ── TAB 1: Fees ── */}
      {tab === 'fees' && (
        <div>
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {(['all','pending','approved','rejected'] as const).map(f => {
              const count = f === 'all' ? fees.length : countByStatus[f] ?? 0
              return (
                <button key={f} onClick={() => setFeeFilter(f)} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: feeFilter === f ? 'none' : '1px solid #e2e8f0',
                  background: feeFilter === f ? '#059669' : '#fff',
                  color: feeFilter === f ? '#fff' : '#64748b',
                  fontFamily: 'Outfit, sans-serif',
                }}>
                  {{ all: 'Tất cả', pending: '⏳ Chờ', approved: '✅ Duyệt', rejected: '❌ Từ chối' }[f]} ({count})
                </button>
              )
            })}

            {/* Bulk create voucher */}
            {selected.size > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {hasPendingInSelection && (
                  <span style={{ fontSize: 11, color: '#d97706' }}>⚠️ Có đơn chưa duyệt trong chọn</span>
                )}
                <button
                  onClick={handleCreateVouchers}
                  disabled={createVoucher.isPending || hasPendingInSelection}
                  style={{ padding: '6px 16px', borderRadius: 10, background: hasPendingInSelection ? '#94a3b8' : '#059669', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: hasPendingInSelection ? 'not-allowed' : 'pointer', fontFamily: 'Outfit, sans-serif' }}
                >
                  {createVoucher.isPending ? 'Đang tạo...' : `Gộp ${selected.size} đơn → Chứng từ`}
                </button>
              </div>
            )}
          </div>

          {feesLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</div>
          ) : filteredFees.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>
              <DollarSign size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Không có phụ phí nào</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '10px 14px', width: 36 }}></th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>Mã đơn / Địa điểm</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>Tài xế</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>Số tiền</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>Trạng thái</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.map((o: any) => (
                    <tr
                      key={o.id}
                      style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setDetailOrder(o)}
                    >
                      <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        {o.extra_fee_status === 'approved' && (
                          <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)}
                            style={{ width: 14, height: 14, cursor: 'pointer' }} />
                        )}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{o.code}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{o.delivery_location?.name ?? '—'}</div>
                        {o.extra_fee_note && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>"{o.extra_fee_note}"</div>}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {o.assigned_driver?.avatar_url
                            ? <img src={o.assigned_driver.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0891b2' }}>{o.assigned_driver?.full_name?.[0] ?? '?'}</div>
                          }
                          <span style={{ fontSize: 12, color: '#475569' }}>{o.assigned_driver?.full_name ?? '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: (o.extra_fee ?? 0) > 100000 ? '#dc2626' : '#0f172a' }}>
                        {fmt(o.extra_fee ?? 0)}
                        {(o.delivery_proof_url || o.proof_photo_url) && (
                          <div style={{ fontSize: 10, color: '#0891b2', marginTop: 2 }}>📷 có ảnh</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <FeeStatusBadge status={o.extra_fee_status} />
                        {o.extra_fee_rejected_reason && (
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.extra_fee_rejected_reason}</div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setDetailOrder(o) }}
                          style={{ padding: '4px 12px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Vouchers ── */}
      {tab === 'vouchers' && (
        <div>
          {vouchersLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</div>
          ) : vouchers.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>
              <Receipt size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Chưa có chứng từ nào</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vouchers.map(v => (
                <div key={v.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                    onClick={() => setExpandedVoucher(expandedVoucher === v.id ? null : v.id)}>
                    {/* Driver */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{v.driver?.full_name ?? '—'}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{v.voucher_code}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtDate(v.created_at)} · {(v.items ?? []).length} đơn</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#059669' }}>{fmt(v.total_amount)}</div>
                    <VoucherStatusBadge status={v.status} />
                    {v.status === 'pending' && (
                      <button onClick={(e) => { e.stopPropagation(); markPaid.mutate(v.id) }} style={{
                        padding: '6px 14px', borderRadius: 8, background: '#0891b2', color: '#fff', border: 'none',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                      }}>Đã chi trả</button>
                    )}
                  </div>
                  {expandedVoucher === v.id && (v.items ?? []).length > 0 && (
                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 18px 14px' }}>
                      {(v.items ?? []).map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#64748b' }}>{(item.order as any)?.code}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{(item.order as any)?.delivery_location?.name}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{fmt(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailOrder && (
        <FeeDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onApprove={() => {
            approve.mutate({ orderId: detailOrder.id, approve: true })
            setDetailOrder(null)
          }}
          onReject={(reason) => {
            approve.mutate({ orderId: detailOrder.id, approve: false, reason })
            setDetailOrder(null)
          }}
          isActing={approve.isPending}
        />
      )}
    </div>
  )
}
