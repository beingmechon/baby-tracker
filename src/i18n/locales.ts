import { en, type MessageKey } from './messages/en'
import { es } from './messages/es'
import { createTranslator, type Messages, type Translator } from './translate'

export type LocaleCode = 'en' | 'es' | 'en-XA'

export interface LocaleDefinition {
  code: LocaleCode
  /** Shown in the language picker, always in the language itself. */
  name: string
  messages: Messages
  /** False until a native speaker has gone through it. Surfaced in the UI. */
  reviewed: boolean
  /** Right-to-left scripts need `dir="rtl"` on the document. */
  rtl: boolean
  /** Hidden from the picker in production builds. */
  development?: boolean
}

/**
 * Expands and accents text without making it unreadable.
 *
 * This is a testing tool, not a joke locale. It does three jobs at once:
 *   - anything still in plain English on screen was never extracted,
 *   - ~35% longer strings surface layouts that only fit English,
 *   - accents prove the font actually has the glyphs.
 */
function pseudo(text: string): string {
  const map: Record<string, string> = {
    a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý',
    A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
    c: 'ç', n: 'ñ', s: 'š', z: 'ž', d: 'ð',
  }
  // Match either a whole `{placeholder}` token or a single character. The token
  // branch passes through untouched — accenting a placeholder's *name* breaks
  // interpolation, which is exactly what an earlier version of this did.
  const accented = text.replace(/\{[^}]*\}|[\s\S]/g, (chunk) =>
    chunk.startsWith('{') ? chunk : (map[chunk] ?? chunk),
  )
  const padding = Math.max(2, Math.ceil(accented.length * 0.35))
  return `⟦${accented}${'·'.repeat(padding)}⟧`
}

export const LOCALES: readonly LocaleDefinition[] = [
  { code: 'en', name: 'English', messages: en, reviewed: true, rtl: false },
  { code: 'es', name: 'Español', messages: es, reviewed: false, rtl: false },
  {
    code: 'en-XA',
    name: 'Pseudo (testing)',
    messages: {},
    reviewed: true,
    rtl: false,
    development: true,
  },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'

export function findLocale(code: string): LocaleDefinition | undefined {
  return LOCALES.find((locale) => locale.code === code)
}

/**
 * Picks the best available locale for a list of user preferences, matching on the
 * base language so `es-MX` and `es-419` both land on `es`. The pseudo-locale is
 * never auto-selected — it has to be chosen deliberately.
 */
export function negotiateLocale(preferred: readonly string[]): LocaleCode {
  for (const candidate of preferred) {
    const base = candidate.toLowerCase().split('-')[0]
    const match = LOCALES.find(
      (locale) =>
        locale.development !== true && locale.code.toLowerCase().split('-')[0] === base,
    )
    if (match !== undefined) return match.code
  }
  return DEFAULT_LOCALE
}

export function translatorFor(code: LocaleCode): Translator {
  const definition = findLocale(code) ?? LOCALES[0]
  if (definition === undefined) throw new Error('No locales are defined')
  return createTranslator({
    // The pseudo-locale must still format numbers and plurals like English.
    locale: definition.code === 'en-XA' ? 'en' : definition.code,
    messages: definition.messages,
    fallback: en,
    ...(definition.code === 'en-XA' ? { transform: pseudo } : {}),
  })
}

export type { MessageKey, Translator }
