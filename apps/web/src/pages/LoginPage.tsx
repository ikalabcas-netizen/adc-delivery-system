import { useAuthStore } from '@/stores/authStore'

export function LoginPage() {
  const { signInWithGoogle } = useAuthStore()

  return (
    /*
     * Outer: full viewport, flex center cả ngang lẫn dọc
     * Dùng fixed inset-0 thay vì min-h-screen để đảm bảo
     * luôn chiếm đúng 100% viewport bất kể #root layout
     */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#eef2f5',
        padding: '16px',          /* safe area on mobile */
        overflowY: 'auto',
      }}
    >
      {/* Card — responsive width */}
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          padding: '40px 32px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Alpha Digital Center"
          style={{ width: '67%', height: 'auto', objectFit: 'contain', marginBottom: '20px' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />

        {/* Title */}
        <h1
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            letterSpacing: '0.13em',
            color: '#1e293b',
            textAlign: 'center',
            marginBottom: '4px',
          }}
        >
          ADC DELIVERY SYSTEM
        </h1>
        <p
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '12px',
            color: '#94a3b8',
            textAlign: 'center',
            marginBottom: '28px',
          }}
        >
          Digital Service For Lab
        </p>

        {/* Sign In box */}
        <div
          style={{
            width: '100%',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #f1f5f9',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
            }}
          >
            Sign In
          </div>
          <div style={{ padding: '12px' }}>
            <button
              onClick={signInWithGoogle}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '9px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#ffffff',
                fontSize: '13px',
                color: '#374151',
                fontFamily: 'Outfit, sans-serif',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: '#cbd5e1',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
          <span>·</span>
          <span style={{ cursor: 'pointer' }}>Terms of Service</span>
          <span>·</span>
          <span style={{ cursor: 'pointer' }}>Help Center</span>
        </div>
      </div>
    </div>
  )
}
