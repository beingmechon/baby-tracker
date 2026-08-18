/**
 * Regenerates `src/domain/growth/whoReference.ts` from the WHO Child Growth
 * Standards spreadsheets.
 *
 * The generated file is committed, so nobody needs to run this to build the app.
 * It exists so the numbers are *reproducible and auditable* rather than a table
 * someone typed in once: a reviewer can re-run it against the WHO originals and
 * diff the result.
 *
 * The WHO publishes these as .xlsx at
 * https://www.who.int/tools/child-growth-standards/standards — download the
 * "expanded tables" z-score files and point this script at the folder:
 *
 *   node scripts/extract-who-reference.mjs <folder-with-who-xlsx-files>
 *
 * Requires no dependencies: .xlsx is a zip of XML, and the sheets here are a
 * plain numeric grid, so a small reader beats pulling in a spreadsheet library.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE_DIR = process.argv[2]
if (!SOURCE_DIR) {
  console.error('usage: node scripts/extract-who-reference.mjs <folder-with-who-xlsx>')
  process.exit(1)
}

/**
 * The four tables we ship. Head circumference is deliberately absent: the WHO
 * publishes it, but it was not in the source set this was generated from, and
 * inventing reference numbers for a measurement parents show to doctors is not
 * something this project will do. See docs/ROADMAP.md.
 */
const TABLES = [
  { file: 'wfa_boys_0-to-5-years_zscores.xlsx', measure: 'weight', sex: 'male', maxMonth: 60 },
  { file: 'wfa_girls_0-to-5-years_zscores.xlsx', measure: 'weight', sex: 'female', maxMonth: 60 },
  { file: 'lhfa_boys_0-to-2-years_zscores.xlsx', measure: 'length', sex: 'male', maxMonth: 24 },
  { file: 'lhfa_girls_0-to-2-years_zscores.xlsx', measure: 'length', sex: 'female', maxMonth: 24 },
]

/** Reads one sheet out of an .xlsx as a grid of raw cell strings. */
function readSheet(path) {
  // `unzip -p` avoids implementing inflate; every platform CI runs on has it.
  const xml = execFileSync('unzip', ['-p', path, 'xl/worksheets/sheet1.xml'], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
  })

  const rows = []
  for (const rowXml of xml.split(/<row[ >]/).slice(1)) {
    const cells = []
    for (const cellXml of rowXml.split(/<c[ >]/).slice(1)) {
      const attrs = cellXml.slice(0, Math.max(0, cellXml.indexOf('>')))
      const value = /<v>([^<]*)<\/v>/.exec(cellXml)
      if (value === null) {
        cells.push('')
        continue
      }
      // A cell carrying t="s" holds an *index into the shared-string table*, not
      // a number. Without this check the header row ("Month", "L", "M", "S")
      // parses as the perfectly finite numbers 0,1,2,3 and silently becomes a
      // data row — which is how this first produced 62 rows instead of 61.
      const isString = /\bt="(s|inlineStr|str)"/.test(attrs)
      cells.push(isString ? '' : value[1])
    }
    rows.push(cells)
  }
  return rows
}

const output = {}

for (const { file, measure, sex, maxMonth } of TABLES) {
  const path = join(SOURCE_DIR, file)
  if (!existsSync(path)) {
    console.error(`missing: ${path}`)
    process.exit(1)
  }

  const rows = readSheet(path)
  const points = []
  for (const cells of rows) {
    // Blank cells must become NaN, not 0: `Number('')` is 0, so mapping the
    // blanked-out header row straight through Number() made it look like a
    // legitimate month-0 data row.
    const [month, l, m, s] = cells.map((cell) => (cell === '' ? NaN : Number(cell)))
    // Skip the header row and anything past the range we ship.
    if (!Number.isFinite(month) || !Number.isFinite(l) || !Number.isFinite(m)) continue
    if (!Number.isFinite(s) || month > maxMonth) continue
    points.push([month, l, m, s])
  }

  if (points.length !== maxMonth + 1) {
    console.error(
      `${file}: expected ${maxMonth + 1} monthly rows, parsed ${points.length}`,
    )
    process.exit(1)
  }

  output[measure] ??= {}
  output[measure][sex] = points
  console.log(`${file.padEnd(38)} ${points.length} rows`)
}

function serialize(points) {
  return points.map(([mo, l, m, s]) => `    [${mo}, ${l}, ${m}, ${s}],`).join('\n')
}

const banner = `/**
 * WHO Child Growth Standards — LMS reference parameters.
 *
 * GENERATED FILE. Do not edit by hand.
 *   Regenerate: node scripts/extract-who-reference.mjs <folder-with-who-xlsx>
 *
 * Source: World Health Organization, Child Growth Standards, expanded z-score
 * tables — https://www.who.int/tools/child-growth-standards/standards
 * Files: ${TABLES.map((t) => t.file).join(', ')}
 *
 * Each row is [ageInMonths, L, M, S]. Those three parameters describe a skewed
 * distribution per age (Box-Cox power, median, coefficient of variation), from
 * which a z-score and percentile are derived — see zscore.ts.
 *
 * Weight-for-age covers 0–60 months. Length-for-age covers 0–24 months, which is
 * recumbent length; standing height (2–5y) is a separate WHO standard and is not
 * shipped yet. Head circumference is not shipped at all: see docs/ROADMAP.md
 * rather than assuming it was forgotten.
 *
 * The WHO makes these tables freely available. They describe populations, not
 * your baby — see docs/MEDICAL_DISCLAIMER.md.
 */

export type LmsPoint = readonly [ageMonths: number, l: number, m: number, s: number]

`

const body = `export const WHO_WEIGHT_FOR_AGE: Record<'male' | 'female', readonly LmsPoint[]> = {
  male: [
${serialize(output.weight.male)}
  ],
  female: [
${serialize(output.weight.female)}
  ],
}

export const WHO_LENGTH_FOR_AGE: Record<'male' | 'female', readonly LmsPoint[]> = {
  male: [
${serialize(output.length.male)}
  ],
  female: [
${serialize(output.length.female)}
  ],
}
`

const target = 'src/domain/growth/whoReference.ts'
writeFileSync(target, banner + body)
console.log(`\nwrote ${target} (${(readFileSync(target).length / 1024).toFixed(1)} KB)`)
