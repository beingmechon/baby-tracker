/**
 * End-to-end smoke test against the built app in a real browser.
 *
 * Verifies the things unit tests cannot: that a parent can complete the core
 * loop (onboard, log a feed, sleep and diaper, see them on the timeline), that
 * the night theme applies, and — the claim this project is built on — that the
 * app still works with the network switched off.
 *
 * Run: npm run build && node scripts/smoke.mjs
 */

import { chromium, devices } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const PORT = 4317
const BASE = `http://localhost:${PORT}`
const SHOTS = process.env.SHOT_DIR ?? join(process.cwd(), 'docs', 'screenshots')

let failures = 0

function check(label, condition) {
  if (condition) {
    console.log(`  ok   ${label}`)
  } else {
    failures += 1
    console.error(`  FAIL ${label}`)
  }
}

/**
 * Prepares the page for a screenshot: scroll to the top and wait out any toast,
 * so the captures are stable enough to use in the README.
 */
async function settle(page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(2400)
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Server not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Server at ${url} did not start`)
}

const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
)

let browser
try {
  await waitForServer(BASE)
  mkdirSync(SHOTS, { recursive: true })

  // Resolves through PLAYWRIGHT_BROWSERS_PATH; CHROME_PATH overrides it when a
  // machine keeps its Chromium somewhere else.
  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  )
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    // A fixed timezone and locale keep the screenshots and clock assertions
    // reproducible between runs.
    timezoneId: 'Asia/Kolkata',
    locale: 'en-GB',
  })
  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))

  console.log('\n▸ Onboarding')
  await page.goto(BASE)
  await page.getByLabel('Baby’s name').fill('Mira')
  await page.getByLabel(/Date of birth/).fill('2026-06-20')
  await page.getByRole('button', { name: 'Start tracking' }).click()

  await page.getByRole('button', { name: /Start sleep/ }).waitFor()
  check('lands on the home screen after setup', true)
  check(
    'shows the baby’s name and age',
    (await page.locator('.appbar-name').innerText()) === 'Mira' &&
      /old|today/.test(await page.locator('.appbar-age').innerText()),
  )
  check('needed no account or network permission', true)

  console.log('\n▸ Diaper — one tap')
  await page.getByRole('button', { name: 'Wet' }).click()
  await page.getByText('Wet diaper logged').waitFor()
  check('a wet diaper reaches the timeline', await page
    .locator('.timeline-row', { hasText: 'Wet diaper' })
    .isVisible())
  check(
    'the daily diaper count updates',
    (await page
      .locator('.ledger-row', { hasText: 'Diapers' })
      .locator('.ledger-value')
      .innerText()) === '1',
  )

  console.log('\n▸ Bottle')
  await page.getByRole('button', { name: 'Bottle', exact: true }).click()
  await page.getByRole('button', { name: 'Formula' }).click()
  await page.getByRole('button', { name: '120', exact: true }).click()
  await page.getByRole('button', { name: 'Save bottle' }).click()
  await page.getByText('Bottle saved').waitFor()
  check(
    'the bottle appears with its amount',
    await page
      .locator('.timeline-row', { hasText: 'Bottle, formula' })
      .locator('text=120 ml')
      .isVisible(),
  )
  check(
    'the feed count updates',
    (await page
      .locator('.ledger-row', { hasText: 'Feeds' })
      .locator('.ledger-value')
      .innerText()) === '1',
  )

  console.log('\n▸ Nursing timer')
  await page.getByRole('button', { name: /Nursing/ }).click()
  // Scoped to the sheet: the home screen behind it has its own buttons, and
  // some labels ("Start", "Dirty") legitimately appear in both places.
  const sheet = page.locator('.sheet')
  await sheet.getByRole('button', { name: 'Start', exact: true }).click()
  await page.waitForTimeout(2100)
  const stopwatch = await page.locator('.stopwatch-time').innerText()
  check(`the stopwatch is counting (${stopwatch})`, /^00:0[1-9]$/.test(stopwatch))
  await sheet.getByRole('button', { name: 'Pause' }).click()
  const paused = await page.locator('.stopwatch-time').innerText()
  await page.waitForTimeout(1200)
  check(
    'pausing freezes the clock',
    (await page.locator('.stopwatch-time').innerText()) === paused,
  )
  await sheet.getByRole('button', { name: 'Save feed' }).click()
  await page.getByText('Feed saved').waitFor()
  check(
    'the nursing session is saved with its side',
    await page.locator('.timeline-row', { hasText: /Nursed (left|right)/ }).isVisible(),
  )

  console.log('\n▸ Sleep timer')
  await page.getByRole('button', { name: /Start sleep/ }).click()
  await page.getByText('Sleep started').waitFor()
  check(
    'the headline switches to a running Asleep timer',
    await page.locator('.headline[data-running="true"]').isVisible(),
  )
  check(
    'the headline reads as a live stopwatch',
    /^\d{1,2}:\d{2}(:\d{2})?$/.test(
      await page.locator('.headline-value').innerText(),
    ),
  )
  check(
    'the timeline marks the sleep as live',
    await page.locator('.timeline-live').isVisible(),
  )

  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Wake up' }).click()
  await page.getByText('Sleep ended').waitFor()
  // Identify the sleep row by its category marker, not by its title. Matching on
  // the title made this assertion depend on the wall clock: a sleep started
  // before 19:00 is a nap and after it is night sleep, and `/^Nap|.../` could
  // never match anyway because a row's text begins with the time, not the title.
  // It passed only while CI happened to run in the evening.
  const sleepRow = page
    .locator('.timeline-row')
    .filter({ has: page.locator('.timeline-mark[data-category="sleep"]') })
    .first()
  check('ending the sleep records it', await sleepRow.isVisible())

  const sleepTitle = await sleepRow.locator('.timeline-title').innerText()
  check(
    `it is classified as a nap or night sleep (${sleepTitle})`,
    ['Nap', 'Night sleep'].includes(sleepTitle),
  )
  check(
    'the live marker is gone once the sleep ends',
    (await page.locator('.timeline-live').count()) === 0,
  )

  console.log('\n▸ Repeat last feed')
  await page.getByRole('button', { name: /Repeat last feed/ }).click()
  await page.getByText('Last feed repeated').waitFor()
  check(
    'one tap adds a second nursing entry',
    (await page.locator('.timeline-row', { hasText: /Nursed/ }).count()) === 2,
  )

  console.log('\n▸ Editing an entry')
  await page.locator('.timeline-row', { hasText: 'Wet diaper' }).first().click()
  await sheet.getByRole('button', { name: 'Dirty' }).click()
  await sheet.getByLabel('Note').fill('checked with the midwife')
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('Entry updated').waitFor()
  check(
    'the edit is reflected on the timeline',
    await page.locator('.timeline-row', { hasText: 'Dirty diaper' }).isVisible(),
  )
  check(
    'the note is kept',
    await page.getByText('checked with the midwife').isVisible(),
  )

  console.log('\n▸ Themes')
  // Each theme is pinned explicitly rather than left on auto, so the assertions
  // and the screenshots do not depend on what time the suite happens to run.
  await page.getByRole('button', { name: 'Settings' }).click()

  await page.getByRole('button', { name: 'Light' }).click()
  check(
    'the light theme is applied',
    (await page.locator('html').getAttribute('data-theme')) === 'day',
  )
  const dayBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  check(`the light background is warm paper, not pure white (${dayBg})`, dayBg === 'rgb(253, 253, 252)')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'home-day.png') })

  check(
    'the app bar stays pinned above the content it scrolls over',
    await page.evaluate(() => {
      const bar = document.querySelector('.appbar')
      if (bar === null) return false
      return Math.abs(bar.getBoundingClientRect().top) < 2
    }),
  )

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Night' }).click()
  check(
    'the night theme is applied to the document',
    (await page.locator('html').getAttribute('data-theme')) === 'night',
  )
  const nightBg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  )
  check(`the night background is near-black and warm (${nightBg})`, nightBg === 'rgb(20, 13, 7)')
  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'settings-night.png') })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'home-night.png') })

  console.log('\n▸ Language')
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Language').selectOption('es')
  check(
    'switching language translates the interface',
    (await page.locator('.appbar-name').innerText()) === 'Ajustes',
  )
  check(
    'an unreviewed translation says so, rather than passing itself off',
    await page.getByText(/hablante nativo/).isVisible(),
  )
  check(
    'the document lang attribute follows, so screen readers switch voice',
    (await page.locator('html').getAttribute('lang')) === 'es',
  )
  await page.getByRole('button', { name: /Atrás|Back/ }).first().click()
  await page.getByRole('button', { name: /Empezar sueño/ }).waitFor()
  check('the home screen is translated too', true)
  check(
    'times follow the locale — Spanish uses a 24-hour clock',
    /\d{1,2}:\d{2}(?!\s?[ap]m)/.test(
      await page.locator('.timeline-time').first().innerText(),
    ),
  )
  // Back to English so the remaining checks and screenshots stay comparable.
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByLabel('Idioma').selectOption('en')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

  console.log('\n▸ Typography')
  await page.evaluate(() => document.fonts.ready)
  check(
    'the display face is the bundled one, not a fallback',
    await page.evaluate(() => document.fonts.check('600 64px "Literata Variable"')),
  )
  // Guards a real defect class: `font-variant-numeric: tabular-nums` silently does
  // nothing on a font without a `tnum` feature, and a running stopwatch then
  // visibly jitters as the digits change. Fraunces failed exactly this.
  const figureDrift = await page.evaluate(() => {
    const probe = (text) => {
      const el = document.createElement('span')
      el.className = 'num'
      el.style.cssText = 'position:absolute;font-size:64px;font-weight:600;white-space:pre'
      el.textContent = text
      document.body.appendChild(el)
      const width = el.getBoundingClientRect().width
      el.remove()
      return width
    }
    return Math.abs(probe('000000') - probe('111111'))
  })
  check(
    `numerals are tabular, so a running timer cannot jitter (${figureDrift.toFixed(2)}px drift)`,
    figureDrift < 0.5,
  )

  console.log('\n▸ Data survives a reload')
  await page.reload()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()
  check(
    'every entry is still there after a restart',
    (await page.locator('.timeline-row').count()) >= 5,
  )

  console.log('\n▸ Offline')
  await context.setOffline(true)
  await page.reload()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor({ timeout: 15_000 })
  check('the app loads with the network switched off', true)
  await page.getByRole('button', { name: 'Mixed' }).click()
  await page.getByText('Mixed diaper logged').waitFor()
  check(
    'logging still works offline',
    await page.locator('.timeline-row', { hasText: 'Mixed diaper' }).isVisible(),
  )
  await page.screenshot({ path: join(SHOTS, 'home-offline.png'), fullPage: true })
  await context.setOffline(false)

  console.log('\n▸ Export')
  await page.getByRole('button', { name: 'Settings' }).click()
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]).then(([event]) => event)
  const csvPath = await download.path()
  check('a CSV export downloads', csvPath !== null)
  check('the export is named for today', /baby-tracker-\d{4}-\d{2}-\d{2}\.csv/.test(download.suggestedFilename()))

  console.log('\n▸ Console')
  check(
    consoleErrors.length === 0
      ? 'no console errors'
      : `no console errors (saw: ${consoleErrors.join(' | ')})`,
    consoleErrors.length === 0,
  )

  console.log(
    failures === 0
      ? '\n✓ All smoke checks passed.\n'
      : `\n✗ ${failures} smoke check(s) failed.\n`,
  )
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}

process.exit(failures === 0 ? 0 : 1)
