import type { MessageKey } from './messages/en'

export type Messages = Readonly<Partial<Record<MessageKey, string>>>

export type InterpolationValues = Readonly<Record<string, string | number>>

/**
 * The base of a plural family — every key that has an `.other` member, with that
 * suffix stripped. Derived from the catalogue, so `plural('age.days', n)` is
 * checked at compile time and a typo cannot reach runtime.
 */
// A naked type parameter is what makes the conditional distribute over the union;
// inlining `MessageKey` on the left re-checks the whole union and yields never.
type PluralBaseOf<K> = K extends `${infer Base}.other` ? Base : never

export type PluralKey = PluralBaseOf<MessageKey>

/**
 * The translation core. Hand-rolled rather than pulling in i18next or react-intl:
 * this is roughly sixty lines, the whole app is offline-first so every kilobyte
 * is a kilobyte a parent downloads, and the heavy lifting (plurals, number and
 * date formats) is done by `Intl`, which is already in every browser.
 */
export interface Translator {
  locale: string
  /** Looks up `key`, interpolating `{placeholders}` by name. */
  t(key: MessageKey, values?: InterpolationValues): string
  /**
   * Looks up a plural family: `key` + the CLDR category for `count`, falling
   * back to `key.other`. `count` is interpolated automatically.
   */
  plural(key: PluralKey, count: number, values?: InterpolationValues): string
  /**
   * An ordinal — `1st`, `2nd`, `42nd`. English needs four suffixes chosen by a
   * rule most people apply without thinking; other languages inflect ordinals
   * differently or not at all, which is why the suffix is in the catalogue and
   * not in a `switch` here.
   */
  ordinal(value: number): string
  /** Locale-aware number formatting. */
  number(value: number, options?: Intl.NumberFormatOptions): string
}

const INTERPOLATION = /\{(\w+)\}/g

function interpolate(template: string, values: InterpolationValues | undefined): string {
  if (values === undefined) return template
  return template.replace(INTERPOLATION, (whole, name: string) => {
    const value = values[name]
    // Leaving the placeholder visible beats rendering "undefined": it is obvious
    // in review and in the pseudo-locale pass, and harmless to a reader.
    return value === undefined ? whole : String(value)
  })
}

export interface TranslatorOptions {
  locale: string
  messages: Messages
  /** Consulted when `messages` has no entry — always the English catalogue. */
  fallback: Readonly<Record<MessageKey, string>>
  /** Applied to every resolved string; used by the pseudo-locale. */
  transform?: (text: string, key: MessageKey) => string
}

export function createTranslator({
  locale,
  messages,
  fallback,
  transform,
}: TranslatorOptions): Translator {
  const pluralRules = new Intl.PluralRules(locale)
  const ordinalRules = new Intl.PluralRules(locale, { type: 'ordinal' })
  const numberFormat = new Intl.NumberFormat(locale)

  function resolve(key: MessageKey): string {
    const message = messages[key] ?? fallback[key] ?? key
    return transform === undefined ? message : transform(message, key)
  }

  return {
    locale,

    t(key, values) {
      return interpolate(resolve(key), values)
    },

    plural(key, count, values) {
      // `${key}.${category}` is not statically a MessageKey, but the catalogue
      // does define these families; drift.test.ts asserts every plural family
      // has at least an `.other` member, which is what makes the cast safe.
      const specific = `${key}.${pluralRules.select(count)}` as MessageKey
      const isDefined =
        messages[specific] !== undefined || fallback[specific] !== undefined
      const chosen = isDefined ? specific : (`${key}.other` as MessageKey)
      return interpolate(resolve(chosen), { count, ...values })
    },

    ordinal(value) {
      const specific = `ordinal.${ordinalRules.select(value)}` as MessageKey
      const isDefined =
        messages[specific] !== undefined || fallback[specific] !== undefined
      const chosen = isDefined ? specific : ('ordinal.other' as MessageKey)
      return interpolate(resolve(chosen), { value: numberFormat.format(value) })
    },

    number(value, options) {
      return options === undefined
        ? numberFormat.format(value)
        : new Intl.NumberFormat(locale, options).format(value)
    },
  }
}
