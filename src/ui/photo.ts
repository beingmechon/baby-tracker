/**
 * Turning a photo a parent picked into something worth storing on a phone.
 *
 * The picker hands over whatever the camera produced: on a modern phone that is
 * routinely a 12-megapixel JPEG of four megabytes or more. Storing those verbatim
 * would fill a browser's storage quota inside a couple of dozen keepsakes, and every
 * one of them would also land in the JSON backup, base64-encoded and a third larger
 * again. A wall of first-smile photos that cannot be exported is not a keepsake.
 *
 * So every photo is decoded, drawn down to a bounded size and re-encoded before it
 * is ever written. Doing that here rather than at display time is the whole point:
 * the cost is paid once, and the bytes on disk are the small ones.
 *
 * All of it happens on the device. There is no upload, no service and no network
 * call — a canvas and an `<img>`, which is also why this file is in `ui/` and not
 * in `domain/`: it needs a DOM.
 */

/**
 * The longest edge a stored photo may have.
 *
 * 1600px is more than a phone screen shows and enough to print a 6×4, which is what
 * a parent would actually do with one. Beyond that is bytes nobody looks at.
 */
export const MAX_PHOTO_EDGE = 1600

/** JPEG quality. 0.82 is where the file stops shrinking much and artefacts stay invisible. */
const QUALITY = 0.82

export interface PreparedPhoto {
  type: string
  /** Base64 without the data-URL prefix, which is what the store holds. */
  data: string
  width: number
  height: number
}

/** The dimensions to draw at: unchanged when already small enough. */
export function scaledSize(
  width: number,
  height: number,
  maxEdge = MAX_PHOTO_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || longest === 0) {
    return { width: Math.round(width), height: Math.round(height) }
  }
  const ratio = maxEdge / longest
  // At least one pixel each way: a panorama scaled by a large ratio can round a
  // short edge to zero, and a zero-width canvas throws.
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      // Revoked as soon as the bitmap is decoded; holding the URL leaks the whole
      // file for the lifetime of the document.
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image'))
    }
    image.src = url
  })
}

/**
 * Decodes, downscales and re-encodes a picked file.
 *
 * Always re-encodes as JPEG, even when the source was already small: it strips
 * every EXIF field in passing, and those fields routinely carry the GPS coordinates
 * of the room the photograph was taken in. This app is not going to keep a
 * geotagged photograph of a child on the off-chance the parent exports it and shares
 * the file. Losing the camera metadata is the point, not a side effect.
 */
export async function preparePhoto(
  file: Blob,
  maxEdge = MAX_PHOTO_EDGE,
): Promise<PreparedPhoto> {
  const image = await loadImage(file)
  const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight, maxEdge)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('This browser cannot process images')
  context.drawImage(image, 0, 0, width, height)

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('This browser cannot process images')

  return {
    type: 'image/jpeg',
    data: dataUrl.slice(comma + 1),
    width,
    height,
  }
}

/** The stored base64 as something an `<img src>` accepts. */
export function photoSource(photo: { type: string; data: string }): string {
  return `data:${photo.type};base64,${photo.data}`
}

/** Roughly how much disk a stored photo takes. Base64 is 4 bytes per 3. */
export function photoBytes(photo: { data: string }): number {
  return Math.round((photo.data.length * 3) / 4)
}
