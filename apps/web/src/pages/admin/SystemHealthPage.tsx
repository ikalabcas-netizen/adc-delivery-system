import { useState, useEffect, useCallback } from 'react'
import { Activity, Database, Cloud, Map, Navigation, Cpu, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────
type ServiceStatus = 'checking' | 'healthy' | 'warning' | 'critical' | 'offline'

interface ServiceResult {
  id: string
  name: string
  description: string
  status: ServiceStatus
  latencyMs?: number
  detail: string
  usagePercent?: number       // 0-100 for progress bar
  usageLabel?: string         // "482 MB / 500 MB"
  icon: React.ReactNode
}

const STATUS_CFG: Record<ServiceStatus, { label: string; bg: string; color: string; dot: string }> = {
  checking: { label: '⏳ Đang kiểm tra', bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  healthy:  { label: '✅ Hoạt động tốt', bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  warning:  { label: '⚠️ Cảnh báo',      bg: '#fef9c3', color: '#92400e', dot: '#eab308' },
  critical: { label: '🔴 Ngưỡng nguy hiểm', bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  offline:  { label: '⚫ Không kết nối',  bg: '#f1f5f9', color: '#475569', dot: '#475569' },
}



// ── Checks ──────────────────────────────────────────────────────────────

async function checkSupabaseDB(): Promise<Partial<ServiceResult>> {
  const t0 = Date.now()
  try {
    const { error } = await supabase.rpc('get_db_size')
    if (error) throw error
    const { data } = await supabase.rpc('get_db_size')
    const latencyMs = Date.now() - t0
    const bytes = (data as number) ?? 0
    const mb = bytes / 1024 / 1024
    // Supabase free: 500 MB
    const limitMb = 500
    const pct = Math.min(100, Math.round((mb / limitMb) * 100))
    return {
      status: pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'healthy',
      latencyMs,
      usagePercent: pct,
      usageLabel: `${mb.toFixed(1)} MB / ${limitMb} MB Free`,
      detail: `Latency ${latencyMs}ms · ${pct}% dung lượng đã dùng`,
    }
  } catch {
    return { status: 'offline', detail: 'Không kết nối được DB' }
  }
}

async function checkSupabaseAuth(): Promise<Partial<ServiceResult>> {
  const t0 = Date.now()
  try {
    const { error } = await supabase.auth.getSession()
    const latencyMs = Date.now() - t0
    if (error) throw error
    // Count total users as proxy for MAU
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
    const totalUsers = count ?? 0
    // Free: 50k MAU
    const pct = Math.min(100, Math.round((totalUsers / 50000) * 100))
    return {
      status: pct >= 90 ? 'critical' : 'healthy',
      latencyMs,
      usagePercent: pct,
      usageLabel: `${totalUsers} / 50,000 users`,
      detail: `Auth hoạt động · Latency ${latencyMs}ms`,
    }
  } catch {
    return { status: 'offline', detail: 'Auth không phản hồi' }
  }
}

async function checkSupabaseStorage(): Promise<Partial<ServiceResult>> {
  const t0 = Date.now()
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets()
    const latencyMs = Date.now() - t0
    if (error) throw error
    return {
      status: 'healthy',
      latencyMs,
      usageLabel: `${buckets?.length ?? 0} buckets`,
      detail: `Storage API hoạt động · ${buckets?.length ?? 0} buckets · Latency ${latencyMs}ms`,
    }
  } catch {
    return { status: 'offline', detail: 'Storage không phản hồi' }
  }
}

async function checkSupabaseRealtime(): Promise<Partial<ServiceResult>> {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const timeout = setTimeout(() => {
      ch.unsubscribe()
      resolve({ status: 'offline', detail: 'Realtime timeout (>5s)' })
    }, 5000)

    const ch = supabase.channel('health-check')
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timeout)
        const latencyMs = Date.now() - t0
        ch.unsubscribe()
        resolve({
          status: 'healthy',
          latencyMs,
          detail: `Realtime kết nối · Latency ${latencyMs}ms`,
        })
      }
    })
  })
}

async function checkMapbox(): Promise<Partial<ServiceResult>> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  if (!token) return { status: 'warning', detail: 'Token chưa cấu hình (VITE_MAPBOX_TOKEN)' }
  const t0 = Date.now()
  try {
    const res = await fetch(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`,
      { method: 'HEAD' }
    )
    const latencyMs = Date.now() - t0
    if (res.status === 401) return { status: 'critical', latencyMs, detail: 'Token không hợp lệ (401)' }
    if (!res.ok) return { status: 'warning', latencyMs, detail: `HTTP ${res.status}` }
    return { status: 'healthy', latencyMs, detail: `Token hợp lệ · Latency ${latencyMs}ms` }
  } catch {
    return { status: 'offline', detail: 'Không thể kết nối Mapbox' }
  }
}

async function checkOpenRouteService(): Promise<Partial<ServiceResult>> {
  const key = import.meta.env.VITE_ORS_API_KEY as string | undefined
  if (!key) return { status: 'warning', detail: 'Key chưa cấu hình (VITE_ORS_API_KEY)' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.openrouteservice.org/v2/health', {
      headers: { 'Authorization': key },
    })
    const latencyMs = Date.now() - t0
    if (res.status === 401 || res.status === 403) return { status: 'critical', latencyMs, detail: 'API key không hợp lệ' }
    return { status: 'healthy', latencyMs, detail: `OpenRouteService hoạt động · Latency ${latencyMs}ms` }
  } catch {
    return { status: 'offline', detail: 'Không kết nối được ORS' }
  }
}

// Shared helper: load AI config once
async function loadAIConfig() {
  const { data } = await supabase.from('system_settings').select('value').eq('key', 'ai_config').maybeSingle()
  return data?.value as { provider?: string; api_key?: string; enabled?: boolean } | null
}

async function checkOpenRouter(): Promise<Partial<ServiceResult>> {
  const cfg = await loadAIConfig()
  if (!cfg?.enabled) return { status: 'warning', detail: 'AI chưa được bật trong Cấu hình hệ thống' }
  if (cfg.provider !== 'openrouter') return { status: 'warning', detail: `Provider hiện tại: ${cfg.provider ?? '—'} (không phải OpenRouter)` }
  if (!cfg.api_key) return { status: 'warning', detail: 'OpenRouter API key chưa được nhập trong Cấu hình' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${cfg.api_key}` },
    })
    const latencyMs = Date.now() - t0
    if (res.status === 401 || res.status === 403) return { status: 'critical', latencyMs, detail: 'API key không hợp lệ (401/403)' }
    if (!res.ok) return { status: 'warning', latencyMs, detail: `HTTP ${res.status}` }
    const json = await res.json()
    const modelCount = json?.data?.length ?? 0
    return { status: 'healthy', latencyMs, detail: `OpenRouter hoạt động · ${modelCount} models khả dụng · Latency ${latencyMs}ms` }
  } catch {
    return { status: 'offline', detail: 'Không kết nối được OpenRouter' }
  }
}

async function checkDeepSeek(): Promise<Partial<ServiceResult>> {
  const cfg = await loadAIConfig()
  if (!cfg?.enabled) return { status: 'warning', detail: 'AI chưa được bật trong Cấu hình' }
  if (cfg.provider !== 'deepseek') return { status: 'warning', detail: `Provider hiện tại: ${cfg.provider ?? '—'} · Chọn DeepSeek để kích hoạt` }
  if (!cfg.api_key) return { status: 'warning', detail: 'DeepSeek API key chưa cấu hình' }
  const t0 = Date.now()
  try {
    const res = await fetch('https://api.deepseek.com/v1/models', {
      headers: { 'Authorization': `Bearer ${cfg.api_key}` },
    })
    const latencyMs = Date.now() - t0
    if (res.status === 401) return { status: 'critical', latencyMs, detail: 'API key không hợp lệ (401)' }
    if (!res.ok) return { status: 'warning', latencyMs, detail: `HTTP ${res.status}` }
    return { status: 'healthy', latencyMs, detail: `DeepSeek API hoạt động · Latency ${latencyMs}ms` }
  } catch {
    return { status: 'offline', detail: 'Không kết nối được DeepSeek' }
  }
}

async function checkGemini(): Promise<Partial<ServiceResult>> {
  const cfg = await loadAIConfig()
  if (!cfg?.enabled) return { status: 'warning', detail: 'AI chưa bật trong Cấu hình' }
  if (cfg.provider !== 'gemini') return { status: 'warning', detail: `Provider hiện tại: ${cfg.provider ?? '—'} · Chọn Gemini để kích hoạt` }
  if (!cfg.api_key) return { status: 'warning', detail: 'Gemini API key chưa cấu hình' }
  const t0 = Date.now()
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cfg.api_key}`
    const res  = await fetch(url)
    const latencyMs = Date.now() - t0
    if (res.status === 400 || res.status === 401 || res.status === 403)
      return { status: 'critical', latencyMs, detail: 'API key không hợp lệ' }
    if (!res.ok) return { status: 'warning', latencyMs, detail: `HTTP ${res.status}` }
    return { status: 'healthy', latencyMs, detail: `Gemini API hoạt động · Latency ${latencyMs}ms` }
  } catch {
    return { status: 'offline', detail: 'Không kết nối được Gemini' }
  }
}

// ── Service definitions ────────────────────────────────────────────────
const SERVICES: Array<{
  id: string; name: string; description: string; icon: React.ReactNode
  check: () => Promise<Partial<ServiceResult>>
}> = [
  { id: 'supabase-db',      name: 'Supabase DB',       description: 'PostgreSQL · kết nối & dung lượng', icon: <Database size={18} color="#059669" />,   check: checkSupabaseDB },
  { id: 'supabase-auth',    name: 'Supabase Auth',      description: 'Authentication · số người dùng',    icon: <Cloud size={18} color="#2563eb" />,       check: checkSupabaseAuth },
  { id: 'supabase-storage', name: 'Supabase Storage',   description: 'File storage · buckets',            icon: <Cloud size={18} color="#0891b2" />,       check: checkSupabaseStorage },
  { id: 'supabase-rt',      name: 'Supabase Realtime',  description: 'WebSocket · kênh realtime',         icon: <Wifi size={18} color="#7c3aed" />,        check: checkSupabaseRealtime },
  { id: 'mapbox',           name: 'Mapbox',             description: 'Bản đồ & điều hướng · token',       icon: <Map size={18} color="#d97706" />,         check: checkMapbox },
  { id: 'openroute',        name: 'OpenRouteService',   description: 'Tính toán tuyến đường · API key',   icon: <Navigation size={18} color="#059669" />,  check: checkOpenRouteService },
  { id: 'openrouter',       name: 'OpenRouter AI',      description: 'AI tổng hợp · free models',         icon: <Cpu size={18} color="#7c3aed" />,         check: checkOpenRouter },
  { id: 'deepseek',         name: 'DeepSeek AI',        description: 'AI phân tích · trực tiếp',          icon: <Cpu size={18} color="#0891b2" />,         check: checkDeepSeek },
  { id: 'gemini',           name: 'Gemini AI',          description: 'AI review nightly · Google',        icon: <Cpu size={18} color="#4285f4" />,         check: checkGemini },
]

// ── Progress bar ───────────────────────────────────────────────────────
function UsageBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#eab308' : '#22c55e'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99, background: color,
          transition: 'width 0.6s ease',
          boxShadow: pct >= 90 ? `0 0 6px ${color}` : 'none',
          animation: pct >= 90 ? 'pulse-bar 1.2s ease-in-out infinite' : 'none',
        }} />
      </div>
    </div>
  )
}

// ── Service Card ───────────────────────────────────────────────────────
function ServiceCard({ svc }: { svc: ServiceResult }) {
  const cfg  = STATUS_CFG[svc.status]
  const pct  = svc.usagePercent
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: `1px solid ${svc.status === 'critical' ? '#fca5a5' : '#e2e8f0'}`,
      padding: '16px 18px', boxShadow: svc.status === 'critical' ? '0 0 0 2px #fee2e2' : '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {svc.status === 'checking'
            ? <RefreshCw size={18} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />
            : svc.status === 'offline'
              ? <WifiOff size={18} color="#94a3b8" />
              : svc.icon
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{svc.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{svc.description}</div>
            </div>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
              {cfg.label}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>{svc.detail}</div>
          {svc.usageLabel && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{svc.usageLabel}</div>}
          {pct !== undefined && <UsageBar pct={pct} />}
          {svc.latencyMs && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{svc.latencyMs}ms</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────
export function SystemHealthPage() {
  const [results, setResults] = useState<ServiceResult[]>(
    SERVICES.map(s => ({ ...s, status: 'checking' as ServiceStatus, detail: 'Đang kiểm tra...' }))
  )
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const runChecks = useCallback(async () => {
    setRefreshing(true)
    // Reset to checking
    setResults(SERVICES.map(s => ({ ...s, status: 'checking', detail: 'Đang kiểm tra...' })))
    // Run all checks in parallel
    await Promise.all(SERVICES.map(async (svc, i) => {
      const result = await svc.check()
      setResults(prev => prev.map((r, j) => j === i ? { ...r, ...result } : r))
    }))
    setLastUpdated(new Date())
    setRefreshing(false)
  }, [])

  useEffect(() => { runChecks() }, [runChecks])

  // Auto refresh every 60s
  useEffect(() => {
    const t = setInterval(runChecks, 60_000)
    return () => clearInterval(t)
  }, [runChecks])

  const hasCritical = results.some(r => r.status === 'critical')
  const hasOffline  = results.some(r => r.status === 'offline')
  const healthyCount = results.filter(r => r.status === 'healthy').length
  void healthyCount // used implicitly for summary counts

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 840 }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse-bar { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={18} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>Sức khoẻ hệ thống</h1>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
              {lastUpdated ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN')} · Tự động refresh 60s` : 'Đang kiểm tra...'}
            </p>
          </div>
        </div>
        <button
          onClick={runChecks}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Outfit, sans-serif', color: '#475569' }}
        >
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Critical banner */}
      {(hasCritical || hasOffline) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: hasCritical ? '#fee2e2' : '#fef9c3', borderRadius: 12, border: `1px solid ${hasCritical ? '#fca5a5' : '#fde68a'}`, marginBottom: 16 }}>
          <AlertTriangle size={16} color={hasCritical ? '#dc2626' : '#d97706'} />
          <span style={{ fontSize: 13, fontWeight: 600, color: hasCritical ? '#991b1b' : '#92400e' }}>
            {hasCritical
              ? `${results.filter(r => r.status === 'critical').length} service đang ở ngưỡng nguy hiểm — cần xử lý ngay!`
              : `${results.filter(r => r.status === 'offline').length} service không kết nối được`
            }
          </span>
        </div>
      )}

      {/* Overall summary */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {([
          ['healthy', '#dcfce7', '#166534', '✅ Hoạt động tốt'],
          ['warning', '#fef9c3', '#92400e', '⚠️ Cảnh báo'],
          ['critical', '#fee2e2', '#991b1b', '🔴 Nguy hiểm'],
          ['offline', '#f1f5f9', '#475569', '⚫ Offline'],
        ] as const).map(([status, bg, color, label]) => {
          const count = results.filter(r => r.status === status).length
          if (count === 0) return null
          return (
            <div key={status} style={{ padding: '6px 14px', borderRadius: 20, background: bg, fontSize: 12, fontWeight: 700, color }}>
              {label}: {count}
            </div>
          )
        })}
      </div>

      {/* Service grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
        {results.map(svc => <ServiceCard key={svc.id} svc={svc} />)}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 20, padding: '12px 16px', background: '#f8fafc', borderRadius: 12, fontSize: 11, color: '#94a3b8' }}>
        💡 Cảnh báo leo thang: <span style={{ color: '#22c55e', fontWeight: 700 }}>Xanh</span> &lt;70% · <span style={{ color: '#eab308', fontWeight: 700 }}>Vàng</span> 70–89% · <span style={{ color: '#ef4444', fontWeight: 700 }}>Đỏ nhấp nháy</span> ≥90%.
        Mapbox/ORS/AI cần token cấu hình qua biến môi trường hoặc System Settings.
      </div>
    </div>
  )
}
