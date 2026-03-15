import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

function MonitorSidebar() {
  const { profile, signOut } = useAuthStore()
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <div className="font-bold text-green-700 text-lg">ADC Delivery</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {profile?.role === 'manager' ? 'Quản lý' : 'Kinh doanh'}
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/monitor/dashboard" className={navClass}>📊 Dashboard</NavLink>
        <NavLink to="/monitor/orders"    className={navClass}>📋 Đơn hàng</NavLink>
        <NavLink to="/monitor/map"       className={navClass}>📍 Bản đồ</NavLink>
        <NavLink to="/monitor/logs"      className={navClass}>🕐 Lịch sử</NavLink>
      </nav>
      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 truncate mb-2">{profile?.full_name}</div>
        <button onClick={signOut} className="text-xs text-red-400 hover:text-red-600">Đăng xuất</button>
      </div>
    </aside>
  )
}

export function MonitorLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <MonitorSidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="dashboard" element={<div className="p-6"><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-gray-500 mt-2">Tổng quan — đang phát triển</p></div>} />
          <Route path="orders"    element={<div className="p-6"><h1 className="text-2xl font-bold">Đơn hàng</h1><p className="text-gray-400 text-sm mt-1">Chỉ xem · Không thể phân công</p></div>} />
          <Route path="map"       element={<div className="p-6"><h1 className="text-2xl font-bold">Bản đồ</h1><p className="text-gray-500 mt-2">Theo dõi realtime — đang phát triển</p></div>} />
          <Route path="logs"      element={<div className="p-6"><h1 className="text-2xl font-bold">Lịch sử log</h1><p className="text-gray-500 mt-2">Tracking log — đang phát triển</p></div>} />
          <Route path="*"         element={<div className="p-6"><h1 className="text-2xl font-bold">Giám sát</h1><p className="text-gray-500 mt-2">Chọn mục từ menu bên trái</p></div>} />
        </Routes>
      </main>
    </div>
  )
}
