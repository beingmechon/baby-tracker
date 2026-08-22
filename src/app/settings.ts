import type { NightWindow } from '@/domain/sleep'
import { DEFAULT_NIGHT_WINDOW } from '@/domain/sleep'
import type { LocaleCode } from '@/i18n/locales'
import { findLocale, negotiateLocale } from '@/i18n/locales'
import type { Id, MeasureSystem, VolumeUnit } from '@/domain/types'

export type ThemeMode = 'auto' | 'day' | 'dark' | 'night'

export interface Settings {
  /** Which baby the app opens on. */
  activeBabyId: Id | null
  /** null means "follow the browser's languages". */
  locale: LocaleCode | null
  volumeUnit: VolumeUnit
  /** Units for weight and length. Independent of `volumeUnit` on purpose: plenty
   *  of parents weigh in kilograms and still measure bottles in ounces. */
  measureSystem: MeasureSystem
  themeMode: ThemeMode
  nightWindow: NightWindow
  /** Whether the wake-window display shows age-based guidance. */
  showWakeWindowGuidance: boolean
  /**
   * Babies logged together — twins mode. Two or more ids, or empty for off.
   *
   * A group rather than a direction, so it means the same thing whichever twin is
   * on screen. See `domain/together.ts`.
   */
  togetherIds: Id[]
}

export const DEFAULT_SETTINGS: Settings = {
  activeBabyId: null,
  locale: null,
  volumeUnit: 'ml',
  measureSystem: 'metric',
  themeMode: 'auto',
  nightWindow: DEFAULT_NIGHT_WINDOW,
  showWakeWindowGuidance: true,
  togetherIds: [],
}

const STORAGE_KEY = 'baby-tracker:settings'

function isHour(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
}

/**
 * Settings live in localStorage rather than IndexedDB because the theme has to
 * be known synchronously on first paint — an async read would flash a bright
 * white screen at 3am, which is precisely the thing night mode exists to avoid.
 *
 * Every field is validated: a hand-edited or half-written value must degrade to
 * the default rather than crash the app on launch.
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
    const value = parsed as Record<string, unknown>

    const nightWindow =
      typeof value.nightWindow === 'object' && value.nightWindow !== null
        ? (value.nightWindow as Record<string, unknown>)
        : {}

    return {
      activeBabyId:
        typeof value.activeBabyId === 'string' ? value.activeBabyId : null,
      locale:
        typeof value.locale === 'string' && findLocale(value.locale) !== undefined
          ? (value.locale as LocaleCode)
          : null,
      volumeUnit: value.volumeUnit === 'oz' ? 'oz' : 'ml',
      measureSystem: value.measureSystem === 'imperial' ? 'imperial' : 'metric',
      themeMode:
        value.themeMode === 'day' ||
        value.themeMode === 'dark' ||
        value.themeMode === 'night'
          ? value.themeMode
          : 'auto',
      nightWindow: {
        startHour: isHour(nightWindow.startHour)
          ? nightWindow.startHour
          : DEFAULT_NIGHT_WINDOW.startHour,
        endHour: isHour(nightWindow.endHour)
          ? nightWindow.endHour
          : DEFAULT_NIGHT_WINDOW.endHour,
      },
      showWakeWindowGuidance: value.showWakeWindowGuidance !== false,
      // Every entry checked: a hand-edited array of numbers must not become a
      // list of babies to write events for.
      togetherIds: Array.isArray(value.togetherIds)
        ? value.togetherIds.filter((id): id is Id => typeof id === 'string')
        : [],
    }
  } catch {
    // A corrupt or unavailable store must never stop the app from opening.
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private-browsing quota errors are not worth interrupting a parent over.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing useful to do; the caller is already deleting everything.
  }
}

/**
 * The locale to actually use: the user's explicit choice, or the best match for
 * the languages their browser reports.
 */
export function resolveLocale(settings: Settings): LocaleCode {
  if (settings.locale !== null) return settings.locale
  const preferred =
    typeof navigator !== 'undefined' && navigator.languages !== undefined
      ? navigator.languages
      : []
  return negotiateLocale(preferred)
}
