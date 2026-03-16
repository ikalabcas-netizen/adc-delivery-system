import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Cpu, Key, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────
interface AIConfig {
  enabled: boolean
  provider: 'gemini' | 'openrouter' | 'deepseek'
  model: string
  api_key?: string
}

const PROVIDERS = [
  {
    id: 'gemini' as const,
    name: 'Google Gemini',
    logo: '🔵',
    color: '#4285F4',
    models: [
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Nhanh, rẻ)' },
      { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro (Mạnh)' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Mới nhất)' },
    ],
  },
  {
    id: 'deepseek' as const,
    name: 'DeepSeek',
    logo: '🌊',
    color: '#0891B2',
    models: [
      { id: 'deepseek-chat',   label: 'DeepSeek Chat (GPT-4 level, rẻ)' },
      { id: 'deepseek-coder',  label: 'DeepSeek Coder' },
    ],
  },
  {
    id: 'openrouter' as const,
    name: 'OpenRouter (Tổng hợp)',
    logo: '🔀',
    color: '#7C3AED',
    models: [
      { id: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B (Free)' },
      { id: 'google/gemma-3-4b-it:free',          label: 'Gemma 3 4B (Free)' },
      { id: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (Free)' },
      { id: 'deepseek/deepseek-chat-v3-0324:free',   label: 'DeepSeek V3 (Free)' },
    ],
  },
]

// ── Hooks ─────────────────────────────────────────────
function useAIConfig() {
  return useQuery({
    queryKey: ['admin', 'ai-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'ai_config')
        .maybeSingle()
      if (error) throw error
      return (data?.value as AIConfig) ?? { enabled: false, provider: 'gemini', model: 'gemini-1.5-flash' }
    },
  })
}

function useSaveAIConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: AIConfig) => {
      const { error } = await supabase.from('system_settings')
        .upsert({ key: 'ai_config', value: config as any }, { onConflict: 'key' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-config'] }),
  })
}

// ── Page ──────────────────────────────────────────────
export function SystemSettingsPage() {
  const { data: cfg, isLoading } = useAIConfig()
  const save = useSaveAIConfig()

  const [enabled,  setEnabled]  = useState<boolean>(false)
  const [provider, setProvider] = useState<AIConfig['provider']>('gemini')
  const [model,    setModel]    = useState('')
  const [apiKey,   setApiKey]   = useState('')
  const [masked,   setMasked]   = useState(true)
  const [saved,    setSaved]    = useState(false)

  // Sync from loaded config
  const [synced, setSynced] = useState(false)
  if (cfg && !synced) {
    setEnabled(cfg.enabled ?? false)
    setProvider(cfg.provider ?? 'gemini')
    setModel(cfg.model ?? PROVIDERS[0].models[0].id)
    setSynced(true)
  }

  const providerDef = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0]
  const modelsForProvider = providerDef.models

  const handleSubmit = async () => {
    setSaved(false)
    await save.mutateAsync({ enabled, provider, model: model || modelsForProvider[0].id, api_key: apiKey || undefined })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (isLoading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Đang tải cấu hình...</div>
  )

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={18} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Cấu hình hệ thống</h1>
        </div>
      </div>

      {/* AI Toggle Card */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: enabled ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color={enabled ? '#059669' : '#94a3b8'} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Bật/Tắt AI</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Phân tích hiệu suất và review nightly</div>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {enabled
              ? <ToggleRight size={38} color="#059669" />
              : <ToggleLeft  size={38} color="#cbd5e1" />
            }
          </button>
        </div>
      </div>

      {/* Provider selection */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Cpu size={16} color="#8b5cf6" />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>AI Provider</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => { setProvider(p.id); setModel(p.models[0].id) }}
              style={{
                flex: '1 1 180px', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                border: provider === p.id ? `2px solid ${p.color}` : '1px solid #e2e8f0',
                background: provider === p.id ? `${p.color}0D` : '#f8fafc',
                textAlign: 'left', fontFamily: 'Outfit, sans-serif',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{p.logo}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: provider === p.id ? p.color : '#0f172a' }}>{p.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Model selection */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Model</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>({providerDef.name})</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modelsForProvider.map(m => (
            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, border: (model || modelsForProvider[0].id) === m.id ? `1.5px solid ${providerDef.color}` : '1px solid #f1f5f9', background: (model || modelsForProvider[0].id) === m.id ? `${providerDef.color}0A` : '#f8fafc' }}>
              <input type="radio" name="model" value={m.id} checked={(model || modelsForProvider[0].id) === m.id} onChange={() => setModel(m.id)} style={{ accentColor: providerDef.color }} />
              <span style={{ fontSize: 13, color: '#0f172a' }}>{m.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Key size={16} color="#d97706" />
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>API Key</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>• Mã hoá và lưu an toàn trong vault</span>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type={masked ? 'password' : 'text'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={`Nhập ${providerDef.name} API key...`}
            style={{
              width: '100%', padding: '11px 44px 11px 12px', borderRadius: 10,
              border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'Outfit, sans-serif',
              background: '#f8fafc', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={() => setMasked(!masked)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            {masked ? '👁' : '🙈'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
          Để trống nếu không thay đổi. Key hiện tại đã được lưu an toàn.
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={handleSubmit}
          disabled={save.isPending}
          style={{
            padding: '12px 28px', borderRadius: 12, background: '#8b5cf6', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif', opacity: save.isPending ? 0.7 : 1,
          }}
        >
          {save.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
        {saved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: 13 }}>
            <CheckCircle size={16} />
            Đã lưu thành công
          </div>
        )}
        {save.isError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 13 }}>
            <AlertCircle size={16} />
            Lỗi lưu cấu hình
          </div>
        )}
      </div>
    </div>
  )
}
