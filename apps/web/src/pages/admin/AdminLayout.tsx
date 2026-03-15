import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

function AdminSidebar() {
  const { profile, signOut } = useAuthStore()
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
    }`

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <div className="font-bold text-purple-700 text-lg">ADC Delivery</div>
        <div className="text-xs text-gray-500 mt-0.5">Super Admin</div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/admin/users"   className={navClass}>👥 Người dùng</NavLink>
        <NavLink to="/admin/roles"   className={navClass}>🔑 Phân quyền</NavLink>
        <NavLink to="/admin/system"  className={navClass}>⚙️ Hệ thống</NavLink>
      </nav>
      <div className="p-3 border-t border-gray-200">
        <div className="text-xs text-gray-500 truncate mb-2">{profile?.full_name}</div>
        <button onClick={signOut} className="text-xs text-red-400 hover:text-red-600">Đăng xuất</button>
      </div>
    </aside>
  )
}

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="users"  element={<div className="p-6"><h1 className="text-2xl font-bold">Người dùng</h1><p className="text-gray-500 mt-2">Danh sách tài khoản — đang phát triển</p></div>} />
          <Route path="roles"  element={<div className="p-6"><h1 className="text-2xl font-bold">Phân quyền</h1><p className="text-gray-500 mt-2">Duyệt và gán vai trò — đang phát triển</p></div>} />
          <Route path="system" element={<div className="p-6"><h1 className="text-2xl font-bold">Hệ thống</h1><p className="text-gray-500 mt-2">Cấu hình hệ thống — đang phát triển</p></div>} />
          <Route path="*"      element={<div className="p-6"><h1 className="text-2xl font-bold">Admin</h1><p className="text-gray-500 mt-2">Chọn mục từ menu bên trái</p></div>} />
        </Routes>
      </main>
    </div>
  )
}
