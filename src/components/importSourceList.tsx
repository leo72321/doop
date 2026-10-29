import { clientIntegrations } from '@/integrations'
import { GithubIcon, RadioTowerIcon, WebIcon } from './ui/icons'
import type { ImportSource } from './ImportSources'

/** The sources the import picker offers, in order — the canvas page's modal
 *  and Home's Import button show the same cards, so the list lives once. */
export function importSources(): ImportSource[] {
  return [
    {
      id: 'website',
      title: '網站',
      blurb: '匯入單一網頁，或探索整座網站。',
      icon: <WebIcon className="size-5 text-ink" />,
    },
    ...clientIntegrations
      .filter((i) => i.ImportSection && i.importSource)
      .map((i) => ({ id: i.id, ...i.importSource! })),
    {
      id: 'liveapp',
      title: '運行中應用程式',
      blurb: '支援登入驗證、VPN 或本機 Localhost 環境。',
      icon: <RadioTowerIcon className="size-5 text-ink" />,
    },
    {
      id: 'github',
      title: 'GitHub 倉庫',
      blurb: '直接從代碼倉庫的路由讀取介面畫面。',
      icon: <GithubIcon width={21} height={21} />,
    },
  ]
}
