import type { ReactNode } from 'react'
import { TranslatorContext } from './context'
import { findLocale, translatorFor, type LocaleCode } from './locales'

/**
 * Makes a translator available to the tree, and keeps the document's `lang` and
 * `dir` attributes in step — screen readers use `lang` to pick a voice, and `dir`
 * is what actually flips the layout for a right-to-left language.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: LocaleCode
  children: ReactNode
}) {
  const definition = findLocale(locale)
  const translator = translatorFor(locale)

  // Set during render rather than in an effect so the very first paint is already
  // correct; there is no server render to disagree with.
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
    document.documentElement.dir = definition?.rtl === true ? 'rtl' : 'ltr'
  }

  return (
    <TranslatorContext.Provider value={translator}>{children}</TranslatorContext.Provider>
  )
}
