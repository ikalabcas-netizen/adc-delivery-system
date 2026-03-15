import { Routes, Route } from 'react-router-dom'
import { Users, Settings, User } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { AdminUsersPage } from './AdminUsersPage'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/users',   icon: Users,    label: 'Người dùng' },
  { to: '/admin/profile', icon: User,     label: 'Hồ sơ' },
  { to: '/admin/system',  icon: Settings, label: 'Hệ thống' },
]

export function AdminLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#8b5cf6"
      roleLabel="Super Admin"
      profilePath="/admin/profile"
    >
      <Routes>
        <Route path="users"   element={<AdminUsersPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
        <Route path="system"  element={<SystemPlaceholder />} />
        <Route path="*"       element={<AdminUsersPage />} />
      </Routes>
    </ResponsiveShell>
  )
}

function SystemPlaceholder() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 12 }}>
      <Settings size={32} color="#adc" style={{ opacity: 0.3 }} />
      <p style={{ fontFamily: 'Outfit, sans-serif', color: '#94a3b8', fontSize: 14 }}>Tính năng đang phát triển</p>
    </div>
  )
}
