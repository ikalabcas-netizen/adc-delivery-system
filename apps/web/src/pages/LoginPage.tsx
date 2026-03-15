import { motion } from 'framer-motion'
import { Package, MapPin, Zap, Users } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const features = [
  { icon: Package,  text: 'Tạo & theo dõi đơn hàng theo thời gian thực' },
  { icon: MapPin,   text: 'Bản đồ GPS — biết tài xế đang ở đâu ngay lập tức' },
  { icon: Zap,      text: 'Tối ưu lộ trình tự động bằng AI' },
  { icon: Users,    text: 'Phân quyền linh hoạt theo vai trò' },
]

export function LoginPage() {
  const { signInWithGoogle } = useAuthStore()

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel: ADC Navy ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #164e63 0%, #0a3444 100%)' }}
      >
        {/* Top: Logo + Brand */}
        <div>
          {/* Alpha symbol SVG */}
          <div className="w-14 h-14 mb-8">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" stroke="#67e8f9" strokeWidth="3" opacity="0.3"/>
              <path
                d="M30 72 C30 72 35 35 50 28 C65 21 72 55 68 72"
                stroke="url(#cyanGrad)" strokeWidth="6" strokeLinecap="round" fill="none"
              />
              <path
                d="M45 72 C45 72 50 50 62 45"
                stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6"
              />
              <defs>
                <linearGradient id="cyanGrad" x1="30" y1="72" x2="72" y2="28" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#06b6d4"/>
                  <stop offset="100%" stopColor="#67e8f9"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">
            ADC Delivery System
          </h1>
          <p className="text-adc-300 text-sm font-medium uppercase tracking-widest mb-10">
            Alpha Digital Center
          </p>

          <p className="text-white/70 text-base leading-relaxed mb-10">
            Nền tảng quản lý giao nhận thông minh — theo dõi đơn hàng, tối ưu lộ trình và giám sát đội tài xế trong thời gian thực.
          </p>

          {/* Features */}
          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-adc-500/20 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-adc-300" />
                </div>
                <span className="text-white/75 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: Version */}
        <p className="text-white/30 text-xs">ADC Delivery System v1.0 — 2026</p>
      </motion.div>

      {/* ── Right Panel: Login Form ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex-1 flex items-center justify-center p-8 bg-surface-page"
      >
        <div className="w-full max-w-sm">
          {/* Mobile logo (shown only on small screens) */}
          <div className="lg:hidden text-center mb-10">
            <div className="text-2xl font-bold text-adc-700">ADC Delivery</div>
            <p className="text-slate-500 text-sm mt-1">Alpha Digital Center</p>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Xin chào! 👋</h2>
            <p className="text-slate-500 text-sm">
              Đăng nhập để tiếp tục vào hệ thống
            </p>
          </div>

          {/* Google Sign-In Button */}
          <motion.button
            whileHover={{ scale: 1.015, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            whileTap={{ scale: 0.98 }}
            onClick={signInWithGoogle}
            transition={{ duration: 0.15 }}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6
                       bg-white border border-surface-border rounded-xl
                       text-slate-700 font-medium text-sm
                       shadow-sm hover:border-adc-400
                       transition-colors duration-200"
          >
            {/* Google SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Đăng nhập bằng Google
          </motion.button>

          <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
            Bằng cách đăng nhập, bạn đồng ý với<br />
            <span className="text-adc-600 cursor-pointer hover:underline">Điều khoản sử dụng</span>
            {' '}của ADC Delivery System
          </p>
        </div>
      </motion.div>
    </div>
  )
}

