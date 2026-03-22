import { useState, useEffect } from 'react'
import { User, Car, MapPin, Save } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useProfile, useUpdateProfile } from '@/hooks/useUsers'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge } from '@/components/ui/Badge'

const VEHICLE_TYPE_OPTIONS = [
  'Xe máy',
  'Xe tải nhỏ',
  'Xe tải lớn',
  'Xe đạp điện',
  'Ô tô',
]

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#8b5cf6',
  coordinator: '#06b6d4',
  sales:       '#f59e0b',
  manager:     '#059669',
  delivery:    '#10b981',
  accountant:  '#4f46e5',
}

export function ProfileSettingsPage() {
  const { session } = useAuthStore()
  const userId = session?.user?.id
  const { data: profile, isLoading } = useProfile(userId)
  const update = useUpdateProfile(userId)

  const [form, setForm] = useState({
    full_name:     '',
    phone:         '',
    vehicle_plate: '',
    vehicle_type:  '',
    home_address:  '',
  })
  const [saved, setSaved] = useState(false)

  // Sync profile → form when loaded
  useEffect(() => {
    if (profile) {
      setForm({
        full_name:     profile.full_name     ?? '',
        phone:         profile.phone         ?? '',
        vehicle_plate: profile.vehicle_plate ?? '',
        vehicle_type:  profile.vehicle_type  ?? '',
        home_address:  profile.home_address  ?? '',
      })
    }
  }, [profile])

  const isDelivery = profile?.role === 'delivery'
  const accentColor = profile?.role ? ROLE_COLORS[profile.role] || '#06b6d4' : '#06b6d4'

  async function handleSave() {
    await update.mutateAsync({
      full_name:     form.full_name     || null,
      phone:         form.phone         || null,
      ...(isDelivery && {
        vehicle_plate: form.vehicle_plate || null,
        vehicle_type:  form.vehicle_type  || null,
        home_address:  form.home_address  || null,
      }),
    } as Record<string, string | null>)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (isLoading) return (
    <div className="page-content">
      <p style={{ color: '#94a3b8', fontSize: 13 }}>Đang tải...</p>
    </div>
  )

  return (
    <div className="page-content" style={{ maxWidth: 600 }}>
      <PageHeader
        title="Hồ sơ cá nhân"
        subtitle="Cập nhật thông tin tài khoản của bạn"
      />

      {/* Avatar + role */}
      <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${accentColor}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={24} color={accentColor} />
          </div>
        )}
        <div>
          <p style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>
            {profile?.full_name ?? 'Chưa có tên'}
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{profile?.email ?? session?.user?.email}</p>
          {profile?.role && <RoleBadge role={profile.role} />}
        </div>
      </div>

      {/* Basic info */}
      <div className="card" style={{ padding: 24, marginBottom: 8 }}>
        <SectionTitle icon={<User size={14} />} label="Thông tin cơ bản" />

        <FormField label="Tên hiển thị" required>
          <input
            value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            placeholder="Nhập họ và tên..."
            style={inputStyle}
          />
        </FormField>

        <FormField label="Số điện thoại">
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="0901 234 567"
            style={inputStyle}
            type="tel"
          />
        </FormField>
      </div>

      {/* Delivery-specific */}
      {isDelivery && (
        <div className="card" style={{ padding: 24, marginBottom: 8 }}>
          <SectionTitle icon={<Car size={14} />} label="Thông tin giao nhận" />

          <FormField label="Biển số xe" required>
            <input
              value={form.vehicle_plate}
              onChange={e => setForm(f => ({ ...f, vehicle_plate: e.target.value.toUpperCase() }))}
              placeholder="51G1-123.45"
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
          </FormField>

          <FormField label="Loại xe" required>
            <select
              value={form.vehicle_type}
              onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}
              style={{ ...inputStyle, appearance: 'auto' }}
            >
              <option value="">-- Chọn loại xe --</option>
              {VEHICLE_TYPE_OPTIONS.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Địa chỉ nhà riêng">
            <div style={{ position: 'relative' }}>
              <MapPin size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={form.home_address}
                onChange={e => setForm(f => ({ ...f, home_address: e.target.value }))}
                placeholder="Số nhà, đường, phường/xã, quận/huyện..."
                style={{ ...inputStyle, paddingLeft: 30 }}
              />
            </div>
          </FormField>
        </div>
      )}

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={update.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', background: accentColor, color: '#fff',
            border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}
        >
          <Save size={14} />
          {update.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
            ✓ Đã lưu
          </span>
        )}
        {update.isError && (
          <span style={{ fontSize: 13, color: '#e11d48' }}>
            Lỗi: {(update.error as Error)?.message}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Small helpers ─────────────────────────────────────────────────
function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, color: '#475569', fontSize: 13, fontWeight: 600 }}>
      {icon} {label}
    </div>
  )
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, fontFamily: 'Outfit, sans-serif',
  color: '#1e293b', outline: 'none',
  background: '#fff',
}
