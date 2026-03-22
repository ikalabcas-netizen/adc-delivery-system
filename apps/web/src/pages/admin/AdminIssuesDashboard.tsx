import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function AdminIssuesDashboard() {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIssue, setSelectedIssue] = useState<any>(null)
  
  // Edit State
  const [editStatus, setEditStatus] = useState<string>('pending')
  const [editNote, setEditNote] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const fetchIssues = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('delivery_issues')
      .select(`
        *,
        driver:profiles!driver_id(id, full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (!error && data) {
      setIssues(data)
    } else {
      console.error('Lỗi khi tải báo cáo sự cố:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchIssues()
  }, [])

  const handleEditIssue = (issue: any) => {
    setSelectedIssue(issue)
    setEditStatus(issue.status || 'pending')
    setEditNote(issue.dispatcher_note || '')
  }

  const handleSaveIssue = async () => {
    if (!selectedIssue) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('delivery_issues')
        .update({
          status: editStatus,
          dispatcher_note: editNote.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedIssue.id)

      if (error) throw error

      alert('Cập nhật trạng thái thành công!')
      setSelectedIssue(null)
      fetchIssues()
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Chờ xử lý</span>
      case 'investigating': return <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Đang kiểm tra</span>
      case 'resolved': return <span style={{ background: '#dcfce7', color: '#059669', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Đã xử lý</span>
      case 'cancelled': return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Hủy đơn</span>
      default: return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{status}</span>
    }
  }

  const renderCategory = (cat: string) => {
    switch(cat) {
      case 'wrong_address': return 'Sai địa chỉ'
      case 'closed': return 'Cửa hàng đóng/Chuyển đi'
      case 'wrong_phone': return 'Sai SĐT'
      case 'other': return 'Khác'
      default: return cat
    }
  }

  return (
    <div style={{ padding: 32, fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Quản lý Sự cố Giao hàng</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Theo dõi và xử lý các vấn đề từ tài xế tuyến</p>
        </div>
        <button onClick={fetchIssues} style={{ padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>Tải lại</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedIssue ? '1fr 400px' : '1fr', gap: 24, alignItems: 'start' }}>
        
        {/* Lish Issues */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Đang tải dữ liệu...</div>
          ) : issues.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Không có sự cố nào.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Thời gian</th>
                  <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Tài xế</th>
                  <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Sự cố / Mã Đơn</th>
                  <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Trạng thái</th>
                  <th style={{ padding: '16px 20px', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(issue => (
                  <tr key={issue.id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedIssue?.id === issue.id ? '#f8fafc' : '#fff' }}>
                    <td style={{ padding: '16px 20px', fontSize: 13, color: '#64748b' }}>
                      {new Date(issue.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 14 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{issue.driver?.full_name || 'Vô danh'}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{issue.driver?.email}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{renderCategory(issue.issue_category)}</div>
                      {issue.order_id && <div style={{ fontSize: 12, color: '#0891b2', fontWeight: 600 }}>Mã đơn: {issue.order_id}</div>}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      {renderStatusBadge(issue.status)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleEditIssue(issue)}
                        style={{ padding: '6px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}
                      >
                        Xử lý
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Panel */}
        {selectedIssue && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', padding: 24, animation: 'fadeIn 0.2s ease-in-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 16, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Chi tiết Sự cố</h2>
                <div style={{ fontSize: 13, color: '#64748b' }}>{new Date(selectedIssue.created_at).toLocaleString('vi-VN')}</div>
              </div>
              <button onClick={() => setSelectedIssue(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>TÀI XẾ BÁO CÁO</div>
                <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 500 }}>{selectedIssue.driver?.full_name || 'Không rõ'}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>LOẠI SỰ CỐ & MÃ ĐƠN</div>
                <div style={{ fontSize: 14, color: '#0891b2', fontWeight: 600 }}>{renderCategory(selectedIssue.issue_category)} {selectedIssue.order_id ? `- ${selectedIssue.order_id}` : ''}</div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>MÔ TẢ CHI TIẾT</div>
                <div style={{ fontSize: 14, color: '#334155', background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  {selectedIssue.description || 'Không có mô tả.'}
                </div>
              </div>

              {selectedIssue.photo_url && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>ẢNH MINH CHỨNG</div>
                  <a href={selectedIssue.photo_url} target="_blank" rel="noreferrer">
                    <img src={selectedIssue.photo_url} alt="Minh chứng" style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }} />
                  </a>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>Cập nhật Xử lý (Điều phối)</h3>
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>TRẠNG THÁI HIỆN TẠI</label>
                <select 
                  value={editStatus} 
                  onChange={e => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'Outfit, sans-serif' }}
                >
                  <option value="pending">Chờ xử lý</option>
                  <option value="investigating">Đang kiểm tra / Liên hệ lại</option>
                  <option value="resolved">Tiếp tục giao / Đã giải quyết</option>
                  <option value="cancelled">Hủy đơn / Yêu cầu hoàn hàng</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>GHI CHÚ / CHỈ ĐẠO CHO TÀI XẾ</label>
                <textarea 
                  value={editNote} 
                  onChange={e => setEditNote(e.target.value)}
                  placeholder="VD: Anh thử gọi lại số phụ nhé..."
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'Outfit, sans-serif', resize: 'vertical' }}
                />
              </div>

              <button 
                onClick={handleSaveIssue}
                disabled={saving}
                style={{ width: '100%', padding: 12, borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}
              >
                {saving ? 'Đang lưu...' : 'Lưu cập nhật'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
