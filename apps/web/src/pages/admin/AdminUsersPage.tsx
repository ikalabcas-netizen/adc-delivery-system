import { useState } from 'react'
import { Search, CheckCircle, XCircle, Clock, UserCheck, ChevronDown, X } from 'lucide-react'
import { useUsers, useApproveUser, useRevokeUser } from '@/hooks/useUsers'
import type { Profile, UserRole } from '@adc/shared-types'

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'super_admin', label: 'Super Admin',    color: '#7c3aed' },
  { value: 'coordinator', label: 'Điều phối viên', color: '#2563eb' },
  { value: 'sales',       label: 'Kinh doanh',     color: '#0891b2' },
  { value: 'manager',     label: 'Quản lý',        color: '#059669' },
  { value: 'delivery',    label: 'Giao nhận',      color: '#d97706' },
]

const ROLE_MAP: Record<string, { label: string; bg: string; color: string }> = {
  super_admin: { label: 'Super Admin',    bg: '#f3f0ff', color: '#7c3aed' },
  coordinator: { label: 'Điều phối viên', bg: '#eff6ff', color: '#2563eb' },
  sales:       { label: 'Kinh doanh',     bg: '#ecfeff', color: '#0891b2' },
  manager:     { label: 'Quản lý',        bg: '#f0fdf4', color: '#059669' },
  delivery:    { label: 'Giao nhận',      bg: '#fffbeb', color: '#d97706' },
}

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
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Quản lý người dùng</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {users.length} tài khoản · <span style={{ color: pending.length > 0 ? '#d97706' : '#94a3b8', fontWeight: 600 }}>{pending.length} chờ duyệt</span>
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 300, marginBottom: 20 }}>
        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm tên hoặc email..."
          style={{
            width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
            border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13,
            fontFamily: 'Outfit, sans-serif', outline: 'none', background: '#fff',
            color: '#1e293b', boxSizing: 'border-box',
          }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : (
        <>
          {/* Pending section */}
          {pending.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Clock size={14} color="#d97706" />
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#d97706' }}>
                  Chờ duyệt ({pending.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(u => (
                  <UserCard key={u.id} user={u} onEdit={setEditing} variant="pending" />
                ))}
              </div>
            </section>
          )}

          {/* Approved section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <UserCheck size={14} color="#059669" />
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#059669' }}>
                Đã duyệt ({approved.length})
              </span>
            </div>
            {approved.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>Chưa có tài khoản đã duyệt</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {approved.map(u => (
                  <UserCard key={u.id} user={u} onEdit={setEditing} variant="approved" />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {editing && <ApproveModal profile={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

// ─── User Card ────────────────────────────────────────────────────
function UserCard({ user, onEdit, variant }: { user: Profile; onEdit: (p: Profile) => void; variant: 'pending' | 'approved' }) {
  const revoke = useRevokeUser()
  const roleInfo = user.role ? ROLE_MAP[user.role] : null

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: variant === 'pending' ? '1px solid rgba(217,119,6,0.2)' : '1px solid #e2e8f0',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Avatar */}
      <div style={{ flexShrink: 0 }}>
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #cffafe, #a5f3fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#0891b2' }}>
            {(user.full_name ?? user.email ?? '?')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{user.full_name ?? '—'}</span>
          {/* Status badge */}
          {variant === 'pending' ? (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#fffbeb', color: '#d97706', border: '1px solid rgba(217,119,6,0.2)' }}>
              ⏳ Chờ duyệt
            </span>
          ) : roleInfo ? (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: roleInfo.bg, color: roleInfo.color }}>
              ✓ {roleInfo.label}
            </span>
          ) : null}
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email ?? 'Chưa có email'}
        </p>
        <p style={{ fontSize: 11, color: '#cbd5e1', margin: '1px 0 0' }}>
          Đăng ký {new Date(user.created_at).toLocaleDateString('vi-VN')}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {variant === 'pending' && (
          <button onClick={() => onEdit(user)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            boxShadow: '0 2px 8px rgba(6,182,212,0.3)',
          }}>
            <CheckCircle size={13} /> Duyệt
          </button>
        )}
        {variant === 'approved' && (
          <button onClick={() => onEdit(user)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', background: '#f8fafc',
            color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
            fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
          }}>
            <ChevronDown size={13} /> Sửa
          </button>
        )}
        {variant === 'approved' && (
          <button
            onClick={() => { if (confirm('Thu hồi quyền truy cập của người này?')) revoke.mutate(user.id) }}
            disabled={revoke.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', background: '#fff1f2',
              color: '#e11d48', border: '1px solid rgba(225,29,72,0.15)', borderRadius: 8,
              fontSize: 12, cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            }}>
            <XCircle size={13} /> Thu hồi
          </button>
        )}
      </div>
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
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16, padding: 28,
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        border: '1px solid rgba(6,182,212,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {profile.is_approved ? 'Chỉnh sửa tài khoản' : '✓ Duyệt tài khoản'}
            </h2>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{profile.email ?? 'Không có email'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Avatar preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 14px', background: '#f8fafc', borderRadius: 10 }}>
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #cffafe, #a5f3fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0891b2', fontSize: 16 }}>
              {(profile.full_name ?? profile.email ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', margin: 0 }}>{profile.full_name || 'Chưa có tên'}</p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Tài khoản Google</p>
          </div>
        </div>

        {/* Name */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Tên hiển thị <span style={{ color: '#ef4444' }}>*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Họ và tên đầy đủ..."
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'Outfit, sans-serif', marginBottom: 14, color: '#1e293b', background: '#fff', boxSizing: 'border-box' }}
        />

        {/* Role */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Vai trò</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value as UserRole)}
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'Outfit, sans-serif', marginBottom: 20, color: '#1e293b', background: '#fff' }}
        >
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {error && <p style={{ fontSize: 12, color: '#e11d48', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', color: '#475569' }}>
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={approve.isPending}
            style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 9, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', boxShadow: '0 2px 8px rgba(6,182,212,0.3)' }}
          >
            {approve.isPending ? 'Đang lưu...' : profile.is_approved ? 'Lưu thay đổi' : '✓ Duyệt tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}
