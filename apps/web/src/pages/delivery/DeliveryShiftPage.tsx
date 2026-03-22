import { useState, useEffect, useRef } from 'react'
import { PlayCircle, StopCircle, Clock, Camera, X, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { compressImage } from '@/utils/imageCompressor'
import { stampImage } from '@/utils/imageStamp'

// ─── Types ──────────────────────────────────────────────────────
interface ShiftModalProps {
  isCheckIn: boolean
  previousKm?: number
  onConfirm: (km: number, photo: Blob | null) => void
  onCancel: () => void
}

// ─── Shift Action Modal ─────────────────────────────────────────
function ShiftModal({ isCheckIn, previousKm, onConfirm, onCancel }: ShiftModalProps) {
  const [km, setKm] = useState(previousKm ?? 0)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [sizeKb, setSizeKb] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setCompressing(true)
    try {
      const stamped = await stampImage(file, {
        watermark: isCheckIn ? 'ADC Odometer In' : 'ADC Odometer Out',
        capturedAt: new Date(),
      })
      const blob = await compressImage(stamped, 50)
      const url  = URL.createObjectURL(blob)
      setPhoto(blob)
      setPreview(url)
      setSizeKb(Math.round(blob.size / 1024))
    } finally {
      setCompressing(false)
    }
  }

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview)
    setPhoto(null); setPreview(null); setSizeKb(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const canConfirm = km > 0

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
      zIndex: 200, fontFamily: 'Outfit, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '28px 20px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 20px' }} />

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
          {isCheckIn ? '🟢 Bắt đầu ca làm việc' : '🔴 Kết thúc ca làm việc'}
        </h2>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
          {isCheckIn ? 'Nhập số km và chụp ảnh đồng hồ xe.' : 'Xác nhận km kết thúc và chụp ảnh đồng hồ.'}
        </p>

        {/* Km input */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
          Số Km trên đồng hồ xe <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={km || ''}
          min={previousKm ?? 0}
          onChange={e => setKm(Number(e.target.value))}
          placeholder="Ví dụ: 12345"
          style={{
            width: '100%', padding: '12px 14px',
            border: '1.5px solid #e2e8f0', borderRadius: 12,
            fontSize: 20, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
            color: '#0f172a', outline: 'none', boxSizing: 'border-box',
            marginBottom: 20,
          }}
          onFocus={e => { e.target.style.borderColor = '#10b981' }}
          onBlur={e => { e.target.style.borderColor = '#e2e8f0' }}
          autoFocus
        />

        {/* Photo capture */}
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
          Ảnh đồng hồ (tự động nén &lt; 50 KB)
        </label>

        {preview ? (
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <img src={preview} alt="preview" style={{
              width: '100%', maxHeight: 180, objectFit: 'cover',
              borderRadius: 12, border: '1.5px solid #dcfce7',
            }} />
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(5,150,105,0.85)', color: '#fff',
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
            }}>
              ✓ {sizeKb} KB
            </div>
            <button
              onClick={clearPhoto}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={compressing}
            style={{
              width: '100%', padding: '14px',
              border: '1.5px dashed #d1fae5', borderRadius: 12,
              background: '#f0fdf4', color: '#059669',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 20, fontFamily: 'Outfit, sans-serif',
            }}
          >
            <Camera size={18} />
            {compressing ? 'Đang nén ảnh...' : 'Chụp ảnh đồng hồ xe'}
          </button>
        )}

        {/* Hidden file input — triggers native camera on iOS */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px', border: '1px solid #e2e8f0',
              borderRadius: 12, background: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', color: '#475569',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm(km, photo)}
            disabled={!canConfirm}
            style={{
              flex: 2, padding: '14px', border: 'none', borderRadius: 12,
              background: canConfirm
                ? (isCheckIn ? '#059669' : '#dc2626')
                : '#e2e8f0',
              color: canConfirm ? '#fff' : '#94a3b8',
              fontSize: 14, fontWeight: 700,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              fontFamily: 'Outfit, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <CheckCircle2 size={16} />
            {isCheckIn ? 'Bắt đầu ca' : 'Kết thúc ca'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────
export function DeliveryShiftPage() {
  const { profile } = useAuthStore()
  const [activeShift, setActiveShift] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState(false)
  const [elapsed, setElapsed]       = useState('00:00:00')
  const [modal, setModal]           = useState<'start' | 'end' | null>(null)

  const uid = profile?.id

  const fetchShift = async () => {
    if (!uid) return
    setLoading(true)
    const { data } = await supabase
      .from('driver_shifts')
      .select('*')
      .eq('driver_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setActiveShift(data && !data.ended_at ? data : null)
    setLoading(false)
  }

  useEffect(() => { fetchShift() }, [uid])

  useEffect(() => {
    if (!activeShift?.started_at) return
    const startDt = new Date(activeShift.started_at).getTime()
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - startDt) / 1000)
      const h = String(Math.floor(diff / 3600)).padStart(2, '0')
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0')
      const s = String(diff % 60).padStart(2, '0')
      setElapsed(`${h}:${m}:${s}`)
    }, 1000)
    return () => clearInterval(timer)
  }, [activeShift])

  // ── Upload odometer photo ──────────────────────────────────────
  async function uploadPhoto(blob: Blob, shiftId: string, isCheckIn: boolean): Promise<string> {
    const suffix = isCheckIn ? 'in' : 'out'
    const path   = `${uid}/${shiftId}/${suffix}.jpg`
    const arr    = await blob.arrayBuffer()
    await supabase.storage.from('odometer-photos').upload(path, arr, {
      contentType: 'image/jpeg', upsert: true,
    })
    return supabase.storage.from('odometer-photos').getPublicUrl(path).data.publicUrl
  }

  // ── Start shift ────────────────────────────────────────────────
  async function handleStartConfirm(km: number, photo: Blob | null) {
    if (!uid) return
    setModal(null)
    setProcessing(true)
    try {
      // 1. Create shift record
      const { data, error } = await supabase
        .from('driver_shifts')
        .insert({
          driver_id: uid,
          started_at: new Date().toISOString(),
          status_log: [{ status: 'free', ts: new Date().toISOString() }],
          km_in: km,
          odometer_photo_in_url: '',
        })
        .select()
        .single()
      if (error) throw error

      // 2. Upload photo if provided
      if (photo) {
        const photoUrl = await uploadPhoto(photo, data.id, true)
        await supabase.from('driver_shifts')
          .update({ odometer_photo_in_url: photoUrl })
          .eq('id', data.id)
        data.odometer_photo_in_url = photoUrl
      }

      // 3. Update profile
      await supabase.from('profiles')
        .update({ shift_status: 'on_shift', driver_status: 'free' })
        // @ts-ignore
        .eq('id', uid)

      setActiveShift(data)
    } catch (err) {
      console.error(err)
      alert('Lỗi khi bắt đầu ca: ' + (err as Error).message)
    }
    setProcessing(false)
  }

  // ── End shift ──────────────────────────────────────────────────
  async function handleEndConfirm(km: number, photo: Blob | null) {
    if (!uid || !activeShift) return
    setModal(null)
    setProcessing(true)
    try {
      let photoUrl = ''
      if (photo) {
        photoUrl = await uploadPhoto(photo, activeShift.id, false)
      }

      const { error } = await supabase
        .from('driver_shifts')
        .update({
          ended_at: new Date().toISOString(),
          km_out: km,
          status: 'ended',
          ...(photoUrl ? { odometer_photo_out_url: photoUrl } : {}),
        })
        .eq('id', activeShift.id)
      if (error) throw error

      // @ts-ignore
      await supabase.from('profiles')
        .update({ shift_status: 'off_shift', driver_status: 'off_shift' })
        .eq('id', uid)

      setActiveShift(null)
    } catch (err) {
      console.error(err)
      alert('Lỗi khi kết thúc ca: ' + (err as Error).message)
    }
    setProcessing(false)
  }

  if (loading) {
    return <div style={{ padding: 20, color: '#94a3b8', fontFamily: 'Outfit, sans-serif' }}>Đang tải...</div>
  }

  const isOnShift    = !!activeShift
  const isDelivering = (profile as any)?.driver_status === 'delivering'

  return (
    <div style={{ fontFamily: 'Outfit, sans-serif', maxWidth: 600 }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Ca làm việc</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Quản lý thời gian, xem nhật ký trạng thái</p>
      </div>

      {/* Status card */}
      <div style={{
        width: '100%', padding: '24px',
        background: isOnShift
          ? 'linear-gradient(135deg, #0f2847 0%, #0c4a6e 100%)'
          : 'linear-gradient(135deg, #334155 0%, #475569 100%)',
        borderRadius: 20,
        boxShadow: isOnShift ? '0 16px 32px rgba(8,145,178,0.2)' : '0 8px 16px rgba(0,0,0,0.1)',
        color: '#fff', textAlign: 'center', marginBottom: 24,
      }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 16px',
          background: 'rgba(255,255,255,0.12)', borderRadius: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
        }}>
          {isOnShift ? (isDelivering ? '🚚' : '🟢') : '🔴'}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
          {isOnShift ? (isDelivering ? 'Đang giao hàng' : 'Đang rảnh trong ca') : 'Chưa vào ca'}
        </h2>

        {isOnShift && (
          <>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              <Clock size={14} />
              Bắt đầu từ {new Date(activeShift.started_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {elapsed}
            </div>
            {activeShift.km_in != null && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                🛥 Km vào ca: {activeShift.km_in} km
              </div>
            )}
            {/* Odometer photo thumbnail */}
            {activeShift.odometer_photo_in_url && (
              <div style={{ marginTop: 12 }}>
                <img
                  src={activeShift.odometer_photo_in_url}
                  alt="Ảnh đồng hồ vào ca"
                  style={{
                    height: 60, width: 80, objectFit: 'cover',
                    borderRadius: 8, border: '2px solid rgba(255,255,255,0.3)',
                    display: 'inline-block',
                  }}
                />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Ảnh đồng hồ vào ca</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Status log */}
      {isOnShift && activeShift.status_log && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', margin: '0 0 10px', textTransform: 'uppercase' }}>
            Nhật ký trạng thái
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...activeShift.status_log].reverse().map((log: any, idx: number) => {
              const label = log.status === 'free' ? 'Đang rảnh' : log.status === 'delivering' ? 'Đang giao hàng' : 'Kết thúc ca'
              const color = log.status === 'delivering' ? '#7c3aed' : log.status === 'free' ? '#059669' : '#94a3b8'
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color }}>{label}</span>
                  <span style={{ fontSize: 11, color: '#cbd5e1' }}>
                    {new Date(log.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action button */}
      {processing ? (
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          Đang xử lý...
        </div>
      ) : isOnShift ? (
        <button
          onClick={() => setModal('end')}
          style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: '#dc2626', color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
          }}
        >
          <StopCircle size={20} /> Kết thúc ca làm việc
        </button>
      ) : (
        <button
          onClick={() => setModal('start')}
          style={{
            width: '100%', padding: '16px', borderRadius: 14,
            background: '#059669', color: '#fff', border: 'none',
            fontSize: 16, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
          }}
        >
          <PlayCircle size={20} /> Bắt đầu ca làm việc
        </button>
      )}

      {/* Modal */}
      {modal === 'start' && (
        <ShiftModal
          isCheckIn={true}
          onConfirm={handleStartConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'end' && (
        <ShiftModal
          isCheckIn={false}
          previousKm={activeShift?.km_in}
          onConfirm={handleEndConfirm}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
