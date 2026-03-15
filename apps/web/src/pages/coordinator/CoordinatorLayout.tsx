import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

function CoordinatorSidebar() {
  const { profile, signOut } = useAuthStore()
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <div className="font-bold text-brand-700 text-lg">ADC Delivery</div>
        <div className="text-xs text-gray-500 mt-0.5">Điều phối</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/coordinator/orders" className={navClass}>📋 Đơn hàng</NavLink>
        <NavLink to="/coordinator/trips"  className={navClass}>🗺️ Chuyến đi</NavLink>
        <NavLink to="/coordinator/map"    className={navClass}>📍 Bản đồ realtime</NavLink>
        <NavLink to="/coordinator/locations" className={navClass}>📌 Địa điểm</NavLink>
      </nav>
      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 truncate mb-2">{profile?.full_name}</div>
        <button onClick={signOut} className="text-xs text-red-400 hover:text-red-600">Đăng xuất</button>
      </div>
    </aside>
  )
}

export function CoordinatorLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <CoordinatorSidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="orders"    element={<div className="p-6"><h1 className="text-2xl font-bold">Đơn hàng</h1><p className="text-gray-500 mt-2">Danh sách đơn hàng — đang phát triển</p></div>} />
          <Route path="trips"     element={<div className="p-6"><h1 className="text-2xl font-bold">Chuyến đi</h1><p className="text-gray-500 mt-2">Quản lý chuyến đi — đang phát triển</p></div>} />
          <Route path="map"       element={<div className="p-6"><h1 className="text-2xl font-bold">Bản đồ Realtime</h1><p className="text-gray-500 mt-2">Theo dõi tài xế — đang phát triển</p></div>} />
          <Route path="locations" element={<div className="p-6"><h1 className="text-2xl font-bold">Địa điểm</h1><p className="text-gray-500 mt-2">Quản lý địa điểm — đang phát triển</p></div>} />
          <Route path="*"         element={<div className="p-6"><h1 className="text-2xl font-bold">Điều phối</h1><p className="text-gray-500 mt-2">Chọn mục từ menu bên trái</p></div>} />
        </Routes>
      </main>
    </div>
  )
}
