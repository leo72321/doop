import { useSyncExternalStore } from 'react'
import { locales, type Locale, type TranslationKey, type Translations } from '../locales'

export type { Locale, TranslationKey, Translations }

export const LOCALE_STORAGE_KEY = 'doop-locale'
export const DEFAULT_LOCALE: Locale = 'zh-TW'

let activeLocale: Locale | null = null
const listeners = new Set<() => void>()

export function isLocale(value: unknown): value is Locale {
  return value === 'zh-TW' || value === 'en'
}

function readStoredLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : null
  } catch {
    return null
  }
}

export function getLocale(): Locale {
  if (!activeLocale) {
    activeLocale = readStoredLocale() ?? DEFAULT_LOCALE
  }
  return activeLocale
}

export function setLocale(locale: Locale): void {
  activeLocale = locale
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // storage can be unavailable in private browsing
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLocale(): { locale: Locale; setLocale: (locale: Locale) => void } {
  const locale = useSyncExternalStore(subscribe, getLocale)
  return { locale, setLocale }
}

export function getTranslation(locale: Locale = getLocale()): Translations {
  return locales[locale] ?? locales[DEFAULT_LOCALE]
}

export function t(key: TranslationKey, vars?: Record<string, string | number>): string {
  const currentLocale = getLocale()
  const dict = locales[currentLocale] ?? locales[DEFAULT_LOCALE]
  let str: string = dict[key] ?? locales['en'][key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

export function useI18n() {
  const { locale, setLocale: updateLocale } = useLocale()
  const dict = getTranslation(locale)

  const format = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    let str: string = dict[key] ?? locales['en'][key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return str
  }

  return {
    locale,
    setLocale: updateLocale,
    t: format,
    dict,
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== LOCALE_STORAGE_KEY) return
    activeLocale = null
    listeners.forEach((listener) => listener())
  })
}
