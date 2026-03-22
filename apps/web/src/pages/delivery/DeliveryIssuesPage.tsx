import { useState, useRef, useEffect } from 'react'
import {
  MapPinOff, PhoneOff, DoorClosed, AlertTriangle, CheckCircle, Image as ImageIcon, X, Clock, HelpCircle, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { compressImage } from '@/utils/imageCompressor'

const ISSUE_CATEGORIES = [
  { id: 'wrong_address', label: 'Sai địa chỉ', icon: MapPinOff },
  { id: 'closed', label: 'Cửa hàng đóng/Chuyển đi', icon: DoorClosed },
  { id: 'wrong_phone', label: 'Sai số ĐT', icon: PhoneOff },
  { id: 'other', label: 'Lý do khác', icon: AlertTriangle },
]

export function DeliveryIssuesPage() {
  const { profile } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form')
  
  // Form State
  const [category, setCategory] = useState('wrong_address')
  const [orderId, setOrderId] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoSizeKb, setPhotoSizeKb] = useState<number | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // History State
  const [issues, setIssues] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchIssues = async () => {
    if (!profile?.id) return
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('delivery_issues')
      .select('*')
      .eq('driver_id', profile.id)
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setIssues(data)
    }
    setLoadingHistory(false)
  }

  useEffect(() => {
    if (activeTab === 'history') {
      fetchIssues()
    }
  }, [activeTab, profile?.id])

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    try {
      const blob = await compressImage(file, 50)
      const url = URL.createObjectURL(blob)
      setPhoto(blob)
      setPhotoPreview(url)
      setPhotoSizeKb(Math.round(blob.size / 1024))
    } catch {
      alert('Lỗi khi xử lý ảnh.')
    } finally {
      setCompressing(false)
    }
  }

  const clearPhoto = () => {
    setPhoto(null)
    setPhotoPreview(null)
    setPhotoSizeKb(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || description.trim().length < 5) {
      alert('Vui lòng nhập mô tả chi tiết lỗi (ít nhất 5 ký tự).')
      return
    }

    setSubmitting(true)
    try {
      const uid = profile?.id
      if (!uid) throw new Error('Không có thông tin người dùng.')

      let photoUrl = null

      if (photo) {
        const stamp = Date.now()
        const path = `${uid}/issue_${stamp}.jpg`

        const arr = await photo.arrayBuffer()
        const { error: uploadError } = await supabase.storage
          .from('feedback-photos')
          .upload(path, arr, { upsert: true, contentType: 'image/jpeg' })

        if (uploadError) throw new Error('Lỗi upload ảnh: ' + uploadError.message)

        const { data: { publicUrl } } = supabase.storage
          .from('feedback-photos')
          .getPublicUrl(path)
        
        photoUrl = publicUrl
      }

      const { error: insertError } = await supabase
        .from('delivery_issues')
        .insert({
          driver_id: uid,
          order_id: orderId.trim() || null,
          issue_category: category,
          description: description.trim(),
          photo_url: photoUrl,
          status: 'pending'
        })

      if (insertError) throw insertError

      setSubmitted(true)
      // Reset form
      setOrderId('')
      setDescription('')
      clearPhoto()
    } catch (err: any) {
      alert('Lỗi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const renderStatusBadge = (status: string) => {
    switch(status) {
      case 'pending': return <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Chờ xử lý</span>
      case 'investigating': return <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Đang kiểm tra</span>
      case 'resolved': return <span style={{ background: '#dcfce7', color: '#059669', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Đã xử lý</span>
      case 'cancelled': return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>Hủy</span>
      default: return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{status}</span>
    }
  }

  const getCategoryLabel = (catId: string) => {
    return ISSUE_CATEGORIES.find(c => c.id === catId)?.label || 'Khác'
  }

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 600 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Báo sự cố giao hàng</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Báo cáo địa chỉ lỗi, không mpos, hoặc các sự cố khác</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: 4, background: '#f1f5f9', borderRadius: 12 }}>
        <button
          onClick={() => setActiveTab('form')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
            background: activeTab === 'form' ? '#fff' : 'transparent',
            color: activeTab === 'form' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'form' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          Tạo báo cáo
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1, padding: '10px 0', border: 'none', borderRadius: 8,
            background: activeTab === 'history' ? '#fff' : 'transparent',
            color: activeTab === 'history' ? '#0f172a' : '#64748b',
            boxShadow: activeTab === 'history' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          Lịch sử xử lý
        </button>
      </div>

      {activeTab === 'form' && (
        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          {submitted ? (
            <div style={{ textAlign: 'center', paddingTop: 40, paddingBottom: 40, background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <div style={{ 
                width: 64, height: 64, background: '#dcfce7', borderRadius: 20, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
              }}>
                <CheckCircle size={32} color="#059669" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>Gửi thành công!</h2>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
                Sự cố đã được báo về hệ thống.<br />Điều phối viên sẽ xem xét và phản hồi sớm nhất.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: '1px solid #059669',
                  background: 'transparent', color: '#059669', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif'
                }}
              >
                Tạo báo cáo khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Category */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                  Loại sự cố *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ISSUE_CATEGORIES.map(cat => {
                    const selected = category === cat.id
                    const Icon = cat.icon
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        style={{
                          padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                          background: selected ? '#ecfdf5' : '#fff',
                          border: `1px solid ${selected ? '#059669' : '#e2e8f0'}`,
                          display: 'flex', alignItems: 'center', gap: 12,
                          color: selected ? '#059669' : '#334155',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Icon size={18} color={selected ? '#059669' : '#94a3b8'} />
                        <span style={{ fontSize: 14, fontWeight: selected ? 700 : 500 }}>{cat.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Order ID */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                  Mã Đơn hàng (Không bắt buộc nhưng khuyến khích)
                </label>
                <div style={{ position: 'relative' }}>
                  <FileText size={18} color="#94a3b8" style={{ position: 'absolute', top: 14, left: 14 }} />
                  <input
                    type="text"
                    value={orderId}
                    onChange={e => setOrderId(e.target.value)}
                    placeholder="Nhập mã đơn cần báo cáo (VD: DH1234)..."
                    style={{
                      width: '100%', padding: '14px 14px 14px 40px', borderRadius: 12, border: '1px solid #e2e8f0',
                      fontFamily: 'Outfit, sans-serif', fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={e => e.target.style.borderColor = '#059669'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                  Mô tả chi tiết *
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ghi rõ tình trạng thực tế tại địa điểm giao hàng..."
                  rows={4}
                  style={{
                    width: '100%', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0',
                    fontFamily: 'Outfit, sans-serif', fontSize: 14, resize: 'vertical',
                    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#059669'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  required
                  minLength={5}
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>
                  Ảnh minh chứng (Cửa đóng, bảng tên sai...)
                </label>
                
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handlePhotoSelect} style={{ display: 'none' }} />

                {!photoPreview ? (
                  <div
                    onClick={() => !compressing && fileInputRef.current?.click()}
                    style={{
                      height: 80, background: compressing ? '#f0fdf4' : '#f8fafc', borderRadius: 12, border: `1px dashed ${compressing ? '#059669' : '#cbd5e1'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      cursor: compressing ? 'wait' : 'pointer', color: compressing ? '#059669' : '#94a3b8', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => { if (!compressing) e.currentTarget.style.background = '#f1f5f9' }}
                    onMouseLeave={e => { if (!compressing) e.currentTarget.style.background = '#f8fafc' }}
                  >
                    <ImageIcon size={20} />
                    <span style={{ fontSize: 13 }}>{compressing ? 'Đang nén ảnh...' : 'Chụp ảnh (&lt; 50 KB)'}</span>
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: 'fit-content' }}>
                    <img src={photoPreview ?? ''} alt="Preview" style={{ height: 160, borderRadius: 12, border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                    {photoSizeKb !== null && (
                      <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(5,150,105,0.85)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                        ✓ {photoSizeKb} KB
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={clearPhoto}
                      style={{
                        position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                        background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '50%',
                        border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 8, padding: 16, borderRadius: 14, background: '#059669', color: '#fff', border: 'none',
                  fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Outfit, sans-serif', opacity: submitting ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(8,145,178,0.2)'
                }}
              >
                {submitting ? 'Đang gửi báo cáo...' : 'Gửi Báo Cáo Sự Cố'}
              </button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Đang tải lịch sử...</div>
          ) : issues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 16, border: '1px dashed #e2e8f0' }}>
              <HelpCircle size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Bạn chưa có báo cáo sự cố nào.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {issues.map(issue => (
                <div key={issue.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{getCategoryLabel(issue.issue_category)}</span>
                        {renderStatusBadge(issue.status)}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {new Date(issue.created_at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ padding: 16 }}>
                    {issue.order_id && (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Mã đơn: <span style={{ color: '#059669' }}>{issue.order_id}</span></div>
                    )}
                    <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.5 }}>{issue.description}</p>
                    
                    {issue.photo_url && (
                      <img src={issue.photo_url} alt="Minh chứng" style={{ marginTop: 12, height: 100, borderRadius: 8, border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                    )}

                    {issue.dispatcher_note && (
                      <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #059669' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4, textTransform: 'uppercase' }}>Phản hồi từ Điều phối</div>
                        <p style={{ fontSize: 13, color: '#334155', margin: 0, lineHeight: 1.4 }}>{issue.dispatcher_note}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
