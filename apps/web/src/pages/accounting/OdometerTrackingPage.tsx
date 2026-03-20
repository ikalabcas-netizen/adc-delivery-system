import { useState } from 'react'
import { Gauge, Calendar, Filter, TrendingDown, TrendingUp, Navigation, Truck } from 'lucide-react'
import { useOdometerTracking, useDriversList, OdometerFilters } from '@/hooks/useOdometerTracking'

type Period = OdometerFilters['period']

export function OdometerTrackingPage() {
  const [period, setPeriod]       = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [driverId, setDriverId]     = useState<string | null>(null)

  const { data: driversList = [] } = useDriversList()

  const filters: OdometerFilters = {
    period,
    dateFrom: period === 'custom' ? customFrom : undefined,
    dateTo:   period === 'custom' ? customTo   : undefined,
    driverId,
  }
  const { data, isLoading } = useOdometerTracking(filters)
  const records = data?.records ?? []
  const summary = data?.summary

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #059669, #10b981)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Gauge size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Theo dõi KM Odometer</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>So sánh KM thực tế (đồng hồ odo) vs KM tối ưu (phần mềm)</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        padding: '12px 16px', background: '#fff', borderRadius: 12,
        border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <Calendar size={14} color="#94a3b8" />
        {(['today', 'week', 'month', 'custom'] as Period[]).map(p => {
          const labels: Record<Period, string> = { today: 'Hôm nay', week: 'Tuần', month: 'Tháng', custom: 'Tùy chọn' }
          return (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              border: period === p ? 'none' : '1px solid #e2e8f0',
              background: period === p ? '#059669' : '#fff',
              color: period === p ? '#fff' : '#64748b',
            }}>{labels[p]}</button>
          )
        })}

        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }} />
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={13} color="#94a3b8" />
          <select
            value={driverId ?? ''}
            onChange={e => setDriverId(e.target.value || null)}
            style={{
              padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 7,
              fontSize: 12, color: '#0f172a', fontFamily: 'Outfit, sans-serif',
              background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="">Tất cả giao nhận</option>
            {driversList.map(d => (
              <option key={d.id} value={d.id}>{d.full_name ?? d.id} {d.vehicle_plate ? `(${d.vehicle_plate})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <SummaryCard
            icon={<Truck size={18} color="#6366f1" />}
            label="KM thực tế (Odo)"
            value={`${summary.totalActualKm}`}
            sub="km"
            color="#6366f1"
          />
          <SummaryCard
            icon={<Navigation size={18} color="#0891b2" />}
            label="KM tối ưu (PM)"
            value={`${summary.totalOptimizedKm}`}
            sub="km"
            color="#0891b2"
          />
          <SummaryCard
            icon={summary.totalDifference > 0 ? <TrendingUp size={18} color="#e11d48" /> : <TrendingDown size={18} color="#059669" />}
            label="Chênh lệch"
            value={`${summary.totalDifference > 0 ? '+' : ''}${summary.totalDifference}`}
            sub={`km (${summary.differencePct > 0 ? '+' : ''}${summary.differencePct}%)`}
            color={Math.abs(summary.differencePct) > 20 ? '#e11d48' : '#059669'}
          />
        </div>
      )}

      {/* Table */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Đang tải...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            <Gauge size={36} style={{ opacity: 0.15, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>Không có dữ liệu odometer trong khoảng này</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>#</th>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Giao nhận</th>
                  <th style={thStyle}>Ngày</th>
                  <th style={thStyle}>KM vào ca</th>
                  <th style={thStyle}>KM ra ca</th>
                  <th style={thStyle}>KM thực tế</th>
                  <th style={thStyle}>KM tối ưu (PM)</th>
                  <th style={thStyle}>Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={`${r.driver_id}-${r.date}-${idx}`}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, color: '#94a3b8', fontWeight: 600, width: 36 }}>{idx + 1}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                          : <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cffafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0891b2' }}>
                              {r.driver_name?.[0] ?? '?'}
                            </div>
                        }
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>{r.driver_name ?? '—'}</div>
                          {r.vehicle_plate && <div style={{ fontSize: 10, color: '#94a3b8' }}>🚗 {r.vehicle_plate}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                      {new Date(r.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {r.km_in != null ? r.km_in.toLocaleString() : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                      {r.km_out != null ? r.km_out.toLocaleString() : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {r.actual_km != null ? `${r.actual_km} km` : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, color: '#0891b2', fontVariantNumeric: 'tabular-nums' }}>
                      {r.optimized_km > 0 ? `${r.optimized_km} km` : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {r.difference != null && r.difference_pct != null ? (
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          background: Math.abs(r.difference_pct) > 20 ? '#fff1f2' : '#f0fdf4',
                          color:      Math.abs(r.difference_pct) > 20 ? '#e11d48' : '#059669',
                        }}>
                          {r.difference > 0 ? '+' : ''}{r.difference} km ({r.difference_pct > 0 ? '+' : ''}{r.difference_pct}%)
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Summary Card ──────────────────────────────────────
function SummaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '18px 20px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8, flex: '1 1 180px', minWidth: 160,
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

// ── Table styles ──────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 14px', color: '#64748b', fontWeight: 600,
  fontSize: 11, textAlign: 'center', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 13, color: '#0f172a',
}
