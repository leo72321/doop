import { clientIntegrations } from '@/integrations'
import { GithubIcon, RadioTowerIcon, WebIcon } from './ui/icons'
import type { ImportSource } from './ImportSources'
import { t } from '../lib/i18n'

/** The sources the import picker offers, in order — the canvas page's modal
 *  and Home's Import button show the same cards, so the list lives once. */
export function importSources(): ImportSource[] {
  return [
    {
      id: 'website',
      title: t('import.sourceWebsiteTitle'),
      blurb: t('import.sourceWebsiteBlurb'),
      icon: <WebIcon className="size-5 text-ink" />,
    },
    ...clientIntegrations
      .filter((i) => i.ImportSection && i.importSource)
      .map((i) => ({ id: i.id, ...i.importSource! })),
    {
      id: 'liveapp',
      title: t('import.sourceLiveAppTitle'),
      blurb: t('import.sourceLiveAppBlurb'),
      icon: <RadioTowerIcon className="size-5 text-ink" />,
    },
    {
      id: 'github',
      title: t('import.sourceGithubTitle'),
      blurb: t('import.sourceGithubBlurb'),
      icon: <GithubIcon width={21} height={21} />,
    },
  ]
}
