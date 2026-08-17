import { isNightHour, type NightWindow } from '@/domain/sleep'
import type { Timestamp } from '@/domain/types'
import type { ThemeMode } from './settings'

/** The theme actually applied to the document, after resolving `auto`. */
export type ResolvedTheme = 'day' | 'dark' | 'night'

/**
 * Resolves `auto` against the wall clock and the user's night window.
 *
 * During the night window the app goes to the dim red-tinted theme: red light
 * is the least disruptive to melatonin, and at 3am you are reading this screen
 * with one eye open. Outside it, `auto` follows the OS light/dark preference.
 */
export function resolveTheme(
  mode: ThemeMode,
  now: Timestamp,
  nightWindow: NightWindow,
  prefersDark: boolean,
): ResolvedTheme {
  if (mode !== 'auto') return mode
  if (isNightHour(now, nightWindow)) return 'night'
  return prefersDark ? 'dark' : 'day'
}

/** Keeps the browser chrome in step with the theme, so there is no bright bar. */
const THEME_COLORS: Record<ResolvedTheme, string> = {
  day: '#f7f5f1',
  dark: '#12151c',
  night: '#150a0a',
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', THEME_COLORS[theme])
}
