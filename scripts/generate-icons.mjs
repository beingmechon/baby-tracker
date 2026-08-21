/**
 * Generates the PWA icon PNGs from a single vector definition.
 *
 * Writes PNGs by hand (zlib + CRC32) rather than pulling in an image library:
 * the icon is a crescent moon over a flat background, which is a handful of
 * circle tests per pixel, and it keeps `npm install` free of native builds.
 *
 * Run: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')

const BACKGROUND = [27, 42, 74] // #1b2a4a — the manifest theme colour
const MOON = [246, 231, 200] // #f6e7c8 — warm cream, never pure white

/** CRC32, as PNG chunks require. */
function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBytes, data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

/** Encodes raw RGBA rows as a PNG. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  header[10] = 0 // deflate
  header[11] = 0 // adaptive filtering
  header[12] = 0 // no interlace

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * Coverage of a disc at a pixel, sampled on a 3x3 grid so the curve has a soft
 * edge instead of a staircase.
 */
function discCoverage(px, py, cx, cy, radius) {
  let hits = 0
  for (let sy = 0; sy < 3; sy += 1) {
    for (let sx = 0; sx < 3; sx += 1) {
      const x = px + (sx + 0.5) / 3
      const y = py + (sy + 0.5) / 3
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) hits += 1
    }
  }
  return hits / 9
}

function mix(base, top, alpha) {
  return [
    Math.round(base[0] + (top[0] - base[0]) * alpha),
    Math.round(base[1] + (top[1] - base[1]) * alpha),
    Math.round(base[2] + (top[2] - base[2]) * alpha),
  ]
}

/**
 * @param size    pixel dimensions
 * @param inset   fraction of the canvas kept clear around the glyph. Maskable
 *                icons are cropped to a circle by Android, so their glyph has
 *                to sit inside the safe zone.
 */
function renderIcon(size, inset) {
  const rgba = Buffer.alloc(size * size * 4)

  const glyph = size * (1 - inset * 2)
  const cx = size / 2
  const cy = size / 2
  // A crescent is a disc with a second, offset disc subtracted from it.
  const outerR = glyph * 0.42
  const cutR = glyph * 0.36
  const cutX = cx + glyph * 0.17
  const cutY = cy - glyph * 0.12
  // One small star, offset from the crescent's opening.
  const starR = glyph * 0.045
  const starX = cx + glyph * 0.28
  const starY = cy + glyph * 0.26

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const outer = discCoverage(x, y, cx, cy, outerR)
      const cut = discCoverage(x, y, cutX, cutY, cutR)
      const star = discCoverage(x, y, starX, starY, starR)
      // Subtract the cut from the disc, then add the star back on top.
      const alpha = Math.min(1, Math.max(0, outer - cut) + star)

      const [r, g, b] = mix(BACKGROUND, MOON, alpha)
      const offset = (y * size + x) * 4
      rgba[offset] = r
      rgba[offset + 1] = g
      rgba[offset + 2] = b
      rgba[offset + 3] = 255
    }
  }

  return encodePng(size, size, rgba)
}

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="#1b2a4a"/>
  <path d="M40.5 39.5A15 15 0 0 1 25 20a15 15 0 1 0 15.5 19.5Z" fill="#f6e7c8"/>
  <circle cx="43" cy="43" r="2.6" fill="#f6e7c8"/>
</svg>
`

mkdirSync(join(PUBLIC, 'icons'), { recursive: true })

writeFileSync(join(PUBLIC, 'favicon.svg'), SVG)
writeFileSync(join(PUBLIC, 'icons', 'icon-192.png'), renderIcon(192, 0.16))
writeFileSync(join(PUBLIC, 'icons', 'icon-512.png'), renderIcon(512, 0.16))
// Maskable icons lose their outer ~20% to whatever mask the launcher applies.
writeFileSync(join(PUBLIC, 'icons', 'icon-maskable-512.png'), renderIcon(512, 0.26))
writeFileSync(join(PUBLIC, 'apple-touch-icon.png'), renderIcon(180, 0.16))

/*
 * The Android launcher icons, from the same crescent.
 *
 * Capacitor scaffolds its own logo into these files, and an app that ships the
 * framework's logo in the launcher and in the F-Droid listing is an app that looks
 * like nobody finished it. Generating them here rather than hand-exporting means
 * there is one definition of the icon and it cannot drift.
 *
 * Densities are the standard mdpi..xxxhdpi ladder: 48dp rendered at 1x, 1.5x, 2x,
 * 3x and 4x. `ic_launcher_round` is the same bitmap — the launcher applies the
 * circular mask, so a separately-drawn round variant would only be a second thing
 * to keep in step.
 */
const ANDROID_RES = join(ROOT, 'android', 'app', 'src', 'main', 'res')
const DENSITIES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]

if (existsSync(ANDROID_RES)) {
  for (const [density, size] of DENSITIES) {
    const dir = join(ANDROID_RES, `mipmap-${density}`)
    mkdirSync(dir, { recursive: true })
    // The legacy square icon keeps the tighter inset; the adaptive foreground
    // below is what Android 8 and later actually shows.
    const icon = renderIcon(size, 0.16)
    writeFileSync(join(dir, 'ic_launcher.png'), icon)
    writeFileSync(join(dir, 'ic_launcher_round.png'), icon)
    // An adaptive icon's foreground is 108dp for a 72dp visible area, so the glyph
    // needs the wider safe inset or the launcher's mask clips it.
    writeFileSync(
      join(dir, 'ic_launcher_foreground.png'),
      renderIcon(Math.round(size * 2.25), 0.32),
    )
  }
  console.log('Wrote android mipmap-*/ic_launcher*.png')
}

console.log('Wrote favicon.svg, apple-touch-icon.png and icons/*.png')
