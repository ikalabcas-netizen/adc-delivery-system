import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, Fuel, Info, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const F = { fontFamily: 'Outfit, sans-serif' }

interface AccountingConfig {
  price_per_km: number
}

const DEFAULT_CONFIG: AccountingConfig = {
  price_per_km: 3500,
}

function useAccountingConfig() {
  return useQuery({
    queryKey: ['accounting-config'],
    queryFn: async (): Promise<AccountingConfig> => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('key', 'accounting_config')
        .maybeSingle()
      if (error) throw error
      if (!data) return DEFAULT_CONFIG
      return { ...DEFAULT_CONFIG, ...(data.value as Record<string, any>) }
    },
    staleTime: 1000 * 60 * 5,
  })
}

function useSaveConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: AccountingConfig) => {
      const { data: session } = await supabase.auth.getSession()
      const userId = session?.session?.user?.id ?? null

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'accounting_config',
          value: config as any,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounting-config'] })
    },
  })
}

export function AccountingConfigPage() {
  const { data: config, isLoading } = useAccountingConfig()
  const save = useSaveConfig()

  const [pricePerKm, setPricePerKm] = useState(DEFAULT_CONFIG.price_per_km)
  const [saved, setSaved] = useState(false)

  // Sync from server
  useEffect(() => {
    if (config) {
      setPricePerKm(config.price_per_km)
    }
  }, [config])

  const handleSave = () => {
    save.mutate({ price_per_km: pricePerKm }, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    })
  }

  const hasChanges = config ? pricePerKm !== config.price_per_km : false

  // Example calculation
  const exampleKm = 100
  const exampleCost = exampleKm * pricePerKm

  if (isLoading) {
    return <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', ...F }}>Đang tải...</div>
  }

  return (
    <div style={{ ...F, maxWidth: 640 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5, #4338ca)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Cấu hình kế toán</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Thiết lập đơn giá và quy tắc tính chi phí</p>
        </div>
      </div>

      {/* Price per KM Card */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 20,
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Fuel size={16} color="#0891b2" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Chi phí theo KM</span>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Đơn giá mỗi KM (₫)
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="number"
                value={pricePerKm}
                onChange={e => setPricePerKm(Math.max(0, Number(e.target.value)))}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  border: '1px solid #e2e8f0', fontSize: 16, fontWeight: 700,
                  color: '#0f172a', ...F, outline: 'none', background: '#fff',
                  maxWidth: 200,
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#4f46e5'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>₫/km</span>
            </div>
          </div>

          {/* Quick set buttons */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Mức giá phổ biến:</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[2500, 3000, 3500, 4000, 5000, 6000].map(v => (
                <button key={v} onClick={() => setPricePerKm(v)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', ...F, transition: 'all 0.15s ease',
                    border: pricePerKm === v ? 'none' : '1px solid #e2e8f0',
                    background: pricePerKm === v ? '#4f46e5' : '#fff',
                    color: pricePerKm === v ? '#fff' : '#64748b',
                  }}>
                  {v.toLocaleString('vi-VN')}₫
                </button>
              ))}
            </div>
          </div>

          {/* Example calculation */}
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: '#e0e7ff', border: '1px solid #c7d2fe',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Info size={14} color="#4f46e5" />
            <span style={{ fontSize: 12, color: '#4f46e5' }}>
              Ví dụ: Giao nhận đi {exampleKm} km → chi phí dự trù = <strong>{exampleCost.toLocaleString('vi-VN')} ₫</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '16px 20px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Info size={14} color="#64748b" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Cách tính chi phí</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
          <li><strong>Chi phí KM</strong> = KM thực tế (odometer) × Đơn giá/km</li>
          <li><strong>Phụ phí</strong> = Tổng phụ phí đã duyệt và chi trả cho giao nhận</li>
          <li><strong>Tổng chi phí</strong> = Chi phí KM + Phụ phí đã chi</li>
          <li>KM thực tế lấy từ <strong>đồng hồ odometer</strong> khi vào/ra ca</li>
          <li>KM tối ưu lấy từ <strong>phần mềm định tuyến</strong> để so sánh hiệu quả</li>
        </ul>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || save.isPending}
          style={{
            padding: '10px 24px', borderRadius: 10,
            background: hasChanges ? 'linear-gradient(135deg, #4f46e5, #4338ca)' : '#e2e8f0',
            color: hasChanges ? '#fff' : '#94a3b8',
            border: 'none', fontSize: 13, fontWeight: 700, cursor: hasChanges ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8, ...F,
            boxShadow: hasChanges ? '0 2px 8px rgba(79,70,229,0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}>
          <Save size={14} />
          {save.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
        {saved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
            <CheckCircle size={14} /> Đã lưu thành công!
          </span>
        )}
        {save.isError && (
          <span style={{ fontSize: 12, color: '#e11d48' }}>
            ❌ Lỗi: {(save.error as Error)?.message}
          </span>
        )}
      </div>
    </div>
  )
}
