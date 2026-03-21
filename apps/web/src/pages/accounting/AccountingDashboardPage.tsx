import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Clock, Truck, DollarSign, Fuel, Users,
  Calendar, TrendingUp, TrendingDown, Receipt,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useOdometerTracking, OdometerFilters } from '@/hooks/useOdometerTracking'

const F = { fontFamily: 'Outfit, sans-serif' }
const fmt = (n: number) => n.toLocaleString('vi-VN') + ' ₫'
const fmtKm = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

// ── Date helpers ────────────────────────────────────────
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function getDatePreset(preset: string): { from: string; to: string } {
  const today = new Date()
  const to = toLocalDateStr(today)
  if (preset === 'today') return { from: to, to }
  if (preset === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - d.getDay() + 1)
    return { from: toLocalDateStr(d), to }
  }
  if (preset === 'month') {
    return { from: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  }
  return { from: '', to: '' }
}
type DatePreset = 'today' | 'week' | 'month' | 'custom'

// ── Hooks ──────────────────────────────────────────────
function useAccountingConfig() {
  return useQuery({
    queryKey: ['accounting-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', 'accounting_config')
        .maybeSingle()
      if (error) throw error
      const defaults = { price_per_km: 3500 }
      if (!data) return defaults
      return { ...defaults, ...(data.value as Record<string, any>) }
    },
    staleTime: 1000 * 60 * 5,
  })
}

function useShiftSummary(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['shift-summary', dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at, km_in, km_out, driver:profiles!driver_shifts_driver_id_fkey(full_name, avatar_url, vehicle_plate)')
        .order('started_at', { ascending: false })
      if (dateFrom) q = q.gte('started_at', dateFrom + 'T00:00:00')
      if (dateTo) q = q.lte('started_at', dateTo + 'T23:59:59')

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

function useFeesSummary(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['fees-summary', dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select(`
          id, extra_fee, extra_fee_status, assigned_to, delivered_at,
          voucher_items:payment_voucher_items(id, voucher:payment_vouchers(status))
        `)
        .gt('extra_fee', 0)

      if (dateFrom) q = q.gte('delivered_at', dateFrom + 'T00:00:00')
      if (dateTo) q = q.lte('delivered_at', dateTo + 'T23:59:59')

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    staleTime: 1000 * 30,
  })
}

// ── Main Page ──────────────────────────────────────────
export function AccountingDashboardPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>('month')
  const [dateFrom, setDateFrom] = useState(() => getDatePreset('month').from)
  const [dateTo, setDateTo] = useState(() => getDatePreset('month').to)

  const handleDatePreset = useCallback((preset: DatePreset) => {
    setDatePreset(preset)
    if (preset !== 'custom') {
      const { from, to } = getDatePreset(preset)
      setDateFrom(from)
      setDateTo(to)
    }
  }, [])

  const { data: config } = useAccountingConfig()
  const pricePerKm = config?.price_per_km ?? 3500

  const { data: shifts = [] } = useShiftSummary(dateFrom, dateTo)
  const { data: fees = [] } = useFeesSummary(dateFrom, dateTo)

  // Odometer data
  const odoFilters: OdometerFilters = {
    period: datePreset === 'month' ? 'month' : datePreset === 'week' ? 'week' : datePreset === 'today' ? 'today' : 'custom',
    dateFrom: datePreset === 'custom' ? dateFrom : undefined,
    dateTo: datePreset === 'custom' ? dateTo : undefined,
  }
  const { data: odoData } = useOdometerTracking(odoFilters)

  // ── Driver aggregation ──────────────────────────────
  const driverStats = useMemo(() => {
    const map = new Map<string, {
      name: string; avatar: string | null; plate: string | null;
      totalHours: number; shiftCount: number; kmDriven: number;
      feesPending: number; feesApproved: number; feesPaid: number;
      odoActualKm: number; odoOptimizedKm: number;
    }>()

    const getOrCreate = (driverId: string, name?: string, avatar?: string, plate?: string) => {
      if (!map.has(driverId)) {
        map.set(driverId, {
          name: name ?? '—', avatar: avatar ?? null, plate: plate ?? null,
          totalHours: 0, shiftCount: 0, kmDriven: 0,
          feesPending: 0, feesApproved: 0, feesPaid: 0,
          odoActualKm: 0, odoOptimizedKm: 0,
        })
      }
      return map.get(driverId)!
    }

    // Shifts → hours + km
    for (const s of shifts) {
      const d = s.driver as any
      const entry = getOrCreate(s.driver_id, d?.full_name, d?.avatar_url, d?.vehicle_plate)
      entry.shiftCount++
      if (s.started_at && s.ended_at) {
        entry.totalHours += (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000
      }
      if (s.km_in != null && s.km_out != null) {
        entry.kmDriven += (s.km_out - s.km_in)
      }
    }

    // Fees
    for (const o of fees) {
      if (!o.assigned_to) continue
      const entry = getOrCreate(o.assigned_to)
      const amt = o.extra_fee ?? 0
      const vi = (o as any).voucher_items as any[] ?? []
      if (o.extra_fee_status === 'pending') entry.feesPending += amt
      else if (o.extra_fee_status === 'approved') {
        const voucherStatus = vi[0]?.voucher?.status
        if (voucherStatus === 'paid' || voucherStatus === 'confirmed') entry.feesPaid += amt
        else entry.feesApproved += amt
      }
    }

    // Odometer
    if (odoData?.records) {
      for (const r of odoData.records) {
        const entry = getOrCreate(r.driver_id, r.driver_name ?? undefined, r.avatar_url ?? undefined, r.vehicle_plate ?? undefined)
        entry.odoActualKm += (r.actual_km ?? 0)
        entry.odoOptimizedKm += r.optimized_km
      }
    }

    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.kmDriven - a.kmDriven)
  }, [shifts, fees, odoData])

  // ── Totals ──────────────────────────────────────────
  const totals = useMemo(() => {
    let hours = 0, km = 0, shiftCount = 0
    let feesPending = 0, feesApproved = 0, feesPaid = 0
    let odoActual = 0, odoOptimized = 0
    for (const d of driverStats) {
      hours += d.totalHours
      km += d.kmDriven
      shiftCount += d.shiftCount
      feesPending += d.feesPending
      feesApproved += d.feesApproved
      feesPaid += d.feesPaid
      odoActual += d.odoActualKm
      odoOptimized += d.odoOptimizedKm
    }
    const fuelCost = km * pricePerKm
    const totalCost = fuelCost + feesPaid + feesApproved
    return { hours, km, shiftCount, feesPending, feesApproved, feesPaid, fuelCost, totalCost, odoActual, odoOptimized }
  }, [driverStats, pricePerKm])

  return (
    <div style={{ ...F, maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BarChart3 size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Tổng quan Kế toán</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Chi phí vận hành, giờ làm việc và KM giao nhận</p>
        </div>
      </div>

      {/* Date Filter */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <Calendar size={15} color="#94a3b8" />
        {([
          { key: 'today' as DatePreset, label: 'Hôm nay' },
          { key: 'week' as DatePreset, label: 'Tuần này' },
          { key: 'month' as DatePreset, label: 'Tháng này' },
          { key: 'custom' as DatePreset, label: 'Tuỳ chọn' },
        ]).map(p => (
          <button key={p.key} onClick={() => handleDatePreset(p.key)}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', ...F, transition: 'all 0.15s ease',
              border: datePreset === p.key ? 'none' : '1px solid #e2e8f0',
              background: datePreset === p.key ? '#4f46e5' : '#fff',
              color: datePreset === p.key ? '#fff' : '#64748b',
            }}>
            {p.label}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="date" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setDatePreset('custom') }}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, ...F, color: '#475569', background: '#fff' }} />
          <span style={{ fontSize: 11, color: '#94a3b8' }}>→</span>
          <input type="date" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setDatePreset('custom') }}
            style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, ...F, color: '#475569', background: '#fff' }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KpiCard icon={<DollarSign size={18} color="#4f46e5" />} label="Tổng chi phí dự trù" value={fmt(totals.totalCost)} color="#4f46e5" />
        <KpiCard icon={<Fuel size={18} color="#0891b2" />} label="Chi phí xăng (KM)" value={fmt(totals.fuelCost)} sub={`${fmtKm(totals.km)} km × ${pricePerKm.toLocaleString('vi-VN')}₫`} color="#0891b2" />
        <KpiCard icon={<Receipt size={18} color="#7c3aed" />} label="Phụ phí đã chi" value={fmt(totals.feesPaid)} sub={totals.feesPending > 0 ? `+ ${fmt(totals.feesPending)} chờ duyệt` : undefined} color="#7c3aed" />
        <KpiCard icon={<Clock size={18} color="#d97706" />} label="Tổng giờ làm" value={`${Math.round(totals.hours * 10) / 10}h`} sub={`${totals.shiftCount} ca làm việc`} color="#d97706" />
        <KpiCard icon={<Truck size={18} color="#6366f1" />} label="KM thực tế (Odo)" value={`${fmtKm(totals.odoActual)} km`} sub={`vs ${fmtKm(totals.odoOptimized)} km tối ưu`} color="#6366f1" />
        <KpiCard icon={<Users size={18} color="#e11d48" />} label="Giao nhận hoạt động" value={`${driverStats.length}`} sub="người" color="#e11d48" />
      </div>

      {/* Cost Config Info Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', marginBottom: 20, borderRadius: 10,
        background: '#ecfeff', border: '1px solid rgba(6,182,212,0.2)',
      }}>
        <Fuel size={14} color="#0891b2" />
        <span style={{ fontSize: 12, color: '#0891b2', fontWeight: 600 }}>
          Đơn giá hiện tại: {pricePerKm.toLocaleString('vi-VN')} ₫/km
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          — Thay đổi tại trang Cấu hình kế toán
        </span>
      </div>

      {/* Driver Breakdown Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} color="#4f46e5" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Chi tiết theo giao nhận</span>
        </div>

        {driverStats.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Không có dữ liệu trong khoảng thời gian này
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={th}>Giao nhận</th>
                  <th style={th}>Ca</th>
                  <th style={th}>Giờ làm</th>
                  <th style={th}>KM thực tế</th>
                  <th style={th}>Chi phí KM</th>
                  <th style={th}>Phụ phí</th>
                  <th style={th}>Tổng chi phí</th>
                </tr>
              </thead>
              <tbody>
                {driverStats.map(d => {
                  const driverFuelCost = d.kmDriven * pricePerKm
                  const driverTotalCost = driverFuelCost + d.feesPaid + d.feesApproved
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ ...td, minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {d.avatar
                            ? <img src={d.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0891b2' }}>{d.name[0] ?? '?'}</div>
                          }
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{d.name}</div>
                            {d.plate && <div style={{ fontSize: 10, color: '#94a3b8' }}>🚗 {d.plate}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{d.shiftCount}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{Math.round(d.totalHours * 10) / 10}h</span>
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{fmtKm(d.kmDriven)} km</span>
                        {d.odoOptimizedKm > 0 && (
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>vs {fmtKm(d.odoOptimizedKm)} tối ưu</div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: '#0891b2' }}>{fmt(driverFuelCost)}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: d.feesPaid > 0 ? '#059669' : '#94a3b8' }}>
                          {fmt(d.feesPaid + d.feesApproved)}
                        </span>
                        {d.feesPending > 0 && (
                          <div style={{ fontSize: 10, color: '#d97706' }}>+ {fmt(d.feesPending)} chờ</div>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{fmt(driverTotalCost)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr style={{ background: '#e0e7ff', borderTop: '2px solid #4f46e5' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#4f46e5' }}>TỔNG CỘNG</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{totals.shiftCount}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{Math.round(totals.hours * 10) / 10}h</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{fmtKm(totals.km)} km</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0891b2' }}>{fmt(totals.fuelCost)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(totals.feesPaid + totals.feesApproved)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#4f46e5' }}>{fmt(totals.totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* KM Efficiency Section */}
      {totals.odoOptimized > 0 && (
        <div style={{ marginTop: 20, background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            {totals.odoActual > totals.odoOptimized
              ? <TrendingUp size={16} color="#e11d48" />
              : <TrendingDown size={16} color="#059669" />
            }
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Hiệu quả KM</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <MiniStat label="KM thực tế" value={`${fmtKm(totals.odoActual)} km`} />
            <MiniStat label="KM tối ưu" value={`${fmtKm(totals.odoOptimized)} km`} />
            <MiniStat
              label="Chênh lệch"
              value={`${totals.odoActual > totals.odoOptimized ? '+' : ''}${fmtKm(totals.odoActual - totals.odoOptimized)} km`}
              highlight={Math.abs(totals.odoActual - totals.odoOptimized) > totals.odoOptimized * 0.2}
            />
            <MiniStat
              label="Chi phí KM dư"
              value={fmt(Math.max(0, (totals.odoActual - totals.odoOptimized) * pricePerKm))}
              highlight={(totals.odoActual - totals.odoOptimized) > 0}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 18px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10,
      background: highlight ? '#fff1f2' : '#f8fafc',
      border: `1px solid ${highlight ? '#fecaca' : '#e2e8f0'}`,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? '#e11d48' : '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── Table styles ──────────────────────────────────────
const th: React.CSSProperties = {
  padding: '10px 14px', color: '#64748b', fontWeight: 600,
  fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap',
  fontFamily: 'Outfit, sans-serif',
}
const td: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12, color: '#0f172a',
  fontFamily: 'Outfit, sans-serif',
}
