/**
 * imageCompressor.ts
 * Compresses an image File to a JPEG Blob under a target size (default 50 KB).
 * Uses HTML Canvas + iterative quality reduction — no external dependencies.
 */

const TARGET_KB = 50          // target max file size in KB
const MAX_W     = 1024        // max width before downscaling

export async function compressImage(
  file: File,
  targetKb = TARGET_KB,
): Promise<Blob> {
  const targetBytes = targetKb * 1024

  // Load the file into an image element
  const imgEl = await loadImage(file)

  // Scale down so longest side ≤ MAX_W
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

  // Iteratively lower quality until size is under target
  let quality = 0.85
  let blob    = await canvasToBlob(canvas, quality)

  while (blob.size > targetBytes && quality > 0.05) {
    quality = Math.max(quality - 0.1, 0.05)
    blob    = await canvasToBlob(canvas, quality)
  }

  // If still above target, halve dimensions once more and retry
  if (blob.size > targetBytes) {
    canvas.width  = Math.round(width  / 2)
    canvas.height = Math.round(height / 2)
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)
    blob = await canvasToBlob(canvas, 0.5)
  }

  return blob
}

// ── Helpers ────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
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
