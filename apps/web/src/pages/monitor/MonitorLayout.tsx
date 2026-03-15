import { Routes, Route, NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, ClipboardList, Map, History, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  { to: '/monitor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/monitor/orders',    icon: ClipboardList,   label: 'Đơn hàng' },
  { to: '/monitor/map',       icon: Map,             label: 'Bản đồ' },
  { to: '/monitor/logs',      icon: History,         label: 'Lịch sử' },
]

function MonitorSidebar() {
  const { profile, signOut } = useAuthStore()
  const roleLabel = profile?.role === 'manager' ? 'Quản lý' : 'Kinh doanh'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen"
      style={{ background: 'linear-gradient(180deg, #164e63 0%, #0a3444 100%)' }}
    >
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-adc-500/30 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#67e8f9" strokeWidth="1.5" opacity="0.5"/>
              <path d="M7 17 C7 17 8.5 8 12 7 C15.5 6 17 13.5 16 17"
                    stroke="#06b6d4" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none">ADC Delivery</div>
            <div className="text-adc-300 text-[10px] mt-0.5">{roleLabel}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-adc-500/30 flex items-center justify-center">
            <User size={14} className="text-adc-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-xs font-medium truncate">{profile?.full_name ?? 'Người dùng'}</p>
            <p className="text-white/40 text-[10px] truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors text-xs"
        >
          <LogOut size={13} />
          Đăng xuất
        </button>
      </div>
    </aside>
  )
}

function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="page-content"
    >
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <p className="text-slate-500 text-sm mt-1">{desc}</p>
    </motion.div>
  )
}

export function MonitorLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <MonitorSidebar />
      <main className="flex-1 overflow-auto bg-surface-page">
        <Routes>
          <Route path="dashboard" element={<PlaceholderPage title="Dashboard" desc="Tổng quan — đang phát triển" />} />
          <Route path="orders"    element={<PlaceholderPage title="Đơn hàng" desc="Xem-only · Không thể phân công" />} />
          <Route path="map"       element={<PlaceholderPage title="Bản đồ" desc="Theo dõi realtime — đang phát triển" />} />
          <Route path="logs"      element={<PlaceholderPage title="Lịch sử log" desc="Tracking log — đang phát triển" />} />
          <Route path="*"         element={<PlaceholderPage title="Giám sát" desc="Chọn mục từ menu bên trái" />} />
        </Routes>
      </main>
    </div>
  )
}
