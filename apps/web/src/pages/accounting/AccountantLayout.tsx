import { Routes, Route } from 'react-router-dom'
import { Receipt, BarChart3, Gauge } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { AccountingPage } from './AccountingPage'
import { OdometerTrackingPage } from './OdometerTrackingPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/accounting/overview',  icon: BarChart3, label: 'Tổng quan' },
  { to: '/accounting/fees',      icon: Receipt,   label: 'Phụ phí & Chi trả' },
  { to: '/accounting/odometer',  icon: Gauge,     label: 'Theo dõi KM' },
]

export function AccountantLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#059669"
      roleLabel="Kế toán"
      profilePath="/accounting/profile"
    >
      <Routes>
        <Route path="overview"  element={<AccountingPage />} />
        <Route path="fees"      element={<AccountingPage />} />
        <Route path="odometer"  element={<OdometerTrackingPage />} />
        <Route path="profile"   element={<ProfileSettingsPage />} />
        <Route path="*"         element={<AccountingPage />} />
      </Routes>
    </ResponsiveShell>
  )
}
