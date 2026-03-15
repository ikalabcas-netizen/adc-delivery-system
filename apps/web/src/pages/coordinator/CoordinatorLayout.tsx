import { Routes, Route } from 'react-router-dom'
import { ClipboardList, Map, MapPin, Route as RouteIcon, GitBranchPlus, BarChart3 } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { OrdersPage } from './OrdersPage'
import { LocationsPage } from './LocationsPage'
import { TripsPage } from './TripsPage'
import { MapPage } from './MapPage'
import { DeliveryRoutesPage } from './DeliveryRoutesPage'
import { DashboardPage } from './DashboardPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/coordinator/dashboard', icon: BarChart3,      label: 'Dashboard' },
  { to: '/coordinator/orders',    icon: ClipboardList,  label: 'Đơn hàng' },
  { to: '/coordinator/trips',     icon: RouteIcon,      label: 'Chuyến đi' },
  { to: '/coordinator/map',       icon: Map,            label: 'Bản đồ' },
  { to: '/coordinator/locations', icon: MapPin,         label: 'Địa điểm' },
  { to: '/coordinator/routes',    icon: GitBranchPlus,  label: 'Tuyến GN' },
]

export function CoordinatorLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#06b6d4"
      roleLabel="Điều phối viên"
      profilePath="/coordinator/profile"
    >
      <Routes>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="orders"    element={<OrdersPage />} />
        <Route path="trips"     element={<TripsPage />} />
        <Route path="map"       element={<MapPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="routes"    element={<DeliveryRoutesPage />} />
        <Route path="profile"   element={<ProfileSettingsPage />} />
        <Route path="*"         element={<DashboardPage />} />
      </Routes>
    </ResponsiveShell>
  )
}
