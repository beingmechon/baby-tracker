/**
 * Renders the built app in a browser and writes each screen out as a
 * self-contained HTML file, with all CSS inlined.
 *
 * This exists so static analysers — notably the AI-tell detector from
 * ryanthedev/design-for-ai, which reads HTML/CSS as text — can see what the app
 * actually renders. A React SPA's `index.html` is an empty div, so pointing a
 * static tool at the build output tells you nothing.
 *
 * Run: npm run build && node scripts/snapshot.mjs [outDir]
 */

import { chromium, devices } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = 4318
const BASE = `http://localhost:${PORT}`
const OUT = process.argv[2] ?? join(process.cwd(), '.design-audit')

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Server at ${url} did not start`)
}

/**
 * Serialises the live DOM with every stylesheet inlined into one <style>, so the
 * result is analysable — and viewable — on its own.
 */
async function serialize(page) {
  return page.evaluate(() => {
    const css = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n')
        } catch {
          // Cross-origin sheet; there are none in this app, but be safe.
          return ''
        }
      })
      .join('\n')

    const theme = document.documentElement.dataset.theme ?? 'day'
    return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head><meta charset="utf-8"><title>${document.title}</title>
<style>
${css}
</style>
</head>
<body>
${document.body.innerHTML}
</body>
</html>
`
  })
}

const server = spawn(
  'npx',
  ['vite', 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
)

let browser
try {
  await waitForServer(BASE)
  mkdirSync(OUT, { recursive: true })

  browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
  )
  const context = await browser.newContext({
    ...devices['Pixel 5'],
    timezoneId: 'Asia/Kolkata',
    locale: 'en-GB',
  })
  const page = await context.newPage()

  await page.goto(BASE)

  // Onboarding is a screen worth auditing in its own right.
  await page.getByLabel('Baby’s name').waitFor()
  writeFileSync(join(OUT, 'onboarding.html'), await serialize(page))

  await page.getByLabel('Baby’s name').fill('Mira')
  await page.getByLabel(/Date of birth/).fill('2026-06-20')
  await page.getByRole('button', { name: 'Start tracking' }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()

  // Populate enough history that the timeline and summary are not empty — an
  // empty screen hides most composition tells.
  await page.getByRole('button', { name: 'Wet' }).click()
  await page.getByRole('button', { name: 'Bottle', exact: true }).click()
  await page.getByRole('button', { name: 'Formula' }).click()
  await page.getByRole('button', { name: '120', exact: true }).click()
  await page.getByRole('button', { name: 'Save bottle' }).click()
  await page.getByText('Bottle saved').waitFor()
  await page.getByRole('button', { name: 'Dirty' }).click()
  await page.getByRole('button', { name: /Nursing/ }).click()
  const sheet = page.locator('.sheet')
  await sheet.getByRole('button', { name: 'Start', exact: true }).click()
  await page.waitForTimeout(1200)
  await sheet.getByRole('button', { name: 'Save feed' }).click()
  await page.getByText('Feed saved').waitFor()

  // A measurement, so the growth screen has a chart and a ledger to audit
  // rather than an empty state.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.locator('.settings-group').first().getByRole('button', { name: 'Girl' }).click()
  await page.getByRole('button', { name: 'Save details' }).click()
  await page.getByText('Details saved.').waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Log a measurement' }).click()
  await page.locator('.sheet').getByLabel('Value (kg)').fill('5.6')
  await page.locator('.sheet').getByRole('button', { name: 'Save measurement' }).click()
  await page.getByText('Measurement saved').waitFor()

  // Two reminders, one of each shape, so the reminders screen has rows to audit.
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
  await page.getByRole('button', { name: 'Add a reminder' }).click()
  await reminderSheet.getByLabel('Every').selectOption({ label: '3h' })
  await reminderSheet.getByRole('button', { name: 'Save reminder' }).click()
  await page.getByText('Reminder saved').waitFor()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: /Start sleep/ }).waitFor()
  await page.waitForTimeout(2400)

  for (const [label, theme] of [
    ['Light', 'day'],
    ['Dark', 'dark'],
    ['Night', 'night'],
  ]) {
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: label, exact: true }).click()
    writeFileSync(join(OUT, `settings-${theme}.html`), await serialize(page))
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: /Start sleep/ }).waitFor()
    writeFileSync(join(OUT, `home-${theme}.html`), await serialize(page))

    await page.getByRole('button', { name: 'Growth', exact: true }).click()
    await page.locator('.growth-headline').waitFor()
    writeFileSync(join(OUT, `growth-${theme}.html`), await serialize(page))
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: /Start sleep/ }).waitFor()

    await page.getByRole('button', { name: 'Reminders' }).click()
    await page.locator('.reminder-row').first().waitFor()
    writeFileSync(join(OUT, `reminders-${theme}.html`), await serialize(page))
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: /Start sleep/ }).waitFor()
  }

  console.log(`Wrote snapshots to ${OUT}`)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
