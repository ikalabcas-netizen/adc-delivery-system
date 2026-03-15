import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, MapPin, LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { SalesOrdersPage } from './SalesOrdersPage'
import { SalesLocationsPage } from './SalesLocationsPage'

const NAV_ITEMS = [
  { to: '/sales/orders',    icon: ClipboardList, label: 'Đơn hàng' },
  { to: '/sales/locations', icon: MapPin,        label: 'Địa điểm' },
]

function SalesSidebar() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside style={{
      width: 240, background: 'linear-gradient(180deg, #0B1929 0%, #0F2847 100%)',
      display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(6,182,212,0.1)',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif',
          }}>
            ADC
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', margin: 0, fontFamily: 'Outfit, sans-serif' }}>ADC Delivery</p>
            <p style={{ fontSize: 10, color: '#f59e0b', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Kinh doanh</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 9, marginBottom: 4,
              background: isActive ? 'rgba(6,182,212,0.12)' : 'transparent',
              color: isActive ? '#06b6d4' : 'rgba(255,255,255,0.5)',
              textDecoration: 'none', fontSize: 13, fontWeight: 500,
              fontFamily: 'Outfit, sans-serif', transition: 'all 0.15s',
            })}
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <NavLink
          to="/sales/profile"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
            textDecoration: 'none', padding: '6px 4px', borderRadius: 8,
            background: isActive ? 'rgba(6,182,212,0.08)' : 'transparent',
          })}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={13} color="#06b6d4" />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name ?? 'Nhân viên'}
            </p>
            <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Kinh doanh</p>
          </div>
        </NavLink>
        <button
          onClick={handleSignOut}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          <LogOut size={13} /> Đăng xuất
        </button>
      </div>
    </aside>
  )
}

export function SalesLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#eef2f5' }}>
      <SalesSidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <Routes>
          <Route path="orders"    element={<SalesOrdersPage />} />
          <Route path="locations" element={<SalesLocationsPage />} />
          <Route path="profile"   element={<ProfileSettingsPage />} />
          <Route path="*"         element={<SalesOrdersPage />} />
        </Routes>
      </main>
    </div>
  )
}
