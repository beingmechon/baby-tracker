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
// Default to the gitignored scratch directory: a routine verification run must not
// dirty the working tree. `npm run screenshots` opts in to refreshing the committed
// README images, and CI sets SHOT_DIR to a temp path.
const SHOTS = process.env.SHOT_DIR ?? join(process.cwd(), 'screenshots')

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
  // The handover screen reads the clipboard back to prove it wrote what was on
  // screen. Without the permission, Chromium blocks `readText()` forever waiting
  // on a prompt that never appears in a headless run.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })

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

  console.log('\n▸ Growth')
  // Percentiles need a sex to pick the right WHO reference; the app hides them
  // rather than guessing, so set it first and check the guard both ways.
  await page.getByRole('button', { name: 'Settings' }).click()
  const growthSettings = page.locator('.settings-group').first()
  await growthSettings.getByRole('button', { name: 'Girl' }).click()
  await page.getByRole('button', { name: 'Save details' }).click()
  await page.getByText('Details saved.').waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Log a measurement' }).click()
  const growthSheet = page.locator('.sheet')
  await growthSheet.getByLabel('Value (kg)').fill('5.6')
  await growthSheet.getByRole('button', { name: 'Save measurement' }).click()
  await page.getByText('Measurement saved').waitFor()
  check(
    'a weight reaches the timeline in the parent\u2019s own units',
    await page
      .locator('.timeline-row', { hasText: 'Weight' })
      .locator('text=5.6 kg')
      .isVisible(),
  )
  check(
    'the home ledger shows the latest weight',
    (await page
      .locator('.ledger-row', { hasText: 'Weight' })
      .locator('.ledger-value')
      .innerText()) === '5.6 kg',
  )

  // The end-to-end unit path: stored canonically in grams, read back in pounds.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Imperial' }).click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  const imperialWeight = await page
    .locator('.ledger-row', { hasText: 'Weight' })
    .locator('.ledger-value')
    .innerText()
  check(
    `the same weight reads in pounds and ounces (${imperialWeight})`,
    /^\d+ lb \d+ oz$/.test(imperialWeight),
  )
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Metric' }).click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()

  await page.getByRole('button', { name: 'Growth', exact: true }).click()
  await page.locator('.growth-headline').waitFor()
  check(
    'the growth screen leads with the measurement',
    (await page.locator('.growth-headline').innerText()) === '5.6 kg',
  )
  const percentile = await page
    .locator('.ledger-row', { hasText: 'Percentile' })
    .locator('.ledger-note')
    .innerText()
  check(
    `a WHO percentile is computed for the baby\u2019s age (${percentile})`,
    /(\d+(st|nd|rd|th) percentile for age|below the 1st|above the 99th)/.test(percentile),
  )
  check(
    'the chart draws the reference curves and the baby\u2019s own line',
    (await page.locator('.chart-reference').count()) === 3 &&
      (await page.locator('.chart-series').count()) === 1,
  )
  check(
    'the chart is labelled for a screen reader',
    /percentile curves/.test(
      (await page.locator('.chart-svg').getAttribute('aria-label')) ?? '',
    ),
  )

  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'growth.png') })

  // Head circumference ships no WHO reference. The app must say so rather than
  // invent a curve behind a number a parent shows to a doctor.
  await page.getByRole('button', { name: 'Head', exact: true }).click()
  await page.getByRole('button', { name: 'Log a measurement' }).click()
  await page.locator('.sheet').getByLabel('Value (cm)').fill('39')
  await page.locator('.sheet').getByRole('button', { name: 'Save measurement' }).click()
  await page.locator('.growth-headline').waitFor()
  check(
    'head circumference is tracked without a percentile',
    (await page.locator('.growth-headline').innerText()) === '39 cm' &&
      (await page.locator('.chart-reference').count()) === 0,
  )
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

  console.log('\n▸ Reminders')
  // The empty state on the home screen leads to the reminders screen rather than
  // opening a sheet in place, so this is two taps by design.
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  const reminderSheet = page.locator('.sheet')
  await reminderSheet
    .getByLabel('Remind me about')
    .selectOption({ label: 'Something else' })
  await reminderSheet.getByLabel('Name').fill('Vitamin D drops')
  await reminderSheet.getByLabel('Every').selectOption({ label: '24h' })
  await reminderSheet.getByRole('button', { name: 'Save reminder' }).click()
  await page.getByText('Reminder saved').waitFor()

  const vitaminRow = page.locator('.reminder-row', { hasText: 'Vitamin D drops' })
  check('a custom reminder is listed under its own name', await vitaminRow.isVisible())
  check(
    'it counts down rather than claiming to be due',
    /^in /.test(await vitaminRow.locator('.reminder-state').innerText()),
  )
  check(
    'Snooze and Done stay off a reminder that is not due',
    (await vitaminRow.getByRole('button', { name: 'Snooze' }).count()) === 0,
  )

  // The shortest interval the picker offers is 30 minutes, on purpose — a
  // reminder that fires every minute is a way of breaking someone's phone. So the
  // due, snooze and Done transitions belong to the unit tests, which own the
  // clock; likewise the anchoring, which cannot be told apart from a
  // count-from-creation reminder when the last feed was seconds ago. What the
  // browser proves is the rest: that a reminder saves, renders on both screens,
  // survives a restart, and can be turned off.
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  await reminderSheet.getByLabel('Every').selectOption({ label: '3h' })
  await reminderSheet.getByRole('button', { name: 'Save reminder' }).click()
  await page.getByText('Reminder saved').waitFor()
  const feedRow = page.locator('.reminder-row', { hasText: 'Next feed' })
  check(
    'a reminder of a built-in kind is named for its kind',
    await feedRow.isVisible(),
  )
  check(
    'it shows both the countdown and the interval it repeats on',
    /^in .+ · every 3h$/.test(await feedRow.locator('.reminder-state').innerText()),
  )

  // A plain click, not uncheck(): the toggle writes to storage and re-reads,
  // which is this app's deliberate no-optimistic-updates rule, and Playwright's
  // uncheck() retries the click when the state has not flipped yet — double
  // toggling it straight back.
  await feedRow.getByRole('checkbox').click()
  await feedRow.locator('.reminder-state').filter({ hasText: 'Off' }).waitFor()
  check(
    'turning a reminder off says so plainly',
    (await feedRow.getAttribute('data-state')) === 'off',
  )
  await feedRow.getByRole('checkbox').click()
  await feedRow.locator('.reminder-state').filter({ hasText: /^in / }).waitFor()
  check(
    'and turning it back on resumes the countdown',
    (await feedRow.getAttribute('data-state')) === 'upcoming',
  )

  await vitaminRow.getByRole('button', { name: /Vitamin D drops/ }).click()
  await reminderSheet.getByLabel('Every').selectOption({ label: '12h' })
  await reminderSheet.getByRole('button', { name: 'Save reminder' }).click()
  await page.getByText('Reminder saved').waitFor()
  // Wait for the row to catch up rather than sampling it. Every write here goes
  // to storage and is read back before the UI changes, so there is a real gap
  // between the toast and the row — sampling it made this check flake once.
  await vitaminRow
    .locator('.reminder-state')
    .filter({ hasText: 'every 12h' })
    .waitFor({ timeout: 5000 })
    .catch(() => {})
  const editedState = await vitaminRow.locator('.reminder-state').innerText()
  check(
    `editing a reminder keeps its name and changes its interval (${editedState})`,
    editedState.includes('every 12h'),
  )

  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'reminders.png'), fullPage: true })

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()
  check(
    'reminders appear on the home screen as well',
    await page.locator('.reminder-row', { hasText: 'Vitamin D drops' }).isVisible(),
  )
  check(
    'the home screen does not offer a checkbox that could be hit by accident',
    (await page.locator('.reminder-row').first().getByRole('checkbox').count()) === 0,
  )

  console.log('\n▸ Temperature and medication')
  await page.getByRole('button', { name: 'Health' }).first().click()
  await page.getByRole('button', { name: 'Log temperature' }).click()
  const tempSheet = page.locator('.sheet')
  await tempSheet.getByLabel(/Reading/).fill('37.2')
  await tempSheet.getByRole('button', { name: 'Save reading' }).click()
  await page.getByText('Reading saved').waitFor()
  check(
    'a normal reading is reported without alarm',
    (await page.locator('.health-headline').innerText()) === '37.2 °C' &&
      (await page.locator('.health-band').getAttribute('data-band')) === 'normal',
  )

  // 38 °C is the figure nearly every health service names, and the baby in this
  // suite was born recently enough that the under-three-months note applies.
  await page.getByRole('button', { name: 'Log temperature' }).click()
  await tempSheet.getByLabel(/Reading/).fill('38.4')
  await tempSheet.getByRole('button', { name: 'Save reading' }).click()
  await page.getByText('Reading saved').waitFor()
  check(
    'a raised reading is compared with the published threshold, not diagnosed',
    /at or above the 38.0 °C most guidance calls a fever/.test(
      await page.locator('.health-band').innerText(),
    ),
  )
  check(
    'and a young baby gets the note every health service singles out',
    await page.getByText(/under three months/).isVisible(),
  )

  await page.getByRole('button', { name: 'Log temperature' }).click()
  await tempSheet.getByLabel(/Reading/).fill('12')
  await tempSheet.getByRole('button', { name: 'Save reading' }).click()
  check(
    'a reading no thermometer could give is refused',
    await page.getByText(/thermometer could give/).isVisible(),
  )
  await tempSheet.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Log a dose' }).click()
  const medSheet = page.locator('.sheet')
  await medSheet.getByLabel('What did you give?').fill('Paracetamol')
  await medSheet.getByLabel('Dose').fill('2.5 ml')
  await medSheet.getByRole('button', { name: 'Save dose' }).click()
  await page.getByText('Dose saved').waitFor()

  // Different spelling of the same bottle: it must group, or "last given" answers
  // the wrong question at the moment it matters most.
  await page.getByRole('button', { name: 'Log a dose' }).click()
  await medSheet.getByLabel('What did you give?').fill('  paracetamol ')
  await medSheet.getByLabel('Dose').fill('5 ml')
  await medSheet.getByRole('button', { name: 'Save dose' }).click()
  await page.getByText('Dose saved').waitFor()

  check(
    'two spellings of one medicine group into a single entry',
    (await page.locator('.reminder-row').count()) === 1,
  )
  const medRow = page.locator('.reminder-row').first()
  const medText = await medRow.innerText()
  check(
    `showing the latest dose and how many were logged (${medText.split('\n')[1] ?? ''})`,
    /5 ml · last given/.test(medText) && /2 doses logged/.test(medText),
  )
  // "last given just now ago" — the interpolated value already ends in "ago", so
  // a template that also says it produces the duplication twice over.
  check('without repeating the word ago', !/ago ago|just now ago/.test(medText))
  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'health.png'), fullPage: true })

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

  console.log('\n▸ Pumping and the milk stash')
  await page.getByRole('button', { name: 'Log pumping' }).click()
  const pumpSheet = page.locator('.sheet')
  await pumpSheet.getByRole('button', { name: 'Start', exact: true }).click()
  await page.waitForTimeout(1200)
  await pumpSheet.getByLabel('Left (ml)').fill('60')
  await pumpSheet.getByLabel('Right (ml)').fill('80')
  check(
    'the session totals both sides',
    (await pumpSheet.getByText(/Total 140 ml/).count()) === 1,
  )
  await pumpSheet.getByRole('button', { name: 'Save session' }).click()
  await page.getByText('Pumping session saved').waitFor()

  const pumpRow = page.locator('.timeline-row', { hasText: 'Pumped' })
  check(
    'the session reaches the timeline with its split, not just a total',
    /140 ml · left 60 ml, right 80 ml/.test(
      await pumpRow.locator('.timeline-detail').innerText(),
    ),
  )

  await page.getByRole('button', { name: 'Milk stash' }).first().click()
  await page.getByRole('button', { name: 'Add milk' }).click()
  const stashSheet = page.locator('.sheet')
  await stashSheet.getByLabel('Amount (ml)').fill('150')
  await stashSheet.getByRole('button', { name: 'Freezer' }).click()
  await stashSheet.getByRole('button', { name: 'Add to stash' }).click()
  await page.getByText(/150 ml added to the stash/).waitFor()

  await page.getByRole('button', { name: 'Add milk' }).click()
  await stashSheet.getByLabel('Amount (ml)').fill('90')
  await stashSheet.getByRole('button', { name: 'Fridge' }).click()
  await stashSheet.getByRole('button', { name: 'Add to stash' }).click()
  await page.getByText(/90 ml added to the stash/).waitFor()

  check(
    'the stash totals each shelf',
    /90 ml in the fridge · 150 ml in the freezer/.test(
      await page.locator('.field-note.num').innerText(),
    ),
  )
  // The ordering is the feature: fridge milk is on a four-day clock and freezer
  // milk on a six-month one, so the fridge bottle comes first even though both
  // were logged moments ago.
  const firstRow = page.locator('.stash-row').first()
  check(
    'the most urgent shelf comes first, not the oldest bag',
    (await firstRow.locator('.stash-meta').innerText()).startsWith('Fridge'),
  )
  check(
    'and freshly stored milk is not flagged',
    (await firstRow.getAttribute('data-state')) === 'fresh',
  )
  // Six months of freezer life rendered as "4319h 59m" before the coarse span
  // format existed. Storage life is measured in days and months, not hours.
  const freezerState = await page
    .locator('.stash-row')
    .nth(1)
    .locator('.stash-state')
    .innerText()
  check(
    `freezer life reads in months, not hours (${freezerState})`,
    /months? left$/.test(freezerState),
  )
  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'stash.png') })

  await firstRow.getByRole('button', { name: 'Use it all' }).click()
  await page.getByText(/90 ml used/).waitFor()
  check(
    'using a container up removes it rather than leaving a zero row',
    (await page.locator('.stash-row').count()) === 1,
  )

  await page.locator('.stash-row').first().getByRole('button', { name: 'Throw away' }).click()
  await page.getByText('Nothing stored.').waitFor()
  check('and throwing the last one away empties the stash', true)

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

  console.log('\n▸ More than one baby')
  // The property that matters: each baby's log is their own. A tracker that
  // showed one twin's feeds under the other would be worse than no tracker.
  const feedRowsForMira = await page.locator('.timeline-row').count()
  await page.getByRole('button', { name: /Mira/ }).click()
  const babySheet = page.locator('.sheet')
  await babySheet.getByRole('button', { name: 'Add a baby' }).click()
  await babySheet.getByLabel('Name').fill('Arun')
  await babySheet.getByLabel('Date of birth').fill('2026-06-20')
  await babySheet.getByRole('button', { name: 'Add', exact: true }).click()
  await page.getByText('Arun added').waitFor()

  check(
    'adding a baby switches to them',
    (await page.locator('.appbar-name').innerText()) === 'Arun',
  )
  check(
    'the new baby starts with an empty timeline',
    (await page.locator('.timeline-row').count()) === 0 && feedRowsForMira > 0,
  )
  check(
    'and with no reminders of their own',
    (await page.locator('.reminder-row').count()) === 0,
  )

  // A measurement logged for the wrong baby would end up on the wrong growth
  // chart, which is the kind of error a parent would carry to a doctor.
  await page.getByRole('button', { name: 'Wet' }).click()
  await page.getByText('Wet diaper logged').waitFor()
  check(
    'logging goes to the baby who is open',
    (await page.locator('.timeline-row').count()) === 1,
  )

  await page.getByRole('button', { name: /Arun/ }).click()
  await babySheet.getByRole('button', { name: /Mira/ }).click()
  await page.getByText(/Now logging for Mira/).waitFor()
  // The toast fires on the switch; the entries arrive a tick later from storage.
  // Waiting for the rows rather than sampling them is the difference between a
  // deterministic check and one that passes on a fast machine.
  await page.locator('.timeline-row').nth(feedRowsForMira - 1).waitFor()
  check(
    'switching back restores that baby’s own entries',
    (await page.locator('.appbar-name').innerText()) === 'Mira' &&
      (await page.locator('.timeline-row').count()) === feedRowsForMira,
  )
  await page.locator('.reminder-row').nth(1).waitFor()
  check(
    'and their reminders',
    (await page.locator('.reminder-row').count()) === 2,
  )

  // The switcher marks who is open rather than relying on position.
  await page.getByRole('button', { name: /Mira/ }).click()
  check(
    'the switcher says which baby is open',
    (await babySheet
      .locator('.baby-row[aria-pressed="true"]')
      .locator('.baby-name')
      .innerText()) === 'Mira',
  )
  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'babies.png') })
  await babySheet.getByRole('button', { name: 'Close' }).click()

  // Deleting a baby takes their entries and leaves the others alone.
  await page.getByRole('button', { name: /Mira/ }).click()
  await babySheet.getByRole('button', { name: /Arun/ }).click()
  await page.getByText(/Now logging for Arun/).waitFor()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Delete this baby' }).click()
  await page.getByRole('button', { name: 'Delete Arun' }).click()
  await page.getByText('Arun deleted').waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()
  check(
    'deleting a baby falls back to the one that remains',
    (await page.locator('.appbar-name').innerText()) === 'Mira' &&
      (await page.locator('.timeline-row').count()) === feedRowsForMira,
  )
  check(
    'and the per-baby delete is hidden once only one baby is left',
    await page.evaluate(() => !document.body.innerText.includes('Delete this baby')),
  )

  console.log('\n▸ Patterns and the day wheel')
  // Give the wheel a real sleep to draw. The timer test leaves a sleep a second and
  // a half long, which is true but invisible, and a chart of it says nothing. The
  // times are computed in the page from its own clock rather than written as
  // literals, so this is always a completed sleep in the recent past whatever hour
  // the suite runs at.
  const backdated = await page.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const fields = (date) => ({
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    })
    return {
      from: fields(new Date(Date.now() - 5 * 60 * 60 * 1000)),
      to: fields(new Date(Date.now() - 2 * 60 * 60 * 1000)),
    }
  })
  await sleepRow.click()
  await sheet.getByLabel('Date', { exact: true }).fill(backdated.from.date)
  await sheet.getByLabel('Time', { exact: true }).fill(backdated.from.time)
  await sheet.getByLabel('Woke — date').fill(backdated.to.date)
  await sheet.getByLabel('Woke — time').fill(backdated.to.time)
  await sheet.getByRole('button', { name: 'Save changes' }).click()
  await page.getByText('Entry updated').waitFor()
  check(
    'a sleep can be given the hours it actually happened',
    /3h/.test(await sleepRow.innerText()),
  )

  await page.getByRole('button', { name: 'The day, round the clock' }).click()
  await page.getByRole('img', { name: /24-hour clock face/ }).waitFor()
  check(
    'the patterns screen opens on the day wheel',
    (await page.locator('.appbar-name').innerText()) === 'Patterns',
  )
  check(
    'it does not claim there is nothing logged, because there is',
    (await page.locator('.empty').count()) === 0,
  )
  check(
    'the wheel draws the day’s sleep as arcs',
    (await page.locator('.wheel-sleep').count()) >= 1,
  )
  const wheelMarks = await page.locator('.wheel-mark').count()
  check(
    `feeds and diapers are marked round the rim (${wheelMarks} marks)`,
    wheelMarks >= 3,
  )
  check(
    'feed and diaper marks carry their own categorical tint, not one colour',
    await page.evaluate(() => {
      const colour = (kind) => {
        const mark = document.querySelector(`.wheel-mark[data-kind="${kind}"]`)
        return mark === null ? null : getComputedStyle(mark).stroke
      }
      const feed = colour('feed')
      const diaper = colour('diaper')
      return feed !== null && diaper !== null && feed !== diaper
    }),
  )
  check('the wheel shows where "now" is on today', await page.locator('.wheel-now').isVisible())
  check(
    'the hour labels orient the face at midnight, 6, 12 and 18',
    (await page.locator('.wheel-hour-label').allTextContents()).join(',') === '0,6,12,18',
  )
  // The ring is drawn as two arcs precisely because a single sweep back to its own
  // start renders nothing; this guards that a full-day sleep is visible at all.
  check(
    'every arc has a path to draw',
    await page.evaluate(() =>
      [...document.querySelectorAll('.wheel-sleep')].every(
        (arc) => (arc.getAttribute('d') ?? '').length > 0,
      ),
    ),
  )

  check(
    'the week reads as seven columns, one per day',
    (await page.locator('.week-bar').count()) === 7,
  )
  check(
    'a day with nothing logged is an empty column rather than a drawn bar',
    await page.evaluate(() => {
      const fills = [...document.querySelectorAll('.week-bar-fill')]
      return fills.some((fill) => fill.getBoundingClientRect().height < 1)
    }),
  )
  check(
    'the week chart carries a text alternative for a screen reader',
    /Daily sleep for the last seven days/.test(
      (await page.locator('.week-bars').getAttribute('aria-label')) ?? '',
    ),
  )
  check(
    'the ring carries the day it encircles, so the hole is not dead space',
    /\d/.test(await page.locator('.wheel-total').textContent()),
  )
  check(
    'and names what the figure is, with the day’s counts under it',
    (await page.locator('.wheel-total-label').allTextContents()).join(' ').includes('asleep'),
  )
  check(
    'the screen says where the figures were worked out',
    await page.getByText(/on this device/).first().isVisible(),
  )

  // The prediction needs three completed wake windows and a daytime clock, so
  // whether it appears depends on the log and the hour. Both branches are
  // asserted rather than one of them being wished for: the maths itself is
  // covered by src/domain/patterns.test.ts, which owns a fixed clock.
  const predicted = await page.locator('.patterns-headline').count()
  if (predicted > 0) {
    check(
      'the prediction leads with a clock time',
      /\d{1,2}[:.]\d{2}/.test(await page.locator('.patterns-headline').innerText()),
    )
    check(
      'and shows its reasoning, not just a number',
      /wake windows/.test(await page.locator('.patterns-detail, .field-note').first().innerText()) ||
        (await page.getByText(/wake windows/).first().isVisible()),
    )
  } else {
    check(
      'with too few wake windows, no prediction is offered at all',
      (await page.locator('.patterns-headline').count()) === 0,
    )
  }

  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'patterns.png'), fullPage: true })

  await page.getByRole('button', { name: 'Previous day' }).click()
  check(
    'stepping back a day drops the "now" hand, which belongs to today only',
    (await page.locator('.wheel-now').count()) === 0,
  )
  check(
    'and the day being shown is named',
    /\d/.test(
      await page.locator('section', { has: page.locator('.wheel') }).locator('.rule-label').innerText(),
    ),
  )
  await page.getByRole('button', { name: 'Next day' }).click()
  check(
    'stepping forward returns to today',
    await page.locator('.wheel-now').isVisible(),
  )
  check(
    'and there is no walking into tomorrow',
    await page.getByRole('button', { name: 'Next day' }).isDisabled(),
  )
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

  console.log('\n▸ Handover')
  await page.getByRole('button', { name: 'What to tell the next person' }).click()
  await page.getByText('Right now').waitFor()
  check(
    'the handover screen opens',
    (await page.locator('.appbar-name').innerText()) === 'Handover',
  )
  check(
    'it leads with what someone in a doorway needs, not with counts',
    // The labels are uppercased in CSS, so innerText comes back shouting.
    /since/i.test(await page.locator('.rule-label').first().innerText()) &&
      /right now/i.test(await page.locator('.rule-label').nth(1).innerText()),
  )
  const rightNow = await page.locator('.handover-facts').first().innerText()
  check(
    `it dates the last feed, sleep and diaper (${rightNow.replace(/\n/g, ' · ')})`,
    /Last fed at \d/.test(rightNow) &&
      /Last diaper at \d/.test(rightNow) &&
      /(Awake since|Asleep since) \d/.test(rightNow),
  )
  const messageText = await page.locator('.handover-text').innerText()
  check(
    'the message is shown, not hidden behind the copy button',
    messageText.startsWith('Mira'),
  )
  check(
    'and it is plain text a person can read out — no markup, no emoji',
    !/[*_#`|]/.test(messageText) && !/\p{Extended_Pictographic}/u.test(messageText),
  )
  check(
    'with no double gap that would read as broken in a chat',
    !/\n\s*\n\s*\n/.test(messageText),
  )

  // Narrowing the window has to change the counts, or the control does nothing.
  const todayText = messageText
  await page.getByRole('button', { name: 'Last 4h' }).click()
  const fourHourText = await page.locator('.handover-text').innerText()
  check('choosing a shorter window rewrites the message', fourHourText !== todayText)
  check(
    'and the screen says which moment it is counting from',
    /Since \d/.test(await page.locator('.page').innerText()),
  )
  await page.getByRole('button', { name: 'Today', exact: true }).click()

  await settle(page)
  await page.screenshot({ path: join(SHOTS, 'handover.png'), fullPage: true })

  await page.getByRole('button', { name: 'Copy as a message' }).click()
  const copyToast = await page.locator('.toast').innerText()
  check(
    `copying reports what actually happened (${copyToast.replace(/\n/g, ' ')})`,
    /Copied|would not let/.test(copyToast),
  )
  check(
    'the clipboard holds exactly what the screen showed',
    // Only assertable when the browser allowed the write; the refusal path is
    // covered by the toast check above.
    !/Copied/.test(copyToast) ||
      (await page.evaluate(() => navigator.clipboard.readText())) ===
        (await page.locator('.handover-text').innerText()),
  )
  check(
    'one medicine is listed under one spelling, however it was typed',
    await page.evaluate(() => {
      const cell = [...document.querySelectorAll('.handover-fact')].find((row) =>
        /given/i.test(row.querySelector('dt')?.textContent ?? ''),
      )
      if (cell === undefined) return false
      const names = [...cell.querySelectorAll('.handover-line')].map(
        (line) => (line.textContent ?? '').split(' ')[0],
      )
      return names.length > 1 && new Set(names).size === 1
    }),
  )
  check(
    'the screen says copying is all that happens',
    await page.getByText(/on your clipboard and nothing else/).isVisible(),
  )
  // What prints is the facts. A dark theme printed as-is is a solid black page.
  await page.emulateMedia({ media: 'print' })
  check(
    'printing drops the app bar and the buttons',
    await page.evaluate(() => {
      const hidden = (selector) => {
        const el = document.querySelector(selector)
        return el === null || getComputedStyle(el).display === 'none'
      }
      return hidden('.appbar') && hidden('.button') && hidden('.segmented')
    }),
  )
  check(
    'and prints black on white whatever the screen theme is',
    await page.evaluate(() => {
      const body = getComputedStyle(document.body)
      return body.backgroundColor === 'rgb(255, 255, 255)' && body.color === 'rgb(0, 0, 0)'
    }),
  )
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

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
  check(
    'so are the reminders',
    (await page.locator('.reminder-row').count()) === 2,
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
