/**
 * KaizenPage — Admin page to manage Kaizen feedback from all users.
 * Super admin can view, accept, reject, mark as done, plus add admin notes.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquarePlus, CheckCircle, XCircle, Clock, Check,
  RefreshCw, ChevronDown, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Pagination } from '@/components/Pagination'

interface Feedback {
  id: string
  title: string
  content: string
  category: string
  status: string
  admin_note: string | null
  created_at: string
  updated_at: string
  author: { full_name: string | null; role: string | null } | null
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: 'Chờ xem xét', bg: '#fffbeb', color: '#d97706', icon: <Clock size={12} /> },
  accepted: { label: 'Đã duyệt',   bg: '#eff6ff', color: '#2563eb', icon: <Check size={12} /> },
  done:     { label: 'Đã thực hiện', bg: '#f0fdf4', color: '#059669', icon: <CheckCircle size={12} /> },
  rejected: { label: 'Đã từ chối', bg: '#f8fafc', color: '#94a3b8', icon: <XCircle size={12} /> },
}

const CATEGORY_MAP: Record<string, string> = {
  improvement: '💡 Cải tiến',
  bug:         '🐛 Lỗi',
  feature:     '✨ Tính năng mới',
  general:     '💬 Ý kiến',
  other:       '📋 Khác',
}

const TABS = [
  { key: 'all',      label: 'Tất cả' },
  { key: 'pending',  label: 'Chờ xem xét' },
  { key: 'accepted', label: 'Đã duyệt' },
  { key: 'done',     label: 'Đã thực hiện' },
  { key: 'rejected', label: 'Đã từ chối' },
]

export function KaizenPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('kaizen_feedback')
      .select('*, author:profiles!kaizen_feedback_author_id_fkey(full_name, role)')
      .order('created_at', { ascending: false })
    setItems((data ?? []) as Feedback[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const KAIZEN_PAGE_SIZE = 15
  const filtered = tab === 'all' ? items : items.filter(i => i.status === tab)
  const totalPages = Math.ceil(filtered.length / KAIZEN_PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * KAIZEN_PAGE_SIZE, page * KAIZEN_PAGE_SIZE)

  function handleTabChange(key: string) {
    setTab(key)
    setPage(1)
  }

  async function handleStatusUpdate(id: string, status: string, note?: string) {
    setUpdating(id)
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
    if (note !== undefined) updates.admin_note = note
    await supabase.from('kaizen_feedback').update(updates).eq('id', id)
    await fetchData()
    setUpdating(null)
    setExpandedId(null)
  }

  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    accepted: items.filter(i => i.status === 'accepted').length,
    done: items.filter(i => i.status === 'done').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  }

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <MessageSquarePlus size={22} color="#7c3aed" /> Kaizen
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {items.length} góp ý · {counts.pending} chờ xử lý
          </p>
        </div>
        <button onClick={fetchData} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
          background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#475569',
          fontFamily: 'Outfit, sans-serif',
        }}>
          <RefreshCw size={13} /> Tải lại
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const count = counts[t.key as keyof typeof counts] ?? 0
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: active ? 'none' : '1px solid #e2e8f0',
                background: active ? '#7c3aed' : '#fff',
                color: active ? '#fff' : '#475569',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
          Không có góp ý nào
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paginated.map(item => {
            const st = STATUS_MAP[item.status] ?? STATUS_MAP.pending
            const isExpanded = expandedId === item.id
            const isUpdating = updating === item.id

            return (
              <div key={item.id} style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}>
                {/* Card header */}
                <div
                  onClick={() => { setExpandedId(isExpanded ? null : item.id); setAdminNote(item.admin_note ?? '') }}
                  style={{
                    padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: st.bg, color: st.color, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}>
                        {st.icon} {st.label}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f5f3ff', color: '#7c3aed', fontWeight: 500 }}>
                        {CATEGORY_MAP[item.category] ?? item.category}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: 0 }}>{item.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <User size={10} color="#94a3b8" />
                        <span style={{ fontSize: 11, color: '#64748b' }}>{item.author?.full_name ?? 'N/A'}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>·</span>
                      <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                        {new Date(item.created_at).toLocaleString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <ChevronDown size={16} color="#94a3b8" style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s', flexShrink: 0, marginTop: 6,
                  }} />
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                    {/* Content */}
                    <div style={{
                      background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                      marginTop: 12, fontSize: 13, color: '#334155', lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {item.content}
                    </div>

                    {/* Existing admin note */}
                    {item.admin_note && (
                      <div style={{
                        background: '#eff6ff', borderRadius: 8, padding: '10px 14px',
                        marginTop: 8, fontSize: 12, color: '#1e40af',
                        borderLeft: '3px solid #2563eb',
                      }}>
                        <strong>Ghi chú admin:</strong> {item.admin_note}
                      </div>
                    )}

                    {/* Action area */}
                    {item.status !== 'done' && item.status !== 'rejected' && (
                      <div style={{ marginTop: 14 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                          Ghi chú quản trị (tuỳ chọn)
                        </label>
                        <textarea
                          value={adminNote}
                          onChange={e => setAdminNote(e.target.value)}
                          placeholder="Phản hồi, lý do từ chối..."
                          rows={2}
                          style={{
                            width: '100%', padding: '8px 12px',
                            border: '1px solid #e2e8f0', borderRadius: 9,
                            fontSize: 13, fontFamily: 'Outfit, sans-serif',
                            color: '#1e293b', outline: 'none', boxSizing: 'border-box',
                            resize: 'vertical',
                          }}
                        />

                        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                          {item.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(item.id, 'accepted', adminNote.trim() || undefined)}
                                disabled={isUpdating}
                                style={{
                                  padding: '8px 16px', borderRadius: 8, border: 'none',
                                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'Outfit, sans-serif',
                                  display: 'flex', alignItems: 'center', gap: 5,
                                }}
                              >
                                <Check size={13} /> Duyệt
                              </button>
                              <button
                                onClick={() => handleStatusUpdate(item.id, 'rejected', adminNote.trim() || undefined)}
                                disabled={isUpdating}
                                style={{
                                  padding: '8px 16px', borderRadius: 8,
                                  border: '1px solid #e2e8f0', background: '#fff', color: '#e11d48',
                                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'Outfit, sans-serif',
                                  display: 'flex', alignItems: 'center', gap: 5,
                                }}
                              >
                                <XCircle size={13} /> Từ chối
                              </button>
                            </>
                          )}
                          {item.status === 'accepted' && (
                            <button
                              onClick={() => handleStatusUpdate(item.id, 'done', adminNote.trim() || undefined)}
                              disabled={isUpdating}
                              style={{
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff',
                                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                fontFamily: 'Outfit, sans-serif',
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}
                            >
                              <CheckCircle size={13} /> Đánh dấu đã thực hiện
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!loading && filtered.length > KAIZEN_PAGE_SIZE && (
        <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={KAIZEN_PAGE_SIZE} onPageChange={setPage} />
      )}
    </div>
  )
}
