import { useEffect, useState } from 'react'
import { AuthCard, AuthCardText, AuthScreen } from '../components/ui/screen'
import { Button } from '../components/ui/button'
import { Callout } from '../components/ui/callout'
import { t, useI18n } from '../lib/i18n'

export function OAuthConsent({ email }: { email: string }) {
  const { t } = useI18n()
  const code = new URLSearchParams(location.search).get('consent_code') ?? ''
  const [client, setClient] = useState<{ name: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const endpoint = `/api/mcp-consent/${encodeURIComponent(code)}`

  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(t('oauth.expired'))
        return res.json() as Promise<{ name: string }>
      })
      .then(setClient)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : t('oauth.cantLoad'))
      })
    return () => controller.abort()
  }, [endpoint, t])

  async function respond(accept: boolean) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })
      if (!res.ok) throw new Error(t('oauth.cantFinish'))
      const result = (await res.json()) as { redirectURI: string }
      location.assign(result.redirectURI)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('oauth.cantFinishGeneral'))
      setBusy(false)
    }
  }

  return (
    <AuthScreen>
      <AuthCard title={client ? t('oauth.connectClient', { name: client.name }) : t('oauth.connectAgent')}>
        <AuthCardText className="break-all">{t('oauth.signedInAs', { email })}</AuthCardText>
        <AuthCardText>
          {t('oauth.consentDesc')}
        </AuthCardText>
        {error && <Callout tone="error">{error}</Callout>}
        <div className="flex justify-end gap-2">
          <Button disabled={!client || busy} onClick={() => void respond(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="solid" disabled={!client || busy} onClick={() => void respond(true)}>
            {busy ? t('oauth.connecting') : t('oauth.connect')}
          </Button>
        </div>
      </AuthCard>
    </AuthScreen>
  )
}
