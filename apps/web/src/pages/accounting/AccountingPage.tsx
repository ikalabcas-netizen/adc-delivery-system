import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, CheckCircle, DollarSign, Clock, X, ZoomIn, ChevronDown, ChevronUp, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const F = { fontFamily: 'Outfit, sans-serif' }

// ── Date helpers ────────────────────────────────────────
function toLocalDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDatePreset(preset: string): { from: string; to: string } {
  const today = new Date()
  const to = toLocalDateStr(today)
  if (preset === 'today') return { from: to, to }
  if (preset === 'week') {
    const d = new Date(today)
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    return { from: toLocalDateStr(d), to }
  }
  if (preset === 'month') {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toLocalDateStr(d), to }
  }
  return { from: '', to: '' }
}

type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

// ── Payment status helper ──────────────────────────────
// pending | approved | approved_vouchered | approved_paid | rejected
function computePaymentStatus(o: any): string {
  const base = o.extra_fee_status as string
  if (base === 'rejected') return 'rejected'
  if (base !== 'approved') return base
  const items: any[] = o.voucher_items ?? []
  if (items.length === 0) return 'approved'
  const voucher = items[0]?.voucher
  if (!voucher) return 'approved'
  if (voucher.status === 'paid' || voucher.status === 'confirmed') return 'approved_paid'
  return 'approved_vouchered'
}

// ── Hooks ──────────────────────────────────────────────
function useFees() {
  return useQuery({
    queryKey: ['accounting', 'fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, code, extra_fee, extra_fee_note, extra_fee_status, extra_fee_rejected_reason,
          delivery_proof_url, proof_photo_url, delivered_at,
          assigned_driver:profiles!orders_assigned_to_fkey(id, full_name, avatar_url, phone),
          delivery_location:locations!orders_delivery_location_id_fkey(id, name),
          voucher_items:payment_voucher_items(
            id, amount,
            voucher:payment_vouchers(id, voucher_code, status)
          )
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
          id, voucher_code, total_amount, status, paid_at, confirmed_at, created_at,
          driver:profiles!payment_vouchers_driver_id_fkey(id, full_name, avatar_url),
          items:payment_voucher_items(
            id, amount,
            order:orders(id, code, delivery_location:locations!orders_delivery_location_id_fkey(id, name))
          )
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    },
    staleTime: 1000 * 30,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting'] }),
  })
}

function useCreateVouchers(clearSelection: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ selectedIds }: { selectedIds: Set<string> }) => {
      if (selectedIds.size === 0) throw new Error('Chưa chọn đơn nào')

      // Fetch fresh data from DB — only approved orders
      const { data: rows, error } = await supabase
        .from('orders')
        .select('id, extra_fee, assigned_to, assigned_driver:profiles!orders_assigned_to_fkey(id, full_name)')
        .in('id', Array.from(selectedIds))
        .eq('extra_fee_status', 'approved')
      if (error) throw error

      const approved = rows ?? []
      if (approved.length === 0) throw new Error('Không có đơn nào đang ở trạng thái Đã duyệt trong danh sách chọn')

      // Bug 1 fix: Exclude orders that already have a voucher item
      const { data: existingItems } = await supabase
        .from('payment_voucher_items')
        .select('order_id')
        .in('order_id', approved.map(o => o.id))
      const alreadyInVoucher = new Set((existingItems ?? []).map(i => i.order_id))
      const eligible = approved.filter(o => !alreadyInVoucher.has(o.id))
      if (eligible.length === 0) throw new Error('Tất cả đơn đã chọn đều đã nằm trong chứng từ')

      // Group by driver
      const byDriver = new Map<string, { total: number; orderIds: string[] }>()
      for (const o of eligible) {
        const drvId = (o as any).assigned_to as string
        if (!drvId) continue
        if (!byDriver.has(drvId)) byDriver.set(drvId, { total: 0, orderIds: [] })
        const entry = byDriver.get(drvId)!
        entry.total += (o.extra_fee ?? 0)
        entry.orderIds.push(o.id)
      }
      if (byDriver.size === 0) throw new Error('Không tìm thấy thông tin giao nhận cho đơn đã chọn')

      const { data: session } = await supabase.auth.getSession()
      const createdBy = session?.session?.user?.id

      for (const [driverId, { total, orderIds }] of byDriver.entries()) {
        if (total === 0) continue
        const today = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const dateStr = `${today.getFullYear()}${pad(today.getMonth()+1)}${pad(today.getDate())}`
        const rand = String(Math.floor(Math.random() * 9000 + 1000))
        const voucherCode = `PAY-${dateStr}-${rand}`

        const { data: voucher, error: vErr } = await supabase
          .from('payment_vouchers')
          .insert({ driver_id: driverId, voucher_code: voucherCode, total_amount: total, created_by: createdBy })
          .select().single()
        if (vErr) throw vErr

        const items = orderIds.map(oid => ({ voucher_id: voucher.id, order_id: oid, amount: (eligible.find(o => o.id === oid)?.extra_fee ?? 0) }))
        if (items.length > 0) {
          const { error: iErr } = await supabase.from('payment_voucher_items').insert(items)
          if (iErr) throw iErr
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting'] })
      clearSelection() // Bug 4 fix: reset selection
    },
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

// ── Badges ─────────────────────────────────────────────
const PAY_STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  pending:            { label: '⏳ Chờ duyệt',        bg: '#fef9c3', color: '#92400e' },
  approved:           { label: '✅ Đã duyệt',          bg: '#dcfce7', color: '#166534' },
  approved_vouchered: { label: '📋 Trong chứng từ',   bg: '#e0f2fe', color: '#0369a1' },
  approved_paid:      { label: '💵 Đã chi trả',        bg: '#f0fdf4', color: '#15803d' },
  rejected:           { label: '❌ Từ chối',           bg: '#fee2e2', color: '#991b1b' },
}

function PayStatusBadge({ payStatus }: { payStatus: string }) {
  const c = PAY_STATUS_CFG[payStatus] ?? PAY_STATUS_CFG.pending
  return (
    <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

function VoucherStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: '⏳ Chờ chi',   bg: '#fef9c3', color: '#92400e' },
    paid:      { label: '✅ Đã chi trả', bg: '#dcfce7', color: '#166534' },
    confirmed: { label: '✓ Hoàn tất',  bg: '#f0f9ff', color: '#0369a1' },
  }
  const c = cfg[status] ?? cfg.pending
  return <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color }}>{c.label}</span>
}

// ── Proof Photo Zoom ────────────────────────────────────
function ProofPhotoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <img src={url} alt="Ảnh giao hàng" style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12 }} />
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex' }}>
        <X size={20} color="#fff" />
      </button>
    </div>
  )
}

// ── Inline Reject Form ─────────────────────────────────
function InlineRejectForm({ onSubmit, onCancel }: { onSubmit: (r: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ padding: '8px 14px 12px', background: '#fff5f5', borderTop: '1px solid #fecaca' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 6, ...F }}>Lý do từ chối:</div>
      <textarea value={reason} onChange={e => setReason(e.target.value)} autoFocus placeholder="Nhập lý do..." rows={2}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, ...F, resize: 'none', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={onCancel} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, ...F }}>Huỷ</button>
        <button onClick={() => reason.trim() && onSubmit(reason.trim())} disabled={!reason.trim()}
          style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12, ...F, opacity: reason.trim() ? 1 : 0.5 }}>
          Xác nhận
        </button>
      </div>
    </div>
  )
}

// ── Fee Row ────────────────────────────────────────────
function FeeRow({ o, onApprove, onReject, isActing, selected, onToggle }: {
  o: any; onApprove: () => void; onReject: (r: string) => void
  isActing: boolean; selected: boolean; onToggle: () => void
}) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showProof, setShowProof] = useState(false)
  const proofUrl = o.delivery_proof_url || o.proof_photo_url
  const status = o.extra_fee_status as string
  const payStatus = computePaymentStatus(o)
  const voucherCode = o.voucher_items?.[0]?.voucher?.voucher_code

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f8fafc' }}>
        <td style={{ padding: '10px 14px', width: 36 }}>
          {/* Checkbox only for approved-not-yet-vouchered */}
          {payStatus === 'approved' && (
            <input type="checkbox" checked={selected} onChange={onToggle}
              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#059669' }} />
          )}
        </td>
        <td style={{ padding: '10px 8px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', ...F }}>{o.code}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{o.delivery_location?.name ?? '—'}</div>
          {o.extra_fee_note && <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{o.extra_fee_note}"</div>}
          {status === 'rejected' && o.extra_fee_rejected_reason && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>↳ {o.extra_fee_rejected_reason}</div>
          )}
        </td>
        <td style={{ padding: '10px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {o.assigned_driver?.avatar_url
              ? <img src={o.assigned_driver.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0891b2' }}>{o.assigned_driver?.full_name?.[0] ?? '?'}</div>
            }
            <span style={{ fontSize: 12, color: '#475569', ...F }}>{o.assigned_driver?.full_name ?? '—'}</span>
          </div>
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: status === 'rejected' ? '#9ca3af' : '#0f172a', textDecoration: status === 'rejected' ? 'line-through' : 'none', ...F }}>
            {fmt(o.extra_fee ?? 0)}
          </div>
          {proofUrl && (
            <button onClick={() => setShowProof(true)}
              style={{ marginTop: 3, padding: '2px 8px', border: '1px solid #bae6fd', borderRadius: 6, background: '#f0f9ff', color: '#0369a1', fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto', ...F }}>
              <ZoomIn size={10} /> Ảnh
            </button>
          )}
        </td>
        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
          <PayStatusBadge payStatus={payStatus} />
          {voucherCode && <div style={{ fontSize: 10, color: '#0891b2', marginTop: 3, ...F }}>{voucherCode}</div>}
          {o.delivered_at && <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 2 }}>{fmtDate(o.delivered_at)}</div>}
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
          {status === 'pending' && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button onClick={onApprove} disabled={isActing}
                style={{ padding: '4px 12px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...F, opacity: isActing ? 0.7 : 1 }}>
                ✓ Duyệt
              </button>
              <button onClick={() => setShowRejectForm(v => !v)}
                style={{ padding: '4px 12px', borderRadius: 8, background: showRejectForm ? '#fee2e2' : '#f1f5f9', color: showRejectForm ? '#991b1b' : '#64748b', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', ...F }}>
                ✕ Từ chối
              </button>
            </div>
          )}
        </td>
      </tr>
      {showRejectForm && (
        <tr>
          <td colSpan={6} style={{ padding: 0 }}>
            <InlineRejectForm onSubmit={r => { onReject(r); setShowRejectForm(false) }} onCancel={() => setShowRejectForm(false)} />
          </td>
        </tr>
      )}
      {showProof && proofUrl && <ProofPhotoModal url={proofUrl} onClose={() => setShowProof(false)} />}
    </>
  )
}

// ── Main Page ──────────────────────────────────────────
type FeeFilter = 'all' | 'pending' | 'approved' | 'approved_vouchered' | 'approved_paid' | 'rejected'

export function AccountingPage() {
  const [tab, setTab] = useState<'fees' | 'vouchers'>('fees')
  const [feeFilter, setFeeFilter] = useState<FeeFilter>('all')
  const [driverFilter, setDriverFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expandedVoucher, setExpandedVoucher] = useState<string | null>(null)

  // Date range filter
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [dateFrom, setDateFrom] = useState(() => getDatePreset('month').from)
  const [dateTo, setDateTo] = useState(() => getDatePreset('month').to)

  const handleDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom' && preset !== 'all') {
      const { from, to } = getDatePreset(preset)
      setDateFrom(from)
      setDateTo(to)
    }
  }, [])

  const { data: fees = [], isLoading: feesLoading } = useFees()
  const { data: vouchers = [], isLoading: vouchersLoading } = useVouchers()
  const approve = useApproveFee()
  const createVouchers = useCreateVouchers(() => setSelected(new Set()))
  const markPaid = useMarkPaid()

  // Date-filtered fees
  const dateFees = useMemo(() => {
    if (datePreset === 'all') return fees
    if (!dateFrom) return fees
    const from = new Date(dateFrom + 'T00:00:00')
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : new Date()
    return fees.filter(o => {
      const d = o.delivered_at ? new Date(o.delivered_at) : null
      if (!d) return false
      return d >= from && d <= to
    })
  }, [fees, datePreset, dateFrom, dateTo])

  // Stats — use computePaymentStatus for accurate numbers
  const stats = useMemo(() => {
    let pending = 0, approved = 0, paid = 0, total = 0
    for (const o of dateFees) {
      const ps = computePaymentStatus(o)
      const amt = o.extra_fee ?? 0
      if (ps === 'pending') pending += amt
      if (ps === 'approved') approved += amt
      if (ps === 'approved_paid') paid += amt
      // 'Phụ phí tổng' excludes rejected
      if (ps !== 'rejected') total += amt
    }
    return { pending, approved, paid, total }
  }, [dateFees])

  // Counts per payment status
  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, approved_vouchered: 0, approved_paid: 0, rejected: 0 }
    for (const f of dateFees) { const ps = computePaymentStatus(f); c[ps] = (c[ps] ?? 0) + 1 }
    return c
  }, [dateFees])

  // All unique drivers
  const drivers = useMemo(() => {
    const seen = new Map<string, string>()
    for (const o of dateFees) {
      if (o.assigned_driver?.id) seen.set(o.assigned_driver.id, o.assigned_driver.full_name ?? '—')
    }
    return Array.from(seen.entries())
  }, [dateFees])

  // Filtered fees
  const filteredFees = useMemo(() => {
    let list = feeFilter === 'all' ? dateFees : dateFees.filter(f => computePaymentStatus(f) === feeFilter)
    if (driverFilter !== 'all') list = list.filter(f => f.assigned_driver?.id === driverFilter)
    return list
  }, [dateFees, feeFilter, driverFilter])

  // Selection logic
  const selectedOrders = dateFees.filter(f => selected.has(f.id))
  const hasNonApproved = selectedOrders.some(o => computePaymentStatus(o) !== 'approved')
  const selectedDriverCount = useMemo(() => new Set(selectedOrders.map(o => o.assigned_driver?.id).filter(Boolean)).size, [selectedOrders])
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const filterChips: { key: FeeFilter; label: string }[] = [
    { key: 'all',               label: `Tất cả (${dateFees.length})` },
    { key: 'pending',           label: `⏳ Chờ duyệt (${counts.pending})` },
    { key: 'approved',          label: `✅ Đã duyệt (${counts.approved})` },
    { key: 'approved_vouchered',label: `📋 Trong CT (${counts.approved_vouchered})` },
    { key: 'approved_paid',     label: `💵 Đã chi (${counts.approved_paid})` },
    { key: 'rejected',          label: `❌ Từ chối (${counts.rejected})` },
  ]

  return (
    <div style={{ ...F, maxWidth: 1020 }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Receipt size={18} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Kế toán & Phụ phí</h1>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Duyệt phụ phí và tạo chứng từ chi trả</p>
        </div>
      </div>

      {/* Date Filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Calendar size={15} color="#94a3b8" />
        {[
          { key: 'all' as DatePreset, label: 'Tất cả' },
          { key: 'today' as DatePreset, label: 'Hôm nay' },
          { key: 'week' as DatePreset, label: 'Tuần này' },
          { key: 'month' as DatePreset, label: 'Tháng này' },
          { key: 'custom' as DatePreset, label: 'Tuỳ chọn' },
        ].map(p => (
          <button key={p.key} onClick={() => handleDatePreset(p.key)}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', ...F, transition: 'all 0.15s ease',
              border: datePreset === p.key ? 'none' : '1px solid #e2e8f0',
              background: datePreset === p.key ? '#0891b2' : '#fff',
              color: datePreset === p.key ? '#fff' : '#64748b',
            }}>
            {p.label}
          </button>
        ))}
        {(datePreset === 'custom' || datePreset !== 'all') && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setDatePreset('custom') }}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, ...F, color: '#475569', background: '#fff' }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>→</span>
            <input type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setDatePreset('custom') }}
              style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, ...F, color: '#475569', background: '#fff' }} />
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { icon: <Clock size={16} color="#d97706" />, label: 'Chờ duyệt', value: fmt(stats.pending), color: '#d97706' },
          { icon: <CheckCircle size={16} color="#059669" />, label: 'Đã duyệt chưa chi', value: fmt(stats.approved), color: '#059669' },
          { icon: <Receipt size={16} color="#7c3aed" />, label: 'Đã chi trả', value: fmt(stats.paid), color: '#7c3aed' },
          { icon: <DollarSign size={16} color="#0891b2" />, label: 'Phụ phí tổng', value: fmt(stats.total), color: '#0891b2' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', marginBottom: 18, border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc' }}>
        {(['fees', 'vouchers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', ...F, background: tab === t ? '#fff' : 'transparent', color: tab === t ? '#059669' : '#94a3b8', borderBottom: tab === t ? '2px solid #059669' : '2px solid transparent' }}>
            {{ fees: 'Danh sách phụ phí', vouchers: 'Chứng từ chi trả' }[t]}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Fees ── */}
      {tab === 'fees' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {filterChips.map(({ key, label }) => (
                <button key={key} onClick={() => setFeeFilter(key)}
                  style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: feeFilter === key ? 'none' : '1px solid #e2e8f0', background: feeFilter === key ? '#059669' : '#fff', color: feeFilter === key ? '#fff' : '#64748b', ...F }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Driver filter */}
            <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569', ...F, background: '#fff', cursor: 'pointer' }}>
              <option value="all">— Tất cả giao nhận —</option>
              {drivers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>

            {/* Voucher create action */}
            {selected.size > 0 && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                {hasNonApproved && <span style={{ fontSize: 11, color: '#d97706' }}>⚠️ Bỏ chọn đơn đã trong chứng từ</span>}
                <button onClick={() => createVouchers.mutate({ selectedIds: selected })}
                  disabled={createVouchers.isPending || hasNonApproved}
                  style={{ padding: '6px 14px', borderRadius: 10, background: hasNonApproved ? '#94a3b8' : '#059669', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: hasNonApproved ? 'not-allowed' : 'pointer', ...F }}>
                  {createVouchers.isPending
                    ? 'Đang tạo...'
                    : `Tạo ${selectedDriverCount > 1 ? selectedDriverCount + ' chứng từ' : 'chứng từ'} (${selected.size} đơn)`}
                </button>
              </div>
            )}
          </div>

          {feesLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', ...F }}>Đang tải...</div>
          ) : filteredFees.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', ...F }}>
              <DollarSign size={40} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />Không có phụ phí nào
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '10px 14px', width: 36 }}></th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, ...F }}>Mã đơn / Địa điểm</th>
                    <th style={{ padding: '10px 8px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, ...F }}>Giao nhận</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: 11, ...F }}>Số tiền</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 11, ...F }}>Trạng thái</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: 11, ...F }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.map(o => (
                    <FeeRow key={o.id} o={o} selected={selected.has(o.id)} onToggle={() => toggleSelect(o.id)}
                      onApprove={() => approve.mutate({ orderId: o.id, approve: true })}
                      onReject={r => approve.mutate({ orderId: o.id, approve: false, reason: r })}
                      isActing={approve.isPending} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {createVouchers.isError && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#fee2e2', borderRadius: 10, fontSize: 12, color: '#991b1b', ...F }}>
              ❌ {(createVouchers.error as Error)?.message}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Vouchers ── */}
      {tab === 'vouchers' && (
        <div>
          {vouchersLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', ...F }}>Đang tải...</div>
          ) : vouchers.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', ...F }}>
              <Receipt size={40} style={{ opacity: 0.2, display: 'block', margin: '0 auto 12px' }} />Chưa có chứng từ nào
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vouchers.map((v: any) => {
                const isExp = expandedVoucher === v.id
                const items: any[] = v.items ?? []
                return (
                  <div key={v.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => setExpandedVoucher(isExp ? null : v.id)}>
                      <div>
                        {v.driver?.avatar_url
                          ? <img src={v.driver.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0891b2' }}>{v.driver?.full_name?.[0] ?? '?'}</div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', ...F }}>{v.driver?.full_name ?? '—'}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{v.voucher_code}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, ...F }}>{fmtDate(v.created_at)} · {items.length} đơn</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#059669', ...F }}>{fmt(v.total_amount)}</div>
                      <VoucherStatusBadge status={v.status} />
                      {v.status === 'pending' && (
                        <button onClick={e => { e.stopPropagation(); markPaid.mutate(v.id) }}
                          style={{ padding: '5px 12px', borderRadius: 8, background: '#0891b2', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', ...F }}>
                          Đã chi trả
                        </button>
                      )}
                      {isExp ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                    </div>
                    {isExp && (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 18px 12px' }}>
                        {items.map((item: any) => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{item.order?.code}</span>
                            <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{item.order?.delivery_location?.name}</span>
                            <span style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', ...F }}>{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
