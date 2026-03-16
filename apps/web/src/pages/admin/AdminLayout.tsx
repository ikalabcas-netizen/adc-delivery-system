import { Routes, Route } from 'react-router-dom'
import { Users, Settings, User, MessageSquarePlus } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { AdminUsersPage }     from './AdminUsersPage'
import { KaizenPage }         from './KaizenPage'
import { SystemSettingsPage } from './SystemSettingsPage'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/users',   icon: Users,              label: 'Người dùng' },
  { to: '/admin/kaizen',  icon: MessageSquarePlus,   label: 'Kaizen' },
  { to: '/admin/profile', icon: User,                label: 'Hồ sơ' },
  { to: '/admin/system',  icon: Settings,            label: 'Hệ thống' },
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
        <Route path="kaizen"  element={<KaizenPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
        <Route path="system"  element={<SystemSettingsPage />} />
        <Route path="*"       element={<AdminUsersPage />} />
      </Routes>
    </ResponsiveShell>
  )
}

