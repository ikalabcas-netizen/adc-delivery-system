import { useState } from 'react'
import { TrendingUp, Truck, Users, CheckCircle, Clock, BarChart3, ChevronUp, ChevronDown, Navigation } from 'lucide-react'
import { useSystemStats, useDriverPerformance, useDailyTrend, DriverStat } from '@/hooks/usePerformance'

// ─── Live status badge ────────────────────────────────
function StatusDot({ shiftStatus, driverStatus }: { shiftStatus?: string | null; driverStatus?: string | null }) {
  if (shiftStatus !== 'on_shift') return <span title="Nghỉ" style={{ fontSize: 13 }}>⚫</span>
  if (driverStatus === 'delivering') return <span title="Đang giao" style={{ fontSize: 13 }}>🟡</span>
  return <span title="Đang rảnh" style={{ fontSize: 13 }}>🟢</span>
}

// ─── KPI card ────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 20px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 140px', minWidth: 130,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Bar chart (SVG pure) ────────────────────────────
function BarChart({ data }: { data: { date: string; delivered: number; cancelled: number }[] }) {
  const max = Math.max(...data.map(d => d.delivered + d.cancelled), 1)
  const W = 600, H = 140, padL = 24, padB = 28, barW = Math.min(32, (W - padL) / data.length - 4)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + padB}`} style={{ fontFamily: 'Outfit, sans-serif', display: 'block' }}>
        {/* Y grid lines */}
        {[0, 0.5, 1].map(pct => {
          const y = H - pct * H
          return <line key={pct} x1={padL} y1={y} x2={W} y2={y} stroke="#f1f5f9" strokeDasharray="4" />
        })}

        {data.map((d, i) => {
          const slotW = (W - padL) / data.length
          const cx    = padL + i * slotW + slotW / 2
          const delH  = (d.delivered / max) * H
          const canH  = (d.cancelled / max) * H
          const label = d.date.slice(5) // MM-DD

          return (
            <g key={d.date}>
              {/* cancelled bar (beneath) */}
              {d.cancelled > 0 && (
                <rect x={cx - barW/2} y={H - delH - canH} width={barW} height={canH}
                  fill="#fca5a5" rx={3} />
              )}
              {/* delivered bar */}
              {d.delivered > 0 && (
                <rect x={cx - barW/2} y={H - delH} width={barW} height={delH}
                  fill="url(#grad)" rx={3} />
              )}
              {/* value label */}
              {(d.delivered + d.cancelled) > 0 && (
                <text x={cx} y={H - delH - canH - 3} textAnchor="middle" fontSize="10" fill="#475569">
                  {d.delivered}
                </text>
              )}
              {/* date label */}
              <text x={cx} y={H + padB - 4} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {label}
              </text>
            </g>
          )
        })}

        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#06b6d4', borderRadius: 2, display: 'inline-block' }} /> Hoàn thành
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, background: '#fca5a5', borderRadius: 2, display: 'inline-block' }} /> Huỷ
        </span>
      </div>
    </div>
  )
}

// ─── Driver row ────────────────────────────────────────
function DriverRow({ stat, rank }: { stat: DriverStat; rank: number }) {
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}>
      <td style={{ padding: '10px 14px', width: 36, color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{rank}</td>
      <td style={{ padding: '10px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            {stat.avatar_url
              ? <img src={stat.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0891b2' }}>
                  {stat.full_name?.[0] ?? '?'}
                </div>
            }
            <span style={{ position: 'absolute', bottom: -2, right: -2 }}>
              <StatusDot shiftStatus={stat.shift_status} driverStatus={stat.driver_status} />
            </span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{stat.full_name ?? '—'}</div>
            {stat.vehicle_plate && <div style={{ fontSize: 11, color: '#94a3b8' }}>🚗 {stat.vehicle_plate}</div>}
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{stat.delivered}</td>
      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>{stat.total}</td>
      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: stat.successRate >= 80 ? '#f0fdf4' : stat.successRate >= 50 ? '#fffbeb' : '#fff1f2',
          color:      stat.successRate >= 80 ? '#059669' : stat.successRate >= 50 ? '#d97706' : '#e11d48',
        }}>{stat.successRate}%</span>
      </td>
      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: stat.totalOptimizedKm > 0 ? '#0891b2' : '#cbd5e1' }}>
        {stat.totalOptimizedKm > 0 ? `${stat.totalOptimizedKm} km` : '—'}
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────
export function PerformancePage() {
  const [period,  setPeriod]  = useState<'today'|'week'|'month'>('today')
  const [trendDays, setTrendDays] = useState(7)
  const [sortCol,  setSortCol]  = useState<'delivered'|'total'|'successRate'>('delivered')
  const [sortAsc,  setSortAsc]  = useState(false)

  const { data: sys,    isLoading: sysLoading }    = useSystemStats()
  const { data: drivers = [], isLoading: drvLoading } = useDriverPerformance(period)
  const { data: trend = [], isLoading: trendLoading } = useDailyTrend(trendDays)

  const sorted = [...drivers].sort((a, b) => {
    const va = a[sortCol], vb = b[sortCol]
    return sortAsc ? va - vb : vb - va
  })

  function SortBtn({ col, label }: { col: typeof sortCol; label: string }) {
    const active = sortCol === col
    return (
      <span
        onClick={() => { if (active) setSortAsc(v => !v); else { setSortCol(col); setSortAsc(false) } }}
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, userSelect: 'none',
          color: active ? '#0891b2' : '#64748b', fontWeight: active ? 700 : 600 }}>
        {label}
        {active ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    )
  }

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Hiệu suất giao hàng</h1>
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginLeft: 46 }}>Dữ liệu cập nhật mỗi 60 giây</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        {sysLoading ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
        ) : sys ? (
          <>
            <KpiCard icon={<BarChart3 size={18} color="#6366f1" />} label="Đơn hôm nay" value={sys.total} color="#6366f1" />
            <KpiCard icon={<CheckCircle size={18} color="#059669" />} label="Đã giao" value={sys.delivered} sub={`Tỉ lệ ${sys.successRate}%`} color="#059669" />
            <KpiCard icon={<Truck size={18} color="#7c3aed" />} label="Chuyến đang giao" value={sys.activeTrips} color="#7c3aed" />
            <KpiCard icon={<Users size={18} color="#0891b2" />} label="GN đang ca" value={sys.driversOnShift} color="#0891b2" />
            {sys.totalOptimizedKm > 0 && (
              <KpiCard icon={<Navigation size={18} color="#0d9488" />} label="KM tối ưu hôm nay" value={`${sys.totalOptimizedKm}`} sub="km" color="#0d9488" />
            )}
            {sys.avgTripMinutes != null && (
              <KpiCard icon={<Clock size={18} color="#d97706" />} label="Thời gian TB/chuyến" value={sys.avgTripMinutes < 60 ? `${sys.avgTripMinutes} ph` : `${Math.floor(sys.avgTripMinutes/60)}h${sys.avgTripMinutes%60}ph`} color="#d97706" />
            )}
          </>
        ) : null}
      </div>

      {/* Trend chart */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Xu hướng giao hàng</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setTrendDays(d)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: trendDays === d ? 'none' : '1px solid #e2e8f0',
                background: trendDays === d ? '#0891b2' : '#fff',
                color: trendDays === d ? '#fff' : '#64748b',
                fontFamily: 'Outfit, sans-serif',
              }}>{d} ngày</button>
            ))}
          </div>
        </div>
        {trendLoading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Đang tải biểu đồ...</div> : <BarChart data={trend} />}
      </div>

      {/* Driver table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Hiệu suất từng giao nhận</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['today','week','month'] as const).map(p => {
              const labels = { today: 'Hôm nay', week: 'Tuần', month: 'Tháng' }
              return (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: period === p ? 'none' : '1px solid #e2e8f0',
                  background: period === p ? '#0891b2' : '#fff',
                  color: period === p ? '#fff' : '#64748b',
                  fontFamily: 'Outfit, sans-serif',
                }}>{labels[p]}</button>
              )
            })}
          </div>
        </div>

        {drvLoading ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px 14px', width: 36, color: '#94a3b8', fontWeight: 600, fontSize: 11, textAlign: 'left' }}>#</th>
                  <th style={{ padding: '10px 8px', color: '#64748b', fontWeight: 600, fontSize: 11, textAlign: 'left' }}>Giao nhận</th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>
                    <SortBtn col="delivered" label="Đã giao" />
                  </th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>
                    <SortBtn col="total" label="Tổng đơn" />
                  </th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>
                    <SortBtn col="successRate" label="Tỉ lệ HT" />
                  </th>
                  <th style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 11, textAlign: 'center' }}>KM tối ưu</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Không có dữ liệu</td></tr>
                ) : (
                  sorted.map((s, i) => <DriverRow key={s.driver_id} stat={s} rank={i + 1} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
