import { Routes, Route } from 'react-router-dom'
import { Receipt, BarChart3, Gauge, Settings } from 'lucide-react'
import { ResponsiveShell, NavItem } from '@/components/layout/ResponsiveShell'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { AccountingDashboardPage } from './AccountingDashboardPage'
import { AccountingPage } from './AccountingPage'
import { OdometerTrackingPage } from './OdometerTrackingPage'
import { AccountingConfigPage } from './AccountingConfigPage'

const NAV_ITEMS: NavItem[] = [
  { to: '/accounting/overview',  icon: BarChart3, label: 'Tổng quan' },
  { to: '/accounting/fees',      icon: Receipt,   label: 'Phụ phí & Chi trả' },
  { to: '/accounting/odometer',  icon: Gauge,     label: 'Theo dõi KM' },
  { to: '/accounting/config',    icon: Settings,  label: 'Cấu hình' },
]

export function AccountantLayout() {
  return (
    <ResponsiveShell
      navItems={NAV_ITEMS}
      accentColor="#4f46e5"
      roleLabel="Kế toán"
      profilePath="/accounting/profile"
    >
      <Routes>
        <Route path="overview"  element={<AccountingDashboardPage />} />
        <Route path="fees"      element={<AccountingPage />} />
        <Route path="odometer"  element={<OdometerTrackingPage />} />
        <Route path="config"    element={<AccountingConfigPage />} />
        <Route path="profile"   element={<ProfileSettingsPage />} />
        <Route path="*"         element={<AccountingDashboardPage />} />
      </Routes>
    </ResponsiveShell>
  )
}
