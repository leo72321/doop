import { t } from './i18n'

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 5) return t('time.justNow')
  if (s < 60) return t('time.secondsAgo', { s })
  const m = Math.floor(s / 60)
  if (m < 60) return t('time.minutesAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('time.hoursAgo', { h })
  return t('time.daysAgo', { d: Math.floor(h / 24) })
}
