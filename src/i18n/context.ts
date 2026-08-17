import { createContext, useContext } from 'react'
import { DEFAULT_LOCALE, translatorFor, type LocaleCode } from './locales'
import type { Translator } from './translate'

/**
 * Split from the provider component so this module exports no components, which
 * keeps React Fast Refresh working (the same reason `repositoryContext.ts` is
 * separate from `RepositoryProvider.tsx`).
 */
export const TranslatorContext = createContext<Translator>(translatorFor(DEFAULT_LOCALE))

export function useTranslator(): Translator {
  return useContext(TranslatorContext)
}

export type { LocaleCode, Translator }
