import { Routes, Route } from 'react-router-dom'
import { ClipboardList, MapPin } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { SalesOrdersPage } from './SalesOrdersPage'
import { SalesLocationsPage } from './SalesLocationsPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/sales/orders',    icon: ClipboardList, label: 'Đơn hàng' },
  { to: '/sales/locations', icon: MapPin,        label: 'Địa điểm' },
]

export function SalesLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#f59e0b"
      roleLabel="Kinh doanh"
      profilePath="/sales/profile"
    >
      <Routes>
        <Route path="orders"    element={<SalesOrdersPage />} />
        <Route path="locations" element={<SalesLocationsPage />} />
        <Route path="profile"   element={<ProfileSettingsPage />} />
        <Route path="*"         element={<SalesOrdersPage />} />
      </Routes>
    </ResponsiveShell>
  )
}
