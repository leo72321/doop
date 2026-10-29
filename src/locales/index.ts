import { en } from './en'
import { zhTW } from './zh-TW'

export type Locale = 'zh-TW' | 'en'
export type TranslationKey = keyof typeof en
export type Translations = Record<TranslationKey, string>

export const locales: Record<Locale, Translations> = {
  'zh-TW': zhTW,
  en,
}

export { en, zhTW }
