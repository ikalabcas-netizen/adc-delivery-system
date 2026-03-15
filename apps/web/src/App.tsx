import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { PendingApprovalPage } from '@/pages/PendingApprovalPage'
import { CoordinatorLayout } from '@/pages/coordinator/CoordinatorLayout'
import { MonitorLayout } from '@/pages/monitor/MonitorLayout'
import { AdminLayout } from '@/pages/admin/AdminLayout'

export default function App() {
  const { session, profile, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-adc-500 border-t-transparent" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  if (!profile?.is_approved || !profile?.role) return <PendingApprovalPage />

  return (
    <BrowserRouter>
      <Routes>
        {/* Coordinator routes */}
        <Route
          path="/coordinator/*"
          element={
            <ProtectedRoute allowedRoles={['coordinator', 'super_admin']}>
              <CoordinatorLayout />
            </ProtectedRoute>
          }
        />

        {/* Monitor routes (Sales + Manager) */}
        <Route
          path="/monitor/*"
          element={
            <ProtectedRoute allowedRoles={['sales', 'manager', 'super_admin']}>
              <MonitorLayout />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        />

        {/* Default redirect by role */}
        <Route path="*" element={<RoleRedirect role={profile?.role} />} />
      </Routes>
    </BrowserRouter>
  )
}

function RoleRedirect({ role }: { role?: string }) {
  if (role === 'coordinator' || role === 'super_admin') return <Navigate to="/coordinator" replace />
  if (role === 'sales' || role === 'manager') return <Navigate to="/monitor" replace />
  return <Navigate to="/pending" replace />
}
