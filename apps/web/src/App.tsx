import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { PendingApprovalPage } from '@/pages/PendingApprovalPage'
import { CoordinatorLayout } from '@/pages/coordinator/CoordinatorLayout'
import { MonitorLayout } from '@/pages/monitor/MonitorLayout'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { FullPageSpinner } from '@/components/ui/Spinner'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@adc/shared-types'

export default function App() {
  const { session, profile, isLoading } = useAuthStore()
  return (
    <BrowserRouter>
      <AppRoutes session={session} profile={profile} isLoading={isLoading} />
    </BrowserRouter>
  )
}

interface AppRoutesProps {
  session:   Session | null
  profile:   Profile | null
  isLoading: boolean
}

function AppRoutes({ session, profile, isLoading }: AppRoutesProps) {
  // /auth/callback must always be accessible (even while loading) so Supabase can exchange code
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* While checking session */}
      <Route
        path="*"
        element={
          isLoading ? (
            <FullPageSpinner />
          ) : !session ? (
            <LoginPage />
          ) : !profile?.is_approved || !profile?.role ? (
            <PendingApprovalPage />
          ) : (
            <AuthenticatedRoutes role={profile.role} />
          )
        }
      />
    </Routes>
  )
}

function AuthenticatedRoutes({ role }: { role: string }) {
  return (
    <Routes>
      {/* Coordinator */}
      <Route
        path="/coordinator/*"
        element={
          <ProtectedRoute allowedRoles={['coordinator', 'super_admin']}>
            <CoordinatorLayout />
          </ProtectedRoute>
        }
      />

      {/* Monitor (Sales + Manager) */}
      <Route
        path="/monitor/*"
        element={
          <ProtectedRoute allowedRoles={['sales', 'manager', 'super_admin']}>
            <MonitorLayout />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      />

      {/* Default: redirect by role */}
      <Route path="*" element={<RoleRedirect role={role} />} />
    </Routes>
  )
}

function RoleRedirect({ role }: { role?: string }) {
  if (role === 'super_admin') return <Navigate to="/admin/users" replace />
  if (role === 'coordinator') return <Navigate to="/coordinator/orders" replace />
  if (role === 'sales' || role === 'manager') return <Navigate to="/monitor/dashboard" replace />
  if (role === 'delivery') return <Navigate to="/pending" replace />
  return <Navigate to="/pending" replace />
}
