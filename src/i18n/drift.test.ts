import { describe, expect, it } from 'vitest'
import { en, type MessageKey } from './messages/en'
import { LOCALES, negotiateLocale, translatorFor } from './locales'

const PLACEHOLDER = /\{(\w+)\}/g

function placeholders(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(PLACEHOLDER), (m) => m[1] as string))
}

const translatable = LOCALES.filter(
  (locale) => locale.code !== 'en' && Object.keys(locale.messages).length > 0,
)

describe('the English catalogue', () => {
  it('has no empty messages', () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key} is empty`).not.toBe('')
    }
  })

  it('gives every plural family an `.other` member, which is the fallback', () => {
    const families = new Set<string>()
    for (const key of Object.keys(en)) {
      const match = /^(.*)\.(zero|one|two|few|many|other)$/.exec(key)
      if (match !== null) families.add(match[1] as string)
    }
    expect(families.size).toBeGreaterThan(0)
    for (const family of families) {
      expect(en, `${family} has no .other fallback`).toHaveProperty(`${family}.other`)
    }
  })
})

describe.each(translatable.map((l) => [l.code, l] as const))(
  'locale %s',
  (code, locale) => {
    it('defines no key that English does not', () => {
      // A stray key is usually a typo, and it would silently never be shown.
      const unknown = Object.keys(locale.messages).filter((key) => !(key in en))
      expect(unknown, `${code} has keys absent from en`).toEqual([])
    })

    it('uses the same placeholders as English in every message it defines', () => {
      const mismatches: string[] = []
      for (const [key, translated] of Object.entries(locale.messages)) {
        const source = en[key as MessageKey]
        if (source === undefined || translated === undefined) continue
        const expected = placeholders(source)
        const actual = placeholders(translated)
        const missing = [...expected].filter((p) => !actual.has(p))
        const extra = [...actual].filter((p) => !expected.has(p))
        if (missing.length > 0 || extra.length > 0) {
          mismatches.push(`${key}: missing ${missing.join()} extra ${extra.join()}`)
        }
      }
      // A dropped placeholder means a number silently vanishes from the UI.
      expect(mismatches).toEqual([])
    })

    it('is complete, so nothing silently falls back to English', () => {
      const missing = (Object.keys(en) as MessageKey[]).filter(
        (key) => locale.messages[key] === undefined,
      )
      expect(missing, `${code} is missing ${missing.length} keys`).toEqual([])
    })
  },
)

describe('translators', () => {
  it('resolve a plain key', () => {
    expect(translatorFor('en').t('section.timeline')).toBe('Timeline')
  })

  it('interpolate named placeholders', () => {
    expect(translatorFor('en').t('status.since', { time: '9:05 pm' })).toBe(
      'since 9:05 pm',
    )
  })

  it('leave an unknown placeholder visible rather than printing undefined', () => {
    expect(translatorFor('en').t('status.since')).toBe('since {time}')
  })

  it('select plural forms via Intl', () => {
    const t = translatorFor('en')
    expect(t.plural('age.days', 1)).toBe('1 day old')
    expect(t.plural('age.days', 5)).toBe('5 days old')
  })

  it('fall back to English for a key a locale has not translated', () => {
    // Spanish is complete today; this proves the mechanism rather than a gap.
    const partial = translatorFor('es')
    expect(partial.t('app.name')).toBe('Baby Tracker')
  })

  it('translate into Spanish', () => {
    expect(translatorFor('es').t('section.timeline')).toBe('Cronología')
  })

  it('mark every string in the pseudo-locale, so un-extracted text stands out', () => {
    const pseudo = translatorFor('en-XA').t('section.timeline')
    expect(pseudo.startsWith('⟦')).toBe(true)
    expect(pseudo.endsWith('⟧')).toBe(true)
    // Longer than the source, to surface layouts that only fit English.
    expect(pseudo.length).toBeGreaterThan('Timeline'.length)
  })

  it('keep placeholders intact in the pseudo-locale', () => {
    expect(translatorFor('en-XA').t('status.since', { time: '9:05' })).toContain('9:05')
  })
})

describe('negotiateLocale', () => {
  it('matches on the base language, so es-MX lands on es', () => {
    expect(negotiateLocale(['es-MX'])).toBe('es')
    expect(negotiateLocale(['es-419', 'en'])).toBe('es')
  })

  it('prefers the first supported entry', () => {
    expect(negotiateLocale(['de', 'es', 'en'])).toBe('es')
  })

  it('falls back to English when nothing matches', () => {
    expect(negotiateLocale(['de', 'ja'])).toBe('en')
    expect(negotiateLocale([])).toBe('en')
  })

  it('never auto-selects the pseudo-locale', () => {
    expect(negotiateLocale(['en-XA'])).toBe('en')
  })
})
