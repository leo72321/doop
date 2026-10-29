import { useTheme } from '../lib/theme'
import { ThemePicker } from './ThemePicker'
import { Note } from './ui/note'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from './ui/card'
import { isLocale, useI18n, useLocale, type Locale } from '../lib/i18n'
import { ToggleChipGroup, ToggleChipItem } from './ui/toggle-chip'

export const languageOptions: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
]

export function LanguagePicker() {
  const { locale, setLocale } = useLocale()
  return (
    <ToggleChipGroup aria-label="Language" value={locale} onValueChange={(next) => isLocale(next) && setLocale(next)}>
      {languageOptions.map(({ value, label }) => (
        <ToggleChipItem key={value} value={value}>
          {label}
        </ToggleChipItem>
      ))}
    </ToggleChipGroup>
  )
}

/** The "Appearance" pane of /settings. The theme and language are properties of this
 *  browser rather than the account — so nothing here touches the server. */
export function AppearanceSettings() {
  const { theme, resolved } = useTheme()
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
          <CardDescription>{t('settings.themeDesc')}</CardDescription>
        </CardHeader>
        <CardRow label={t('settings.appearance')}>
          <ThemePicker />
          <Note>
            {theme === 'system'
              ? t('settings.themeSystem', { resolved: resolved === 'dark' ? t('settings.dark') : t('settings.light') })
              : t('settings.themeManual')}
          </Note>
        </CardRow>
      </SettingsCard>

      <SettingsCard>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
          <CardDescription>{t('settings.languageDesc')}</CardDescription>
        </CardHeader>
        <CardRow label={t('settings.language')}>
          <LanguagePicker />
        </CardRow>
      </SettingsCard>
    </div>
  )
}
