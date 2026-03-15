/**
 * FeedbackCallout — Floating button at bottom-right corner for all users
 * to submit Kaizen suggestions. Clicking opens a modal form.
 */
import { useState } from 'react'
import { MessageSquarePlus, X, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const CATEGORIES = [
  { value: 'improvement', label: '💡 Cải tiến' },
  { value: 'bug',         label: '🐛 Lỗi hệ thống' },
  { value: 'feature',     label: '✨ Tính năng mới' },
  { value: 'general',     label: '💬 Ý kiến chung' },
  { value: 'other',       label: '📋 Khác' },
]

export function FeedbackCallout() {
  const { profile } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('improvement')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (!title.trim() || !content.trim() || !profile?.id) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('kaizen_feedback').insert({
        author_id: profile.id,
        title: title.trim(),
        content: content.trim(),
        category,
      })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
        setTitle('')
        setContent('')
        setCategory('improvement')
      }, 1500)
    } catch (err) {
      console.error('Feedback submit error:', err)
    }
    setSubmitting(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 18px', borderRadius: 50,
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          color: '#fff', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124,58,237,0.35)',
          fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 600,
          zIndex: 90, transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.45)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.35)'
        }}
      >
        <MessageSquarePlus size={16} />
        <span style={{ display: 'inline' }}>Góp ý</span>
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420,
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              border: '1px solid rgba(124,58,237,0.12)',
              overflow: 'hidden', fontFamily: 'Outfit, sans-serif',
              animation: 'fadeInUp 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '18px 20px 14px',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MessageSquarePlus size={18} />
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Góp ý xây dựng hệ thống</h3>
                  <p style={{ fontSize: 11, opacity: 0.75, margin: '2px 0 0' }}>Kaizen · Cải tiến liên tục</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,255,255,0.15)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
                <X size={14} color="#fff" />
              </button>
            </div>

            {success ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#059669' }}>Cảm ơn góp ý của bạn!</p>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Quản trị viên sẽ xem xét và phản hồi.</p>
              </div>
            ) : (
              <>
                {/* Body */}
                <div style={{ padding: '18px 20px' }}>
                  {/* Category */}
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Phân loại
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {CATEGORIES.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setCategory(c.value)}
                        style={{
                          padding: '5px 12px', borderRadius: 20,
                          border: category === c.value ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                          background: category === c.value ? '#f5f3ff' : '#fff',
                          color: category === c.value ? '#7c3aed' : '#475569',
                          fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          fontFamily: 'Outfit, sans-serif',
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  {/* Title */}
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Tiêu đề <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Tóm tắt ngắn gọn..."
                    autoFocus
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid #e2e8f0', borderRadius: 9,
                      fontSize: 14, fontFamily: 'Outfit, sans-serif',
                      color: '#1e293b', background: '#fff',
                      outline: 'none', boxSizing: 'border-box',
                      marginBottom: 14,
                    }}
                  />

                  {/* Content */}
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Nội dung chi tiết <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Mô tả chi tiết ý kiến, đề xuất cải tiến, hoặc lỗi bạn gặp..."
                    rows={4}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1px solid #e2e8f0', borderRadius: 9,
                      fontSize: 14, fontFamily: 'Outfit, sans-serif',
                      color: '#1e293b', background: '#fff',
                      outline: 'none', boxSizing: 'border-box',
                      resize: 'vertical',
                    }}
                  />
                </div>

                {/* Footer */}
                <div style={{ padding: '0 20px 18px', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setOpen(false)}
                    style={{
                      flex: 1, padding: 10, border: '1px solid #e2e8f0', borderRadius: 9,
                      background: '#fff', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'Outfit, sans-serif', color: '#475569',
                    }}
                  >
                    Huỷ
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!title.trim() || !content.trim() || submitting}
                    style={{
                      flex: 2, padding: 10, border: 'none', borderRadius: 9,
                      background: (!title.trim() || !content.trim())
                        ? '#e2e8f0'
                        : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      color: (!title.trim() || !content.trim()) ? '#94a3b8' : '#fff',
                      fontSize: 13, fontWeight: 600, cursor: (!title.trim() || !content.trim()) ? 'not-allowed' : 'pointer',
                      fontFamily: 'Outfit, sans-serif',
                      boxShadow: (!title.trim() || !content.trim()) ? 'none' : '0 2px 8px rgba(124,58,237,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Send size={13} />
                    {submitting ? 'Đang gửi...' : 'Gửi góp ý'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
