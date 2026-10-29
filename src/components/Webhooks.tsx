import { useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { posthog } from '../lib/posthog'
import { timeAgo } from '../lib/time'
import { t, useI18n } from '../lib/i18n'
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEventType, type WebhookInfo } from '../../shared/webhooks'
import { ConfirmDialog } from './ui/alert-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Note } from './ui/note'
import { Checkbox } from './ui/checkbox'
import { CodeBlock } from './ui/code-block'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from './ui/card'
import { TrashIcon } from './ui/icons'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** The one-line health of a hook, phrased for a person. */
function health(hook: WebhookInfo): { text: string; tone?: 'error' | 'success' } {
  if (!hook.enabled && hook.lastError?.startsWith('paused')) return { text: hook.lastError, tone: 'error' }
  if (!hook.enabled) return { text: t('webhooks.healthOff') }
  if (!hook.lastAt) return { text: t('webhooks.healthNoDeliveries') }
  if (hook.failures) {
    return {
      text: t('webhooks.healthFailed', {
        count: hook.failures,
        time: timeAgo(hook.lastAt),
        error: hook.lastError ?? 'failed',
      }),
      tone: 'error',
    }
  }
  return {
    text: t('webhooks.healthDelivered', { time: timeAgo(hook.lastAt), status: hook.lastStatus ?? '' }),
    tone: 'success',
  }
}

/** Picks events with the shared labels; used for the new-hook form. */
function EventPicker({ value, onChange }: { value: WebhookEventType[]; onChange: (next: WebhookEventType[]) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {WEBHOOK_EVENTS.map((event) => {
        const on = value.includes(event)
        return (
          <label key={event} className="relative flex cursor-pointer items-center gap-2 text-body text-ink">
            <Checkbox
              checked={on}
              onChange={() => onChange(on ? value.filter((e) => e !== event) : [...value, event])}
              aria-label={WEBHOOK_EVENT_LABELS[event]}
            />
            <span>
              <code className="font-mono text-caption text-ink-soft">{event}</code>
              <span className="text-ink-faint"> · {WEBHOOK_EVENT_LABELS[event]}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** The "Webhooks" pane of /settings: register URLs doop POSTs canvas events
 *  to, see whether they answer, rotate their secrets. The secret appears once,
 *  on creation or rotation — the list never carries it. */
export function Webhooks() {
  const { t } = useI18n()
  const [hooks, setHooks] = useState<WebhookInfo[] | null>(null)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([...WEBHOOK_EVENTS])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  /* the one moment a secret exists client-side */
  const [secret, setSecret] = useState<{ id: string; secret: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /* the action awaiting "are you sure" — an in-app dialog, since
     window.confirm is a silent "cancel" in the desktop shell's webview */
  const [confirming, setConfirming] = useState<{ kind: 'rotate' | 'remove'; hook: WebhookInfo } | null>(null)
  const [rowNote, setRowNote] = useState<Record<string, { text: string; tone?: 'error' | 'success' }>>({})

  useEffect(() => {
    api.listWebhooks().then(setHooks, (e: unknown) => {
      console.error(e)
      setHooks([])
      setError(errorMessage(e, 'Your webhooks could not be loaded'))
    })
  }, [])

  function replace(next: WebhookInfo) {
    setHooks((current) => current?.map((h) => (h.id === next.id ? next : h)) ?? null)
  }

  async function create() {
    setSaving(true)
    setError('')
    try {
      const { secret: fresh, ...info } = await api.createWebhook({ url: url.trim(), events })
      posthog.capture('webhook_created', { events })
      setUrl('')
      setSecret({ id: info.id, secret: fresh })
      setHooks((current) => [info, ...(current ?? [])])
    } catch (e) {
      setError(errorMessage(e, 'That webhook could not be created'))
    } finally {
      setSaving(false)
    }
  }

  async function act(hook: WebhookInfo, work: () => Promise<void>, failure: string) {
    setBusy(hook.id)
    try {
      await work()
    } catch (e) {
      setRowNote((n) => ({ ...n, [hook.id]: { text: errorMessage(e, failure), tone: 'error' } }))
    } finally {
      setBusy(null)
    }
  }

  const test = (hook: WebhookInfo) =>
    act(
      hook,
      async () => {
        const result = await api.testWebhook(hook.id)
        setRowNote((n) => ({
          ...n,
          [hook.id]: result.ok
            ? { text: t('webhooks.pingSuccess', { status: result.status ?? '' }), tone: 'success' }
            : { text: t('webhooks.pingFailed', { error: result.error ?? 'no response' }), tone: 'error' },
        }))
        const fresh = await api.listWebhooks()
        setHooks(fresh)
      },
      'The test could not be sent',
    )

  const toggle = (hook: WebhookInfo) =>
    act(
      hook,
      async () => replace(await api.updateWebhook(hook.id, { enabled: !hook.enabled })),
      'That could not be saved',
    )

  const rotate = (hook: WebhookInfo) =>
    act(
      hook,
      async () => {
        const { secret: fresh } = await api.rotateWebhookSecret(hook.id)
        posthog.capture('webhook_secret_rotated')
        setSecret({ id: hook.id, secret: fresh })
      },
      'The secret could not be rotated',
    )

  const remove = (hook: WebhookInfo) =>
    act(
      hook,
      async () => {
        await api.deleteWebhook(hook.id)
        posthog.capture('webhook_deleted')
        setHooks((current) => current?.filter((h) => h.id !== hook.id) ?? null)
        if (secret?.id === hook.id) setSecret(null)
      },
      'That webhook could not be removed',
    )

  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>{t('webhooks.title')}</CardTitle>
        <CardDescription>
          {t('webhooks.desc')}
        </CardDescription>
      </CardHeader>

      <CardRow
        label={t('webhooks.newWebhook')}
        action={
          <Button size="sm" disabled={saving || hooks === null || !url.trim() || !events.length} onClick={create}>
            {saving ? t('webhooks.adding') : t('webhooks.addWebhook')}
          </Button>
        }
        controlWidth="lg"
        control={
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError('')
            }}
            placeholder="https://hooks.example.com/doop"
            inputMode="url"
            aria-label={t('webhooks.urlAria')}
          />
        }
      >
        {/* basis-full drops the picker onto its own line under the URL field */}
        <div className="min-w-0 basis-full">
          <EventPicker value={events} onChange={setEvents} />
          {error && <Note tone="error">{error}</Note>}
        </div>
      </CardRow>

      {secret && (
        <CardRow label={t('webhooks.signingSecret')}>
          <div className="min-w-0 flex-1">
            <Note tone="success">{t('webhooks.signingSecretNotice')}</Note>
            <CodeBlock className="mt-2" text={secret.secret} />
            <Note>
              {t('webhooks.signingSecretCalc')}
            </Note>
          </div>
        </CardRow>
      )}

      {hooks?.map((hook) => {
        const status = rowNote[hook.id] ?? health(hook)
        return (
          <CardRow
            key={hook.id}
            label={hostOf(hook.url)}
            action={
              <div className="flex flex-wrap items-center gap-1">
                <Button size="sm" variant="ghost" disabled={busy === hook.id} onClick={() => void test(hook)}>
                  {t('webhooks.sendTest')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === hook.id}
                  onClick={() => setConfirming({ kind: 'rotate', hook })}
                >
                  {t('webhooks.rotateSecret')}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === hook.id} onClick={() => void toggle(hook)}>
                  {hook.enabled ? t('webhooks.turnOff') : t('webhooks.turnOn')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === hook.id}
                  aria-label={t('webhooks.removeAria', { host: hostOf(hook.url) })}
                  onClick={() => setConfirming({ kind: 'remove', hook })}
                >
                  <TrashIcon /> {t('common.remove')}
                </Button>
              </div>
            }
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-body text-ink-soft" title={hook.url}>
                {hook.url}
              </div>
              <div className="mt-1 text-caption text-ink-faint">{hook.events.join(' · ')}</div>
              <Note tone={status.tone}>{status.text}</Note>
            </div>
          </CardRow>
        )
      })}
      {hooks && hooks.length === 0 && !secret && (
        <CardRow label={t('webhooks.noWebhooksYet')}>
          <Note>{t('webhooks.noWebhooksDesc')}</Note>
        </CardRow>
      )}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming?.kind === 'rotate'
            ? t('webhooks.confirmRotateTitle', { host: confirming ? hostOf(confirming.hook.url) : '' })
            : t('webhooks.confirmRemoveTitle', { host: confirming ? hostOf(confirming.hook.url) : '' })
        }
        description={
          confirming?.kind === 'rotate' ? t('webhooks.confirmRotateDesc') : undefined
        }
        confirmLabel={confirming?.kind === 'rotate' ? t('webhooks.confirmRotateAction') : t('webhooks.confirmRemoveAction')}
        destructive
        onConfirm={() => {
          const target = confirming
          setConfirming(null)
          if (target) void (target.kind === 'rotate' ? rotate(target.hook) : remove(target.hook))
        }}
      />
    </SettingsCard>
  )
}
