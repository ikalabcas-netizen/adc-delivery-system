import { useState } from 'react'
import { CheckCircle, XCircle, Edit3, Search } from 'lucide-react'
import { useUsers, useApproveUser, useRevokeUser } from '@/hooks/useUsers'
import { RoleBadge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Profile, UserRole } from '@adc/shared-types'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'coordinator', label: 'Điều phối viên' },
  { value: 'sales',       label: 'Kinh doanh' },
  { value: 'manager',     label: 'Quản lý' },
  { value: 'delivery',    label: 'Giao nhận' },
]

export function AdminUsersPage() {
  const { data: users = [], isLoading } = useUsers()
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)

  const filtered = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email     ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const pending  = filtered.filter(u => !u.is_approved)
  const approved = filtered.filter(u => u.is_approved)

  return (
    <div className="page-content">
      <PageHeader
        title="Quản lý người dùng"
        subtitle={`${users.length} tài khoản · ${users.filter(u => !u.is_approved).length} chờ duyệt`}
      />

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '320px' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm tên hoặc email..."
          style={{
            width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
            fontFamily: 'Outfit, sans-serif', outline: 'none', color: '#1e293b',
          }}
        />
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <section>
          <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 12 }}>
            Chờ duyệt ({pending.length})
          </h2>
          <UserTable users={pending} onEdit={setEditing} variant="pending" />
        </section>
      )}

      {/* Approved */}
      <section>
        <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 12 }}>
          Đã duyệt ({approved.length})
        </h2>
        {isLoading ? (
          <p style={{ fontSize: 13, color: '#94a3b8', padding: '16px 0' }}>Đang tải...</p>
        ) : approved.length === 0 ? (
          <EmptyState title="Chưa có tài khoản đã duyệt" />
        ) : (
          <UserTable users={approved} onEdit={setEditing} variant="approved" />
        )}
      </section>

      {/* Edit modal */}
      {editing && (
        <ApproveModal profile={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

// ─── User Table ───────────────────────────────────────────────────
function UserTable({
  users,
  onEdit,
  variant,
}: {
  users: Profile[]
  onEdit: (p: Profile) => void
  variant: 'pending' | 'approved'
}) {
  const revoke = useRevokeUser()

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            {['Người dùng', 'Email', 'Vai trò', 'Ngày đăng ký', ''].map(h => (
              <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500, color: '#94a3b8', fontSize: 12 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
              {/* Avatar + Name */}
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0891b2' }}>
                      {(u.full_name ?? u.email ?? '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontWeight: 500, color: '#1e293b' }}>{u.full_name ?? '—'}</span>
                </div>
              </td>
              <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email ?? '—'}</td>
              <td style={{ padding: '12px 16px' }}>
                {u.role ? <RoleBadge role={u.role} /> : <span style={{ color: '#cbd5e1', fontSize: 12 }}>Chưa gán</span>}
              </td>
              <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                {new Date(u.created_at).toLocaleDateString('vi-VN')}
              </td>
              <td style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {variant === 'pending' && (
                    <button
                      onClick={() => onEdit(u)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#06b6d4', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                    >
                      <CheckCircle size={13} /> Duyệt
                    </button>
                  )}
                  {variant === 'approved' && (
                    <button
                      onClick={() => onEdit(u)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                    >
                      <Edit3 size={12} /> Sửa
                    </button>
                  )}
                  {variant === 'approved' && (
                    <button
                      onClick={() => revoke.mutate(u.id)}
                      disabled={revoke.isPending}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#fff1f2', color: '#e11d48', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                    >
                      <XCircle size={12} /> Thu hồi
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Approve / Edit Modal ─────────────────────────────────────────
function ApproveModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const approve = useApproveUser()
  const [name, setName] = useState(profile.full_name ?? '')
  const [role, setRole] = useState<UserRole>(profile.role ?? 'delivery')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!name.trim()) { setError('Vui lòng nhập tên hiển thị'); return }
    await approve.mutateAsync({ userId: profile.id, role, full_name: name.trim() })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
          {profile.is_approved ? 'Chỉnh sửa tài khoản' : 'Duyệt tài khoản'}
        </h2>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>{profile.email}</p>

        {/* Full name */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Tên hiển thị</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nhập tên đầy đủ..."
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'Outfit, sans-serif', marginBottom: 16, color: '#1e293b' }}
        />

        {/* Role */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vai trò</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'Outfit, sans-serif', marginBottom: 20, color: '#1e293b', appearance: 'auto' }}
        >
          {ROLE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {error && <p style={{ fontSize: 12, color: '#e11d48', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', color: '#475569' }}
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={approve.isPending}
            style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 8, background: '#06b6d4', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
          >
            {approve.isPending ? 'Đang lưu...' : profile.is_approved ? 'Lưu thay đổi' : '✓ Duyệt tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}
