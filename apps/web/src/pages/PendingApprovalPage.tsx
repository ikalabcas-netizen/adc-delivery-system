import { useAuthStore } from '@/stores/authStore'

export function PendingApprovalPage() {
  const { signOut, profile } = useAuthStore()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Chờ duyệt tài khoản</h1>
        <p className="text-gray-500 mb-2">
          Xin chào <span className="font-medium text-gray-700">{profile?.full_name ?? 'bạn'}</span>,
        </p>
        <p className="text-gray-500 mb-8 text-sm">
          Tài khoản của bạn đang chờ Super Admin xét duyệt và gán vai trò. Vui lòng liên hệ quản trị viên hệ thống.
        </p>
        <button
          onClick={signOut}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  )
}
