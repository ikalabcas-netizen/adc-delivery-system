import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { Users, Settings, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { AdminUsersPage } from './AdminUsersPage'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'

const NAV_ITEMS = [
  { to: '/admin/users',   icon: Users,       label: 'Người dùng' },
  { to: '/admin/profile', icon: User,        label: 'Hồ sơ' },
  { to: '/admin/system',  icon: Settings,    label: 'Hệ thống' },
]

function AdminSidebar() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

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
            <div className="text-adc-300 text-[10px] mt-0.5">Super Admin</div>
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
        {/* Avatar clickable → profile */}
        <button
          onClick={() => navigate('/admin/profile')}
          className="w-full flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg hover:bg-white/5 transition-colors text-left"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-adc-500/30 flex items-center justify-center">
              <User size={14} className="text-adc-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white/90 text-xs font-medium truncate">{profile?.full_name ?? 'Admin'}</p>
            <p className="text-white/40 text-[10px] truncate">Super Admin</p>
          </div>
        </button>
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

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-auto bg-surface-page">
        <Routes>
          <Route path="users"   element={<AdminUsersPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="system"  element={<PlaceholderPage title="Hệ thống" desc="Cấu hình hệ thống — đang phát triển" />} />
          <Route path="*"       element={<AdminUsersPage />} />
        </Routes>
      </main>
    </div>
  )
}

function PlaceholderPage({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="page-content">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <p className="text-slate-500 text-sm mt-1">{desc}</p>
    </div>
  )
}
