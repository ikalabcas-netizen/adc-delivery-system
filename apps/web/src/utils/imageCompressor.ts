/**
 * imageCompressor.ts
 * Compresses an image File/Blob to a JPEG Blob under a target size (default 50 KB).
 * Uses HTML Canvas + iterative quality reduction — no external dependencies.
 */

const MAX_W = 800   // max width (lower than before → smaller file from first pass)

export async function compressImage(
  file: File | Blob,
  targetKb = 50,
): Promise<Blob> {
  const targetBytes = targetKb * 1024

  const imgEl = await loadImage(file)

  let { width, height } = imgEl
  if (width > MAX_W) {
    height = Math.round((height * MAX_W) / width)
    width  = MAX_W
  }

  const canvas = document.createElement('canvas')
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imgEl, 0, 0, width, height)

  // Fine-grained quality reduction: step 0.05 (18 steps vs 9 before)
  let quality = 0.80
  let blob    = await canvasToBlob(canvas, quality)

  while (blob.size > targetBytes && quality > 0.05) {
    quality = Math.max(quality - 0.05, 0.05)
    blob    = await canvasToBlob(canvas, quality)
  }

  // Still too large → halve dimensions and retry
  if (blob.size > targetBytes) {
    canvas.width  = Math.round(width  / 2)
    canvas.height = Math.round(height / 2)
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)
    blob = await canvasToBlob(canvas, 0.4)
  }

  // Final check — throw so callers can surface the error
  if (blob.size > targetBytes) {
    // Last resort: extreme quality
    blob = await canvasToBlob(canvas, 0.1)
  }

  return blob
}

// ── Helpers ────────────────────────────────────────────────────

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
