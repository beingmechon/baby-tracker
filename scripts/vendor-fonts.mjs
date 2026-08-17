/**
 * Copies the exact font files the app ships out of node_modules and into
 * `src/styles/fonts/`.
 *
 * Why vendor rather than import the @fontsource CSS: those stylesheets declare
 * every unicode subset (latin, latin-ext, cyrillic…) as separate @font-face
 * rules. The browser only downloads what it needs, but this app *precaches
 * everything* for offline use, so importing them would bake several hundred
 * kilobytes of unused subsets into the service worker.
 *
 * Vendoring makes the offline payload exactly auditable: what is in this folder
 * is what a parent downloads, once, and then never again.
 *
 * Run: node scripts/vendor-fonts.mjs
 */

import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEST = join(ROOT, 'src', 'styles', 'fonts')

/**
 * `wght` is the weight-only variable cut. The `opsz` cuts roughly double the
 * bytes, which is not worth it for an app whose whole promise is opening
 * instantly offline on a cheap phone.
 *
 * Literata rather than Fraunces for the numerals, for two measured reasons:
 * Fraunces ships no `tnum` feature at all, so `font-variant-numeric:
 * tabular-nums` silently does nothing and a running stopwatch visibly jitters
 * as it ticks; and the AI-tell detector lists Fraunces among fonts that have
 * converged into defaults. See docs/DESIGN.md § Type.
 *
 * `latin` only, deliberately: latin-ext lands with i18n (see docs/ROADMAP.md).
 * Names using glyphs outside latin fall back to the system serif or sans, which
 * degrades legibly rather than showing tofu.
 */
const FONTS = [
  {
    from: '@fontsource-variable/literata/files/literata-latin-wght-normal.woff2',
    to: 'literata-latin-wght-normal.woff2',
  },
  {
    from: '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2',
    to: 'archivo-latin-wght-normal.woff2',
  },
]

mkdirSync(DEST, { recursive: true })

let total = 0
for (const font of FONTS) {
  const source = join(ROOT, 'node_modules', font.from)
  const target = join(DEST, font.to)
  copyFileSync(source, target)
  const { size } = statSync(target)
  total += size
  console.log(`${font.to.padEnd(38)} ${(size / 1024).toFixed(1)} KB`)
}
console.log(`${'total'.padEnd(38)} ${(total / 1024).toFixed(1)} KB`)
