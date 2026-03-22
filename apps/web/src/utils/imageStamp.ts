/**
 * imageStamp.ts
 * Thêm stamp thông tin (timestamp, watermark, metadata) lên ảnh qua HTML5 Canvas.
 * Sau khi stamp, chuyển sang nén JPEG với imageCompressor.
 */

export interface StampOptions {
  /** Dòng chữ chính màu trắng đậm (VD: mã đơn hàng, loại sự cố) */
  title?: string
  /** Nhãn phụ màu vàng (VD: tên địa điểm) */
  subtitle?: string
  /** Watermark góc trên phải (VD: "ADC Delivery") */
  watermark?: string
  /** Timestamp — nếu undefined sẽ dùng thời gian hiện tại */
  capturedAt?: Date
}

/**
 * Vẽ stamp lên ảnh:
 * - Gradient strip đen mờ phía dưới
 * - Top-right watermark mờ
 * - Timestamp màu vàng
 * - Title và subtitle
 *
 * @returns Canvas blob (JPEG) chưa nén — gọi compressImage() sau đó
 */
export async function stampImage(
  file: File | Blob,
  options: StampOptions = {},
): Promise<Blob> {
  const {
    title,
    subtitle,
    watermark = 'ADC Delivery',
    capturedAt = new Date(),
  } = options

  // 1. Load ảnh vào element
  const imgEl = await loadImage(file)
  const { width: W, height: H } = imgEl

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 2. Vẽ ảnh gốc
  ctx.drawImage(imgEl, 0, 0, W, H)

  const scale  = W / 1080  // baseline 1080px
  const stripH = 160 * scale
  const pad    = 18 * scale

  // 3. Gradient strip phía dưới
  const grad = ctx.createLinearGradient(0, H - stripH, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = grad
  ctx.fillRect(0, H - stripH, W, stripH)

  // 4. Watermark góc trên phải
  ctx.save()
  ctx.font = `${Math.round(18 * scale)}px Outfit, system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.textAlign = 'right'
  ctx.fillText(watermark, W - pad, 26 * scale)
  ctx.restore()

  // 5. Timestamp (màu vàng)
  const ts = capturedAt
  const timeStr = formatVN(ts)
  const baseY = H - stripH + pad

  ctx.font      = `${Math.round(22 * scale)}px Outfit, system-ui, sans-serif`
  ctx.fillStyle = '#FFD700'
  ctx.textAlign = 'left'
  ctx.fillText(`🕐 ${timeStr}`, pad, baseY + 24 * scale)

  // 6. Title chính (trắng đậm)
  if (title) {
    ctx.font      = `bold ${Math.round(28 * scale)}px Outfit, system-ui, sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(truncate(title, 30), pad, baseY + 56 * scale)
  }

  // 7. Subtitle phụ (trắng mờ)
  if (subtitle) {
    ctx.font      = `${Math.round(18 * scale)}px Outfit, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText(`📍 ${truncate(subtitle, 40)}`, pad, baseY + 88 * scale)
  }

  return canvasToBlob(canvas, 0.92)
}

// ── Helpers ──────────────────────────────────────────────────────

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = reject
    img.src     = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      quality,
    )
  })
}

/** dd/mm/yyyy HH:MM:SS */
function formatVN(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}
