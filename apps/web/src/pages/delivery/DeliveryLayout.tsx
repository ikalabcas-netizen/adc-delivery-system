import { Routes, Route } from 'react-router-dom'
import { User } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/delivery/profile', icon: User, label: 'Hồ sơ cá nhân' },
]

export function DeliveryLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#10b981"
      roleLabel="Giao nhận"
      profilePath="/delivery/profile"
    >
      <Routes>
        <Route path="profile" element={<ProfileSettingsPage />} />
        <Route path="*"       element={<ProfileSettingsPage />} />
      </Routes>
    </ResponsiveShell>
  )
}
