import { useAuthStore } from '@/stores/authStore'

export function LoginPage() {
  const { signInWithGoogle } = useAuthStore()

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#eef2f5' }}>
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-sm flex flex-col items-center px-10 py-12"
        style={{ border: '1px solid #e2e8f0' }}
      >
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <img
            src="/logo.png"
            alt="Alpha Digital Center"
            className="h-16 w-auto object-contain mb-3"
            onError={(e) => {
              // Fallback: inline SVG nếu không có file logo
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextElementSibling?.removeAttribute('style')
            }}
          />
          {/* Inline SVG fallback (ẩn mặc định nếu có ảnh) */}
          <svg style={{ display: 'none' }} viewBox="0 0 80 80" className="h-16 w-16" fill="none">
            <circle cx="40" cy="40" r="38" stroke="#06b6d4" strokeWidth="2.5" opacity="0.25"/>
            <path d="M22 60 C22 60 27 22 40 17 C53 12 59 42 55 60"
                  stroke="url(#g1)" strokeWidth="5" strokeLinecap="round"/>
            <path d="M36 60 C36 60 40 40 52 35"
                  stroke="#67e8f9" strokeWidth="3.5" strokeLinecap="round" opacity="0.7"/>
            <defs>
              <linearGradient id="g1" x1="22" y1="60" x2="59" y2="17" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0891b2"/>
                <stop offset="100%" stopColor="#67e8f9"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Title */}
        <h1
          className="text-center font-bold tracking-widest text-slate-800 mb-1"
          style={{ fontSize: '14px', letterSpacing: '0.12em' }}
        >
          ADC DELIVERY SYSTEM
        </h1>
        <p className="text-center text-slate-500 mb-8" style={{ fontSize: '12px' }}>
          Digital Service For Lab
        </p>

        {/* Sign In Box */}
        <div className="w-full rounded-xl border border-slate-200 overflow-hidden mb-2">
          <div className="px-5 py-3 border-b border-slate-100">
            <p className="text-center text-slate-700 font-medium" style={{ fontSize: '14px' }}>
              Sign In
            </p>
          </div>
          <div className="px-4 py-3">
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2.5 py-2 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              style={{ fontSize: '13px', color: '#374151' }}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
        <div className="flex items-center gap-3 mt-4" style={{ fontSize: '11px', color: '#9ca3af' }}>
          <span className="cursor-pointer hover:text-slate-600 transition-colors">Privacy Policy</span>
          <span>·</span>
          <span className="cursor-pointer hover:text-slate-600 transition-colors">Terms of Service</span>
          <span>·</span>
          <span className="cursor-pointer hover:text-slate-600 transition-colors">Help Center</span>
        </div>
      </div>
    </div>
  )
}
