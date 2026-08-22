/**
 * Checks that the Android shell costs the web build nothing.
 *
 * This exists because the first attempt at splitting the Capacitor bridge did the
 * opposite of what it claimed. Grouping it with `manualChunks` made Rollup treat
 * the chunk as a static dependency of the entry, so the browser *preloaded* an
 * Android bridge it can never execute — and since the service worker had been told
 * to skip it, the app stopped loading offline at all. Both faults were invisible to
 * every existing test: the build succeeded and the bundle report looked smaller.
 *
 * So the property is asserted directly against `dist/`:
 *
 *   1. No Capacitor chunk is a static import of the entry.
 *   2. No Capacitor chunk is preloaded from index.html.
 *   3. No Capacitor chunk is in the service worker precache.
 *   4. The bridge is still actually reachable, so this is not passing by deletion.
 *
 * Run: npm run build && node scripts/check-web-payload.mjs
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

let failures = 0
function check(label, ok) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`)
  if (!ok) failures += 1
}

const assets = readdirSync(join(DIST, 'assets'))
const nativeChunks = assets.filter((name) => /^native-.*\.js$/.test(name))
const entryChunks = assets.filter((name) => /^index-.*\.js$/.test(name))

console.log('\n▸ Web payload')

check(
  `the Android bridge is split into its own chunk (${nativeChunks.length} found)`,
  nativeChunks.length > 0,
)

const entrySource = entryChunks
  .map((name) => readFileSync(join(DIST, 'assets', name), 'utf8'))
  .join('\n')

// A static import reads as `from"./native-x.js"` or `import"./native-x.js"`; a
// dynamic one only ever appears inside the preload helper's dependency table.
check(
  'the entry does not statically import it',
  !/(?:from|import)\s*["']\.\/native-/.test(entrySource),
)

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
check(
  'index.html does not preload it',
  !/modulepreload[^>]*native-/.test(html),
)

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8')
check('the service worker does not precache it', !/native-[\w-]*\.js/.test(sw))

// Guards the other direction: a check that passes because the feature was removed
// is worse than no check. The bridge has to still be in the build and still be
// referenced by the dynamic import's dependency table.
check(
  'but the bridge is still in the build and still reachable',
  nativeChunks.length > 0 && /native-[\w-]*\.js/.test(entrySource),
)

// Everything the web app needs must be precached, or the offline promise breaks —
// which is exactly how the bad split was caught.
const precachedEntries = [...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1])
check(
  `every entry chunk is precached (${precachedEntries.length} entries)`,
  entryChunks.every((name) => precachedEntries.includes(`assets/${name}`)),
)

console.log(
  failures === 0
    ? '\n✓ The shell costs the web build nothing.\n'
    : `\n✗ ${failures} web-payload check(s) failed.\n`,
)

process.exit(failures === 0 ? 0 : 1)
