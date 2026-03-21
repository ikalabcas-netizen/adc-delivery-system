import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, MapPin, Truck, Calendar, Receipt } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const fmt = (n: number) => n?.toLocaleString('vi-VN') + ' ₫'
const fmtDate = (s: string) => new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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
    d.setDate(d.getDate() - d.getDay() + 1)
    return { from: toLocalDateStr(d), to }
  }
  if (preset === 'month') {
    return { from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  }
  return { from: '', to: '' }
}
type DatePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

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

function computeShiftPaymentStatus(s: any): string {
  const base = s.km_approval_status as string
  if (base === 'rejected') return 'rejected'
  if (base !== 'approved') return base
  const items: any[] = s.voucher_items ?? []
  if (items.length === 0) return 'approved'
  const voucher = items[0]?.voucher
  if (!voucher) return 'approved'
  if (voucher.status === 'paid' || voucher.status === 'confirmed') return 'approved_paid'
  return 'approved_vouchered'
}

// ── Hooks ──────────────────────────────────────────────
function useAccountingData() {
  const qcFees = useQuery({
    queryKey: ['accounting', 'fees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select(`
          id, code, extra_fee, extra_fee_note, extra_fee_status, extra_fee_rejected_reason,
          delivery_proof_url, proof_photo_url, delivered_at,
          assigned_driver:profiles!orders_assigned_to_fkey(id, full_name, avatar_url, phone),
          delivery_location:locations!orders_delivery_location_id_fkey(id, name),
          voucher_items:payment_voucher_items!payment_voucher_items_order_id_fkey(voucher:payment_vouchers(id, voucher_code, status))
        `).gt('extra_fee', 0).order('delivered_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    }
  })

  const qcShifts = useQuery({
    queryKey: ['accounting', 'shifts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_shifts').select(`
          id, started_at, ended_at, km_in, km_out, km_driven, status,
          odometer_photo_in_url, odometer_photo_out_url,
          km_approval_status, km_approval_note, km_payment_amount,
          driver:profiles!driver_shifts_driver_id_fkey(id, full_name, avatar_url),
          voucher_items:payment_voucher_items!payment_voucher_items_shift_id_fkey(voucher:payment_vouchers(id, voucher_code, status))
        `).eq('status', 'ended').order('ended_at', { ascending: false })
      if (error) {
         console.error('Lỗi khi fetch shifts:', error);
         throw error;
      }
      return (data ?? []) as any[]
    }
  })

  const qcVouchers = useQuery({
    queryKey: ['accounting', 'vouchers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payment_vouchers').select(`
          id, voucher_code, total_amount, status, type, paid_at, created_at,
          driver:profiles!payment_vouchers_driver_id_fkey(id, full_name, avatar_url),
          items:payment_voucher_items(
            id, amount, order_id, shift_id,
            order:orders!payment_voucher_items_order_id_fkey(code, delivery_location:locations!orders_delivery_location_id_fkey(name)),
            shift:driver_shifts!payment_voucher_items_shift_id_fkey(started_at, ended_at)
          )
        `).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as any[]
    }
  })

  const qcConfig = useQuery({
    queryKey: ['accounting-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('key, value').eq('key', 'accounting_config').maybeSingle()
      if (error) throw error
      return data?.value as Record<string, any> ?? {}
    },
    staleTime: 1000 * 60 * 5,
  })

  return { fees: qcFees, shifts: qcShifts, vouchers: qcVouchers, config: qcConfig }
}

function useMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['accounting'] })

  const approveFee = useMutation({
    mutationFn: async ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => {
      await supabase.from('orders').update({
        extra_fee_status: approve ? 'approved' : 'rejected',
        ...(approve ? {} : { extra_fee_rejected_reason: reason }),
      }).eq('id', id)
    },
    onSuccess: refresh
  })

  const approveShift = useMutation({
    mutationFn: async ({ id, approve, reason, amount }: { id: string; approve: boolean; reason?: string, amount?: number }) => {
      const { data: session } = await supabase.auth.getSession()
      await supabase.from('driver_shifts').update({
        km_approval_status: approve ? 'approved' : 'rejected',
        km_approval_note: reason || null,
        km_approved_by: session?.session?.user?.id,
        km_approved_at: new Date().toISOString(),
        km_payment_amount: amount || 0
      }).eq('id', id)
    },
    onSuccess: refresh
  })

  const createVouchers = useMutation({
    mutationFn: async ({ items, type }: { items: { id: string, driverId: string, amount: number }[], type: 'extra_fee' | 'km_payment' }) => {
      if (items.length === 0) throw new Error('Chưa chọn mục nào')
      const byDriver = new Map<string, { total: number; ids: string[] }>()
      for (const i of items) {
        if (!byDriver.has(i.driverId)) byDriver.set(i.driverId, { total: 0, ids: [] })
        const d = byDriver.get(i.driverId)!
        d.total += i.amount; d.ids.push(i.id)
      }
      const { data: session } = await supabase.auth.getSession()
      for (const [drv, { total, ids }] of byDriver.entries()) {
        if (total <= 0) continue
        const code = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`
        const { data: voucher } = await supabase.from('payment_vouchers')
          .insert({ driver_id: drv, voucher_code: code, total_amount: total, type, created_by: session?.session?.user?.id })
          .select().single()
        
        const vi = ids.map(id => ({
          voucher_id: voucher!.id,
          order_id: type === 'extra_fee' ? id : null,
          shift_id: type === 'km_payment' ? id : null,
          amount: items.find(x => x.id === id)!.amount
        }))
        await supabase.from('payment_voucher_items').insert(vi)
      }
    },
    onSuccess: refresh
  })

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('payment_vouchers').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: refresh
  })

  return { approveFee, approveShift, createVouchers, markPaid }
}

// ── UI Components ──────────────────────────────────────
const STATUS_CFG: Record<string, any> = {
  pending: { label: '⏳ Chờ xử lý', bg: '#fffbeb', color: '#d97706' },
  approved: { label: '✅ Đã duyệt', bg: '#dcfce7', color: '#16a34a' },
  approved_vouchered: { label: '📋 Lên chứng từ', bg: '#eff6ff', color: '#2563eb' },
  approved_paid: { label: '💵 Đã thanh toán', bg: '#f0fdf4', color: '#15803d' },
  rejected: { label: '❌ Từ chối', bg: '#fff1f2', color: '#e11d48' },
}
function Badge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.pending
  return <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{c.label}</span>
}

function PhotoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <img src={url} alt="Photo" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
    </div>
  )
}

function ShiftPhotosModal({ s, onClose }: { s: any; onClose: () => void }) {
  const F = { fontFamily: 'Outfit, sans-serif' }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 800, width: '100%', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a', ...F }}>Hình ảnh Odometer & KM Giao nhận khai báo</h3>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8, ...F }}>✅ Bắt đầu ca</div>
            {s.odometer_photo_in_url ? (
              <img src={s.odometer_photo_in_url} alt="In" style={{ width: '100%', height: 300, objectFit: 'contain', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            ) : <div style={{ height: 300, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', ...F }}>Không có ảnh</div>}
            <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', ...F }}>KM khai báo (Vào ca)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', ...F }}>{s.km_in?.toLocaleString() ?? '—'} km</div>
            </div>
          </div>
          <div style={{ flex: '1 1 300px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 8, ...F }}>🏁 Kết thúc ca</div>
            {s.odometer_photo_out_url ? (
              <img src={s.odometer_photo_out_url} alt="Out" style={{ width: '100%', height: 300, objectFit: 'contain', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            ) : <div style={{ height: 300, background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', ...F }}>Không có ảnh</div>}
            <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', ...F }}>KM khai báo (Ra ca)</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', ...F }}>{s.km_out?.toLocaleString() ?? '—'} km</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RejectForm({ onSubmit, onCancel, showAmountInput }: { onSubmit: (r: string, a?: number) => void; onCancel: () => void, showAmountInput?: boolean }) {
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  return (
    <div style={{ padding: '8px 14px 12px', background: '#fff5f5', borderTop: '1px solid #fecaca' }}>
      {showAmountInput && (
         <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4, ...F }}>Số tiền duyệt ngoại lệ (VND) - Để trống nếu từ chối luôn:</div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 50000" style={{ width: 150, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, ...F }} />
         </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 600, color: '#991b1b', marginBottom: 4, ...F }}>Lý do / Ghi chú:</div>
      <textarea value={reason} onChange={e => setReason(e.target.value)} autoFocus rows={2}
        style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #fecaca', fontSize: 12, ...F, resize: 'none' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button onClick={onCancel} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', ...F, fontSize: 12 }}>Huỷ</button>
        <button onClick={() => reason.trim() && onSubmit(reason.trim(), Number(amount))} disabled={!reason.trim()}
          style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: amount ? '#059669' : '#dc2626', color: '#fff', fontWeight: 600, cursor: 'pointer', ...F, fontSize: 12, opacity: reason.trim() ? 1 : 0.5 }}>
          Xác nhận {amount ? 'Duyệt ngoại lệ' : 'Từ chối'}
        </button>
      </div>
    </div>
  )
}

// ── Tab 1: FeeRow ──────────────────────────────────────
function FeeRow({ o, onApprove, onReject, selected, onToggle, isActing }: any) {
  const [rej, setRej] = useState(false)
  const [photo, setPhoto] = useState('')
  const ps = computePaymentStatus(o)
  return (
    <>
      <tr style={{ borderBottom: '1px solid #f8fafc' }}>
        <td style={{ padding: '10px 14px' }}>{ps === 'approved' && <input type="checkbox" checked={selected} onChange={onToggle} style={{ width: 14, height: 14, cursor: 'pointer' }} />}</td>
        <td style={{ padding: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', ...F }}>{o.code}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{o.delivery_location?.name}</div>
          {o.extra_fee_note && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>"{o.extra_fee_note}"</div>}
          {o.extra_fee_status === 'rejected' && <div style={{ fontSize: 11, color: '#ef4444' }}>↳ {o.extra_fee_rejected_reason}</div>}
        </td>
        <td style={{ padding: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {o.assigned_driver?.avatar_url ? <img src={o.assigned_driver.avatar_url} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{o.assigned_driver?.full_name?.[0]}</div>}
            <span style={{ fontSize: 12, ...F }}>{o.assigned_driver?.full_name}</span>
          </div>
        </td>
        <td style={{ padding: '8px', textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: o.extra_fee_status === 'rejected' ? '#94a3b8' : '#0f172a', textDecoration: o.extra_fee_status === 'rejected' ? 'line-through' : 'none', ...F }}>{fmt(o.extra_fee)}</div>
          {(o.delivery_proof_url || o.proof_photo_url) && <button onClick={() => setPhoto(o.delivery_proof_url || o.proof_photo_url)} style={{ marginTop: 2, padding: '2px 6px', fontSize: 10, background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: 4, cursor: 'pointer', ...F }}>Xem ảnh</button>}
        </td>
        <td style={{ padding: '8px', textAlign: 'center' }}><Badge status={ps} /> {o.delivered_at && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{fmtDate(o.delivered_at)}</div>}</td>
        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
          {ps === 'pending' && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <button onClick={onApprove} disabled={isActing} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...F, boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>Duyệt</button>
              <button onClick={() => setRej(!rej)} style={{ background: rej ? '#fff1f2' : '#f8fafc', color: rej ? '#e11d48' : '#475569', border: rej ? '1px solid rgba(225,29,72,0.15)' : '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', ...F }}>Từ chối</button>
            </div>
          )}
        </td>
      </tr>
      {rej && <tr><td colSpan={6} style={{ padding: 0 }}><RejectForm onSubmit={r => { onReject(r); setRej(false) }} onCancel={() => setRej(false)} /></td></tr>}
      {photo && <PhotoModal url={photo} onClose={() => setPhoto('')} />}
    </>
  )
}

// ── Tab 2: ShiftRow ────────────────────────────────────
function ShiftRow({ s, onApprove, onReject, selected, onToggle, isActing, pricePerKm = 3500 }: any) {
  const F = { fontFamily: 'Outfit, sans-serif' }
  const [showEdit, setShowEdit] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  
  const defaultExpected = Math.round((s.km_driven ?? 0) * pricePerKm);
  const [overrideAmt, setOverrideAmt] = useState<number | null>(null);
  const [overrideNote, setOverrideNote] = useState<string>('');
  
  const [tempAmt, setTempAmt] = useState(defaultExpected.toString())
  const [tempNote, setTempNote] = useState('')

  const ps = computeShiftPaymentStatus(s)
  const totalCost = s.km_payment_amount || 0
  const currentExpected = overrideAmt !== null ? overrideAmt : defaultExpected;

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f8fafc', background: overrideAmt !== null && ps === 'pending' ? '#fffbeb' : 'transparent' }}>
        <td style={{ padding: '10px 14px' }}>{ps === 'approved' && <input type="checkbox" checked={selected} onChange={onToggle} style={{ width: 14, height: 14, cursor: 'pointer' }} />}</td>
        <td style={{ padding: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: 12, ...F }}>{fmtDate(s.started_at)}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{fmtTime(s.started_at)} - {s.ended_at ? fmtTime(s.ended_at) : '...'}</div>
          {s.km_approval_status !== 'pending' && s.km_approval_note && <div style={{ fontSize: 11, color: s.km_approval_status === 'rejected' ? '#ef4444' : '#64748b', fontStyle: 'italic', marginTop: 2 }}>"{s.km_approval_note}"</div>}
        </td>
        <td style={{ padding: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.driver?.avatar_url ? <img src={s.driver.avatar_url} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.driver?.full_name?.[0]}</div>}
            <span style={{ fontSize: 12, ...F }}>{s.driver?.full_name}</span>
          </div>
        </td>
        <td style={{ padding: '8px' }}>
          <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600, ...F }}>
            Thực tế: {s.km_driven ?? 0} km
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
             <button onClick={() => setShowPhotos(true)} style={{ padding: '2px 8px', fontSize: 10, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 4, cursor: 'pointer', fontWeight: 600, ...F }}>Xem hình ảnh Odometer & KM</button>
          </div>
        </td>
        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontSize: 13, ...F }}>
          {ps === 'pending' ? (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
               <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Dự kiến:</div>
               <div style={{ color: overrideAmt !== null ? '#d97706' : '#0f172a' }}>{fmt(currentExpected)}</div>
               {overrideAmt !== null && <div style={{ fontSize: 10, color: '#d97706', fontWeight: 500 }}>(Đã chỉnh sửa)</div>}
             </div>
          ) : (totalCost > 0 ? fmt(totalCost) : '—')}
        </td>
        <td style={{ padding: '8px', textAlign: 'center' }}><Badge status={ps} /></td>
        <td style={{ padding: '8px 14px', textAlign: 'right' }}>
          {ps === 'pending' && (
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button 
                onClick={() => onApprove(currentExpected, overrideNote)} 
                disabled={isActing} 
                style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', ...F, boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}
              >
                Duyệt
              </button>
              <button 
                onClick={() => setShowEdit(!showEdit)} 
                style={{ background: showEdit ? '#e0e7ff' : '#f8fafc', color: showEdit ? '#4338ca' : '#475569', border: showEdit ? '1px solid #c7d2fe' : '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600, ...F }}
              >
                Sửa/Từ chối
              </button>
            </div>
          )}
        </td>
      </tr>
      {showEdit && ps === 'pending' && (
        <tr>
          <td colSpan={7} style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
               <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                 <div style={{ minWidth: 120 }}>
                   <div style={{ fontSize: 12, color: '#64748b', ...F }}>Số tiền báo cáo:</div>
                   <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', ...F }}>{fmt(defaultExpected)}</div>
                 </div>
                 <div style={{ minWidth: 140 }}>
                   <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4, ...F }}>Số tiền điều chỉnh (₫):</div>
                   <input type="number" value={tempAmt} onChange={e => setTempAmt(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, ...F }} />
                 </div>
                 <div style={{ flex: '1 1 200px' }}>
                   <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', marginBottom: 4, ...F }}>Ghi chú điều chỉnh / Từ chối:</div>
                   <input type="text" value={tempNote} onChange={e => setTempNote(e.target.value)} placeholder="Nhập lý do điều chỉnh hoặc từ chối..." style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, ...F }} />
                 </div>
                 <div style={{ display: 'flex', gap: 8 }}>
                   <button onClick={() => { setOverrideAmt(Number(tempAmt)); setOverrideNote(tempNote); setShowEdit(false); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', ...F, fontSize: 12, fontWeight: 600, height: 32 }}>Cập nhật dự kiến</button>
                   <button onClick={() => onReject(tempNote)} disabled={!tempNote.trim() || isActing} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#e11d48', color: '#fff', cursor: 'pointer', ...F, fontSize: 12, fontWeight: 600, height: 32, opacity: tempNote.trim() ? 1 : 0.5 }}>Từ chối</button>
                 </div>
               </div>
            </div>
          </td>
        </tr>
      )}
      {showPhotos && <ShiftPhotosModal s={s} onClose={() => setShowPhotos(false)} />}
    </>
  )
}

function VoucherRow({ v, onMarkPaid }: { v: any, onMarkPaid: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isKm = v.type === 'km_payment'
  
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'background 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
      >
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: isKm ? '#dcfce7' : '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isKm ? <MapPin size={18} color="#16a34a"/> : <Truck size={18} color="#ea580c"/>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', ...F }}>{v.driver?.full_name}</span>
            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{v.voucher_code}</span>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: isKm ? '#dcfce7' : '#ffedd5', color: isKm ? '#166534' : '#9a3412', fontWeight: 600 }}>{isKm ? 'KM' : 'Phụ phí'}</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Ngày lập: {fmtDate(v.created_at)} · {v.items?.length || 0} mục chi</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', ...F }}>{fmt(v.total_amount)}</div>
        <div onClick={e => e.stopPropagation()}><Badge status={v.status === 'paid' ? 'approved_paid' : 'pending'} /></div>
        {v.status === 'pending' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onMarkPaid(); }} 
            style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.3)', ...F }}
          >
            Xác nhận chi
          </button>
        )}
        <div style={{ marginLeft: 8, color: '#94a3b8' }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {expanded && (
        <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4, ...F }}>Chi tiết chứng từ:</div>
          {(v.items || []).map((item: any) => {
            const dateStr = item.shift?.started_at ? fmtDate(item.shift.started_at) : '—';
            const timeStr = item.shift?.started_at ? fmtTime(item.shift.started_at) : '';
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', ...F }}>
                      {isKm ? `Ca làm việc ngày ${dateStr}` : (item.order?.code || '—')}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', ...F }}>
                      {isKm ? `Bắt đầu ca lúc ${timeStr}` : (item.order?.delivery_location?.name || '—')}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', ...F }}>
                  {fmt(item.amount)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AccountingPage() {
  const [tab, setTab] = useState<'fees' | 'km_payments' | 'vouchers'>('fees')
  const [feeFilter, setFeeFilter] = useState('all') // Also used for km
  const [driverFilter, setDriverFilter] = useState('all')
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<'all' | 'extra_fee' | 'km_payment'>('all')
  
  const [selFees, setSelFees] = useState<Set<string>>(new Set())
  const [selShifts, setSelShifts] = useState<Set<string>>(new Set())
  
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [dateFrom, setDateFrom] = useState(() => getDatePreset('month').from)
  const [dateTo, setDateTo] = useState(() => getDatePreset('month').to)

  const { fees, shifts, vouchers, config } = useAccountingData()
  const pricePerKm = (config.data?.price_per_km as number) ?? 3500
  const mut = useMutations()

  const handleDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom' && preset !== 'all') {
      const { from, to } = getDatePreset(preset)
      setDateFrom(from); setDateTo(to)
    }
  }, [])

  const filterByDate = (dateStr: string | null) => {
    if (datePreset === 'all' || !dateFrom || !dateStr) return true
    const d = new Date(dateStr)
    const from = new Date(dateFrom + 'T00:00:00')
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : new Date()
    return d >= from && d <= to
  }

  // Fees
  const dfFees = (fees.data || []).filter(o => filterByDate(o.delivered_at))
  const fFees = dfFees.filter(f => (feeFilter === 'all' || computePaymentStatus(f) === feeFilter) && (driverFilter === 'all' || f.assigned_driver?.id === driverFilter))
  
  // Shifts
  const dfShifts = (shifts.data || []).filter(s => filterByDate(s.ended_at || s.started_at))
  const fShifts = dfShifts.filter(s => (feeFilter === 'all' || computeShiftPaymentStatus(s) === feeFilter) && (driverFilter === 'all' || s.driver?.id === driverFilter))

  // Vouchers
  const fVouchers = (vouchers.data || []).filter(v => (datePreset === 'all' || filterByDate(v.created_at)) && (driverFilter === 'all' || v.driver?.id === driverFilter) && (voucherTypeFilter === 'all' || v.type === voucherTypeFilter))

  // Drivers shared list
  const allDrivers = useMemo(() => {
    const s = new Map()
    for (const f of dfFees) if (f.assigned_driver?.id) s.set(f.assigned_driver.id, f.assigned_driver.full_name)
    for (const d of dfShifts) if (d.driver?.id) s.set(d.driver.id, d.driver.full_name)
    for (const v of vouchers.data || []) if (v.driver?.id) s.set(v.driver.id, v.driver.full_name)
    return Array.from(s.entries())
  }, [dfFees, dfShifts, vouchers.data])

  // Stats
  const statFees = useMemo(() => {
    let pending = 0, app = 0, paid = 0, tot = 0
    for (const o of fFees) {
      const s = computePaymentStatus(o), a = o.extra_fee || 0
      if (s === 'pending') pending += a
      if (s === 'approved') app += a
      if (s === 'approved_paid') paid += a
      if (s !== 'rejected') tot += a
    }
    return { pending, app, paid, tot }
  }, [fFees])

  const statShifts = useMemo(() => {
    let pendingCost = 0, appCost = 0, paidCost = 0, totKm = 0
    for (const s of fShifts) {
      const st = computeShiftPaymentStatus(s), a = s.km_payment_amount || 0
      totKm += (s.km_driven ?? 0)
      if (st === 'pending') pendingCost += ((s.km_driven||0) * pricePerKm)
      if (st === 'approved') appCost += a
      if (st === 'approved_paid') paidCost += a
    }
    return { pendingCost, appCost, paidCost, totKm }
  }, [fShifts, pricePerKm])

  const statVouchers = useMemo(() => {
    let pending = 0, paid = 0
    for (const v of fVouchers) {
       if (v.status === 'pending') pending += v.total_amount
       else paid += v.total_amount
    }
    return { count: fVouchers.length, pending, paid }
  }, [fVouchers])


  return (
    <div style={{ ...F, maxWidth: 1040 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Receipt size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Kế toán & Chi trả</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontFamily: 'Outfit, sans-serif', margin: 0 }}>Quản lý phụ phí, KM giao nhận và chứng từ</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['fees', 'km_payments', 'vouchers'] as const).map(t => {
           const l = t === 'fees' ? 'Phụ phí đơn hàng' : t === 'km_payments' ? 'Chi trả ca KM' : 'Chứng từ chi trả'
           return (
             <button key={t} onClick={() => { setTab(t); setFeeFilter('all'); }} style={{ padding: '8px 18px', border: tab === t ? 'none' : '1px solid #e2e8f0', borderRadius: 20, background: tab === t ? '#4f46e5' : '#fff', color: tab === t ? '#fff' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', ...F }}>
               {l}
             </button>
           )
        })}
      </div>

      {/* Global Filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 16px', background: '#fff', borderRadius: 12,
        border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
         <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Calendar size={16} color="#94a3b8" />
            {(['today', 'week', 'month', 'custom'] as DatePreset[]).map(p => {
              const labels: Record<DatePreset, string> = { today: 'Hôm nay', week: 'Tuần', month: 'Tháng', custom: 'Tùy chọn', all: 'Mọi lúc' }
              return (
                <button key={p} onClick={() => handleDatePreset(p)} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  border: datePreset === p ? 'none' : '1px solid #e2e8f0',
                  background: datePreset === p ? '#4f46e5' : '#fff',
                  color: datePreset === p ? '#fff' : '#64748b',
                }}>{labels[p]}</button>
              )
            })}
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
                 <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '5px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, ...F }}/>
                 <span style={{ fontSize: 11, color: '#94a3b8' }}>→</span>
                 <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '5px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, ...F }}/>
              </div>
            )}
         </div>
         <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, ...F, cursor: 'pointer', background: '#fff' }}>
           <option value="all">— Tất cả giao nhận —</option>
           {allDrivers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
         </select>
         {tab === 'vouchers' && (
           <select value={voucherTypeFilter} onChange={e => setVoucherTypeFilter(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, ...F, cursor: 'pointer', background: '#fff', marginLeft: 'auto' }}>
             <option value="all">Tất cả loại Chứng từ</option>
             <option value="extra_fee">Chỉ Phụ phí</option>
             <option value="km_payment">Chỉ Chi trả KM</option>
           </select>
         )}
      </div>

      {/* Tab Specific Content */}
      {tab === 'fees' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {['all', 'pending', 'approved', 'approved_paid', 'rejected'].map(k => (
              <button key={k} onClick={() => setFeeFilter(k)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: feeFilter === k ? '#4f46e5' : '#e2e8f0', background: feeFilter === k ? '#e0e7ff' : '#fff', color: feeFilter === k ? '#4338ca' : '#64748b', cursor: 'pointer', ...F }}>
                {k === 'all' ? 'Tất cả' : STATUS_CFG[k]?.label || k}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[{ l:'Chờ duyệt', v:statFees.pending, c:'#d97706' }, { l:'Đã duyệt chưa chi', v:statFees.app, c:'#4f46e5' }, { l:'Đã chi trả', v:statFees.paid, c:'#059669' }, { l:'Tổng phụ phí', v:statFees.tot, c:'#0f172a' }].map(s => (
               <div key={s.l} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: 13, color: '#64748b' }}>{s.l}</div>
                 <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{fmt(s.v)}</div>
               </div>
            ))}
          </div>
          {selFees.size > 0 && <button onClick={() => {
             const items = dfFees.filter(f => selFees.has(f.id)).map(f => ({ id: f.id, driverId: f.assigned_driver?.id, amount: f.extra_fee }));
             mut.createVouchers.mutate({ items, type: 'extra_fee' }, { onSuccess: () => setSelFees(new Set()) });
          }} style={{ marginBottom: 16, padding: '9px 20px', borderRadius: 9, background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.3)', ...F }}>Tạo chứng từ Phụ phí ({selFees.size})</button>}
          
          <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 12 }}>
                <th style={{ width: 40, padding: 10 }}></th><th style={{ padding: 10 }}>Đơn hàng</th><th style={{ padding: 10 }}>Giao nhận</th><th style={{ textAlign:'right', padding: 10 }}>Số tiền</th><th style={{ textAlign:'center', padding: 10 }}>Trạng thái</th><th style={{ textAlign:'right', padding: 10 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {fFees.map((f: any) => <FeeRow key={f.id} o={f} selected={selFees.has(f.id)} onToggle={() => setSelFees(s => { const ns = new Set(s); ns.has(f.id)?ns.delete(f.id):ns.add(f.id); return ns })} onApprove={()=>mut.approveFee.mutate({id:f.id, approve: true})} onReject={(r:string)=>mut.approveFee.mutate({id:f.id, approve:false, reason:r})} isActing={mut.approveFee.isPending} />)}
            </tbody>
          </table>
        </>
      )}

      {tab === 'km_payments' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {['all', 'pending', 'approved', 'approved_paid', 'rejected'].map(k => (
              <button key={k} onClick={() => setFeeFilter(k)} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: feeFilter === k ? '#4f46e5' : '#e2e8f0', background: feeFilter === k ? '#e0e7ff' : '#fff', color: feeFilter === k ? '#4338ca' : '#64748b', cursor: 'pointer', ...F }}>
                {k === 'all' ? 'Tất cả' : STATUS_CFG[k]?.label || k}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[{ l:'Dự trù (chờ duyệt)', v:fmt(statShifts.pendingCost), c:'#d97706' }, { l:'Đã duyệt chưa chi', v:statShifts.appCost, c:'#4f46e5' }, { l:'Đã chi trả', v:fmt(statShifts.paidCost), c:'#059669' }, { l:'Tổng KM đi được', v:statShifts.totKm+' km', c:'#0f172a' }].map(s => (
               <div key={s.l} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: 13, color: '#64748b' }}>{s.l}</div>
                 <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{typeof s.v === 'number' ? fmt(s.v) : s.v}</div>
               </div>
            ))}
          </div>
          {selShifts.size > 0 && <button onClick={() => {
             const items = dfShifts.filter(s => selShifts.has(s.id)).map(s => ({ id: s.id, driverId: s.driver?.id, amount: s.km_payment_amount }));
             mut.createVouchers.mutate({ items, type: 'km_payment' }, { onSuccess: () => setSelShifts(new Set()) });
          }} style={{ marginBottom: 16, padding: '9px 20px', borderRadius: 9, background: 'linear-gradient(135deg, #4f46e5, #4338ca)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.3)', ...F }}>Tạo chứng từ KM ({selShifts.size})</button>}

          <table style={{ width: '100%', background: '#fff', borderRadius: 12, overflow: 'hidden', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: 12 }}>
                <th style={{ width: 40, padding: 10 }}></th><th style={{ padding: 10 }}>Ca làm việc</th><th style={{ padding: 10 }}>Giao nhận</th><th style={{ padding: 10 }}>Quãng đường (KM)</th><th style={{ textAlign:'right', padding: 10 }}>Số tiền chi</th><th style={{ textAlign:'center', padding: 10 }}>Trạng thái</th><th style={{ textAlign:'right', padding: 10 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {fShifts.map((s: any) => <ShiftRow key={s.id} s={s} selected={selShifts.has(s.id)} onToggle={() => setSelShifts(set => { const ns = new Set(set); ns.has(s.id)?ns.delete(s.id):ns.add(s.id); return ns })} onApprove={(a:number, r?:string)=>mut.approveShift.mutate({id:s.id, approve: true, amount: a, reason:r})} onReject={(r:string)=>mut.approveShift.mutate({id:s.id, approve:false, reason:r})} isActing={mut.approveShift.isPending} pricePerKm={pricePerKm} />)}
            </tbody>
          </table>
        </>
      )}

      {tab === 'vouchers' && (
         <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[{ l:'Tổng số chứng từ', v:statVouchers.count+' CT', c:'#0f172a' }, { l:'Chờ thanh toán', v:fmt(statVouchers.pending), c:'#d97706' }, { l:'Đã thanh toán', v:fmt(statVouchers.paid), c:'#059669' }].map(s => (
               <div key={s.l} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <div style={{ fontSize: 13, color: '#64748b' }}>{s.l}</div>
                 <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
               </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fVouchers.map((v:any) => (
              <VoucherRow key={v.id} v={v} onMarkPaid={() => mut.markPaid.mutate(v.id)} />
            ))}
          </div>
         </>
      )}
    </div>
  )
}
