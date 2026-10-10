// Photos for scanning, made small before they leave the phone: a 12-megapixel photo is several MB, but Claude reads a
// label just as well at 1,024 px, and a ~200 KB upload is quick on gym or store signal.

const MAX_SIDE = 1024

/** The size to draw a `width` × `height` image at so its longest side is at most `max` (never enlarged). */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** The photo as a JPEG at most 1,024 px on its longest side, upright (the phone's rotation applied). */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const size = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare that photo. Try another."))), 'image/jpeg', 0.85),
  )
}

const CONSENT_KEY = 'forge.scanConsent'

/** Whether you've agreed to photos going to Anthropic's Claude to be read (asked once, before the first scan). */
export function hasScanConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false // storage blocked: ask each time
  }
}

export function giveScanConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {
    // storage blocked: it counts for this photo
  }
}
