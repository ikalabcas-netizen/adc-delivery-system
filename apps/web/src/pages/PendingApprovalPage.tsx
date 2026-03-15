import { useAuthStore } from '@/stores/authStore'

export function PendingApprovalPage() {
  const { signOut, profile, session } = useAuthStore()
  const name = profile?.full_name ?? session?.user?.user_metadata?.full_name ?? 'bạn'
  const email = profile?.email ?? session?.user?.email ?? ''

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(135deg, #ecfeff 0%, #f0f9ff 40%, #e0f2fe 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: 'Outfit, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          border: '1px solid rgba(6,182,212,0.2)',
          boxShadow: '0 8px 40px rgba(6,182,212,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          padding: '40px 36px 32px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}
      >
        {/* Animated icon */}
        <div style={{ marginBottom: 24, position: 'relative' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #cffafe, #a5f3fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(6,182,212,0.08)',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#06b6d4" strokeWidth="1.5" opacity="0.4"/>
              <path d="M12 7v5l3 3" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Logo small */}
        <img
          src="/logo.png"
          alt="ADC"
          style={{ height: 36, width: 'auto', objectFit: 'contain', marginBottom: 16, opacity: 0.7 }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Tài khoản đang chờ duyệt
        </h1>

        <p style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>
          Xin chào <strong style={{ color: '#0f172a' }}>{name}</strong>
        </p>

        {email && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>{email}</p>
        )}

        {/* Info box */}
        <div style={{
          width: '100%',
          background: 'rgba(6,182,212,0.06)',
          border: '1px solid rgba(6,182,212,0.15)',
          borderRadius: 12, padding: '14px 16px',
          marginBottom: 24, textAlign: 'left',
        }}>
          <p style={{ fontSize: 13, color: '#0e7490', lineHeight: 1.6 }}>
            Tài khoản của bạn đã đăng ký thành công. Super Admin đang xem xét và gán vai trò phù hợp.
            Sau khi được duyệt, bạn có thể đăng nhập lại.
          </p>
        </div>

        {/* Steps */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {[
            { step: '1', text: 'Tài khoản đã được tạo', done: true },
            { step: '2', text: 'Chờ Super Admin xét duyệt', done: false, active: true },
            { step: '3', text: 'Truy cập hệ thống', done: false },
          ].map(({ step, text, done, active }) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: done ? '#06b6d4' : active ? 'rgba(6,182,212,0.15)' : '#f1f5f9',
                border: active ? '2px solid #06b6d4' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: done ? '#fff' : active ? '#0891b2' : '#94a3b8',
              }}>
                {done ? '✓' : step}
              </div>
              <span style={{ fontSize: 13, color: done ? '#0f172a' : active ? '#0891b2' : '#94a3b8', fontWeight: done || active ? 500 : 400 }}>
                {text}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={signOut}
          style={{
            fontSize: 13, color: '#94a3b8',
            background: 'none', border: 'none', cursor: 'pointer',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Đăng xuất và thử tài khoản khác
        </button>
      </div>
    </div>
  )
}
