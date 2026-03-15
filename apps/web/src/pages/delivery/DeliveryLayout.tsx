import { Routes, Route } from 'react-router-dom'
import { User, ClipboardList } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { DeliveryOrdersPage } from './DeliveryOrdersPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/delivery/orders',  icon: ClipboardList, label: 'Đơn hàng' },
  { to: '/delivery/profile', icon: User,          label: 'Hồ sơ' },
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
        <Route path="orders"  element={<DeliveryOrdersPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
        <Route path="*"       element={<DeliveryOrdersPage />} />
      </Routes>
    </ResponsiveShell>
  )
}
