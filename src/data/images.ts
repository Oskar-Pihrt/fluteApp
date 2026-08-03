/**
 * Image intake for uploaded sheet music.
 *
 * Phone cameras produce 8–12 MP JPEGs. Storing those untouched makes the
 * library grid slow and eats the IndexedDB quota, so every import is capped on
 * the long edge and given a small thumbnail.
 */

const MAX_LONG_EDGE = 2000
const THUMBNAIL_LONG_EDGE = 320
const JPEG_QUALITY = 0.85

export interface PreparedImage {
  image: Blob
  thumbnail: Blob
  width: number
  height: number
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    // Honours EXIF orientation, which phone photos rely on.
    return createImageBitmap(file, { imageOrientation: 'from-image' })
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = url
    })
  } finally {
    // Revoking immediately is safe: decoding has already finished.
    URL.revokeObjectURL(url)
  }
}

function scaleToFit(width: number, height: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function render(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode that image.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file)
  const naturalWidth = 'width' in bitmap ? bitmap.width : 0
  const naturalHeight = 'height' in bitmap ? bitmap.height : 0

  const full = scaleToFit(naturalWidth, naturalHeight, MAX_LONG_EDGE)
  const small = scaleToFit(naturalWidth, naturalHeight, THUMBNAIL_LONG_EDGE)

  const [image, thumbnail] = await Promise.all([
    render(bitmap, full.width, full.height),
    render(bitmap, small.width, small.height),
  ])

  if ('close' in bitmap) bitmap.close()

  return { image, thumbnail, width: full.width, height: full.height }
}

/**
 * Object URLs for Blobs, revoked on unmount by the caller. Kept here so the
 * views don't each reinvent the lifecycle.
 */
export function createBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

export function revokeBlobUrl(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url)
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // Chunked to stay clear of the argument-count limit on large images.
  const CHUNK = 0x8000
  for (let i = 0; i < buffer.length; i += CHUNK) {
    binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, type = 'image/jpeg'): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}
