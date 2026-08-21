/**
 * Writes the Android version from package.json.
 *
 * Two files claiming a version is two files that disagree eventually, and the one
 * that disagrees here is the one users see in the Play Store or F-Droid while the
 * app reports something else in Settings. This project already guards the icons and
 * the vendored fonts against exactly that drift; the version is the same problem.
 *
 * `versionCode` has to be a monotonically increasing integer, so it is derived
 * arithmetically rather than incremented by hand: major·10000 + minor·100 + patch.
 * 0.1.1 becomes 101, 1.2.3 becomes 10203. That holds as long as minor and patch
 * stay under 100, which is checked below rather than assumed.
 *
 * Run: node scripts/sync-android-version.mjs   (CI runs it and rejects any diff)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GRADLE = join(ROOT, 'android', 'app', 'build.gradle')

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
if (match === null) {
  throw new Error(`package.json version "${version}" is not plain major.minor.patch`)
}

const [, major, minor, patch] = match.map(Number)
if (minor > 99 || patch > 99) {
  throw new Error(
    `version ${version} overflows the versionCode scheme: minor and patch must stay under 100`,
  )
}
const versionCode = major * 10000 + minor * 100 + patch

const before = readFileSync(GRADLE, 'utf8')
const after = before
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`)

if (!/versionCode \d+/.test(after) || !/versionName "/.test(after)) {
  throw new Error('Could not find versionCode/versionName in android/app/build.gradle')
}

if (after !== before) {
  writeFileSync(GRADLE, after)
  console.log(`android version -> ${version} (versionCode ${versionCode})`)
} else {
  console.log(`android version already ${version} (versionCode ${versionCode})`)
}
