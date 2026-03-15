import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { ClipboardList, Map, MapPin, Route as RouteIcon, LogOut, User, ChevronRight, GitBranchPlus } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { ProfileSettingsPage } from '@/pages/ProfileSettingsPage'
import { OrdersPage } from './OrdersPage'
import { LocationsPage } from './LocationsPage'
import { TripsPage } from './TripsPage'
import { MapPage } from './MapPage'
import { DeliveryRoutesPage } from './DeliveryRoutesPage'

const NAV_ITEMS = [
  { to: '/coordinator/orders',    icon: ClipboardList,  label: 'Đơn hàng' },
  { to: '/coordinator/trips',     icon: RouteIcon,      label: 'Chuyến đi' },
  { to: '/coordinator/map',       icon: Map,            label: 'Bản đồ' },
  { to: '/coordinator/locations', icon: MapPin,         label: 'Địa điểm' },
  { to: '/coordinator/routes',    icon: GitBranchPlus,  label: 'Tuyến GN' },
]

function CoordinatorSidebar() {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: 'linear-gradient(180deg, #164e63 0%, #0a3444 100%)',
      display: 'flex', flexDirection: 'column', height: '100vh',
      boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
    }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="ADC" style={{ height: 32, width: 'auto', objectFit: 'contain', filter: 'brightness(1.2)' }}
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div>
            <div style={{ color: '#fff', fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>ADC Delivery</div>
            <div style={{ color: '#67e8f9', fontFamily: 'Outfit, sans-serif', fontSize: 10, marginTop: 2 }}>Điều phối viên</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8, marginBottom: 2,
            fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', transition: 'all 0.15s ease',
            background: isActive ? 'rgba(6,182,212,0.2)' : 'transparent',
            color: isActive ? '#67e8f9' : 'rgba(255,255,255,0.65)',
            borderLeft: isActive ? '2px solid #06b6d4' : '2px solid transparent',
          })}>
            <Icon size={15} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => navigate('/coordinator/profile')} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8, background: 'transparent',
          border: 'none', cursor: 'pointer', marginBottom: 4,
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(6,182,212,0.4)' }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(6,182,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={14} color="#67e8f9" />
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'left' }}>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: 'Outfit, sans-serif', fontWeight: 500, margin: 0 }}>
              {profile?.full_name ?? 'Người dùng'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontFamily: 'Outfit, sans-serif', margin: 0 }}>Xem hồ sơ</p>
          </div>
          <ChevronRight size={12} color="rgba(255,255,255,0.3)" />
        </button>
        <button onClick={signOut} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8, background: 'transparent',
          border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          fontSize: 12, color: 'rgba(255,255,255,0.4)', transition: 'color 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <LogOut size={13} /> Đăng xuất
        </button>
      </div>
    </aside>
  )
}


export function CoordinatorLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#eef2f5' }}>
      <CoordinatorSidebar />
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <Routes>
          <Route path="orders"    element={<OrdersPage />} />
          <Route path="trips"     element={<TripsPage />} />
          <Route path="map"       element={<MapPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="routes"    element={<DeliveryRoutesPage />} />
          <Route path="profile"   element={<ProfileSettingsPage />} />
          <Route path="*"         element={<OrdersPage />} />
        </Routes>
      </main>
    </div>
  )
}
