import { Routes, Route, Navigate } from 'react-router-dom'
import { User, ClipboardList, Briefcase, Map, Receipt, AlertTriangle } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { DeliveryOrdersPage } from './DeliveryOrdersPage'
import { DeliveryShiftPage } from './DeliveryShiftPage'
import { DeliveryTripsPage } from './DeliveryTripsPage'
import { DeliveryTripDetailPage } from './DeliveryTripDetailPage'
import { DeliveryCostsPage } from './DeliveryCostsPage'
import { DeliveryIssuesPage } from './DeliveryIssuesPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/delivery/shift', icon: Briefcase, label: 'Ca làm việc' },
  { to: '/delivery/orders', icon: ClipboardList, label: 'Đơn hàng' },
  { to: '/delivery/trips', icon: Map, label: 'Chuyến đi' },
  { to: '/delivery/costs', icon: Receipt, label: 'Chi phí' },
  { to: '/delivery/issues', icon: AlertTriangle, label: 'Báo lỗi' },
  { to: '/delivery/profile', icon: User, label: 'Hồ sơ' },
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
        <Route path="shift" element={<DeliveryShiftPage />} />
        <Route path="trips" element={<DeliveryTripsPage />} />
        <Route path="trips/:id" element={<DeliveryTripDetailPage />} />
        <Route path="orders" element={<DeliveryOrdersPage />} />
        <Route path="costs" element={<DeliveryCostsPage />} />
        {/* Redirect cũ /payments → /costs để không bị 404 */}
        <Route path="payments" element={<Navigate to="/delivery/costs" replace />} />
        <Route path="issues" element={<DeliveryIssuesPage />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
        <Route path="*" element={<Navigate to="shift" replace />} />
      </Routes>
    </ResponsiveShell>
  )
}
