import { useEffect, useState } from 'react'
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  type Canvas,
  type CommunityCategory,
} from '../../shared/types'
import { toLinkAccess, type LinkAccess } from '../../shared/canvasRole'
import { navigate } from '../App'
import type { WorkspaceSummary } from '../../shared/types'
import { api, ApiError, paywalledWorkspace, type CanvasMember } from '../lib/api'
import { PERSONAL_WORKSPACE, UpgradeModal } from './WorkspaceModals'
import { authClient } from '../lib/auth'
import { useI18n } from '../lib/i18n'
import { posthog } from '../lib/posthog'
import { Avatar } from './ui/avatar'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { IconButton } from './ui/icon-button'
import { BuildingIcon, CopyIcon, XIcon } from './ui/icons'
import { Input } from './ui/input'
import { PersonRow } from './ui/list'
import { Modal, ModalTitle } from './ui/modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Textarea } from './ui/textarea'
import { ToggleChipGroup, ToggleChipItem } from './ui/toggle-chip'

type ShareableCanvas = Pick<
  Canvas,
  'id' | 'name' | 'ownerId' | 'linkAccess' | 'memberIds' | 'workspaceId' | 'publishedAt' | 'description' | 'category'
>
type SharePatch = Partial<
  Pick<ShareableCanvas, 'linkAccess' | 'memberIds' | 'workspaceId' | 'publishedAt' | 'description' | 'category'>
>

/* What each share-link level grants, as the picker and the read-out say it. */
const LINK_ACCESS_LABELS: Record<LinkAccess, string> = {
  none: 'No access',
  view: 'View',
  comment: 'Comment',
  edit: 'Edit',
}

const LINK_ACCESS_SUMMARY: Record<LinkAccess, string> = {
  none: 'Invite-only canvas',
  view: 'Anyone with the link can view',
  comment: 'Anyone with the link can comment',
  edit: 'Anyone with the link can edit',
}

const LINK_ACCESS_ORDER: readonly LinkAccess[] = ['none', 'view', 'comment', 'edit']

/* One sharing surface for the canvas and dashboard. The caller owns canvas
   state; this component reports optimistic access changes back to it. */
export function ShareModal({
  canvas,
  onChange,
  onClose,
  onCopied,
}: {
  canvas: ShareableCanvas
  onChange: (patch: SharePatch) => void
  onClose: () => void
  onCopied: () => void
}) {
  const { t } = useI18n()
  const { data: session } = authClient.useSession()
  const meId = session?.user?.id
  const isOwner = !!canvas.ownerId && canvas.ownerId === meId
  const linkAccess = toLinkAccess(canvas.linkAccess)
  const [people, setPeople] = useState<CanvasMember[] | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [upgrade, setUpgrade] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linkAccessLabels: Record<LinkAccess, string> = {
    none: t('share.accessNone'),
    view: t('share.accessView'),
    comment: t('share.accessComment'),
    edit: t('share.accessEdit'),
  }

  const linkAccessSummary: Record<LinkAccess, string> = {
    none: t('share.summaryNone'),
    view: t('share.summaryView'),
    comment: t('share.summaryComment'),
    edit: t('share.summaryEdit'),
  }

  useEffect(() => {
    let active = true
    api
      .listMembers(canvas.id)
      .then((members) => active && setPeople(members))
      .catch(() => active && setPeople([]))
    api
      .listWorkspaces()
      .then((res) => active && setWorkspaces(res.workspaces))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [canvas.id])

  const workspace = canvas.workspaceId ? workspaces.find((w) => w.id === canvas.workspaceId) : undefined

  async function move(target: string) {
    if (busy) return
    const workspaceId = target || null
    setBusy(true)
    setError(null)
    try {
      await api.moveCanvas(canvas.id, workspaceId)
      posthog.capture('canvas_moved', { into: !!workspaceId })
      onChange({ workspaceId: workspaceId ?? undefined })
    } catch (caught) {
      const walled = paywalledWorkspace(caught)
      if (walled) setUpgrade(walled)
      else setError(caught instanceof ApiError ? String(caught.body.error ?? 'move failed') : 'move failed')
    } finally {
      setBusy(false)
    }
  }

  async function invite() {
    const clean = email.trim()
    if (!clean || busy || people === null) return
    setBusy(true)
    setError(null)
    try {
      const member = await api.inviteMember(canvas.id, clean)
      setPeople((current) =>
        current?.some((person) => person.userId === member.userId) ? current : [...(current ?? []), member],
      )
      if (!canvas.memberIds?.includes(member.userId)) {
        onChange({ memberIds: [...(canvas.memberIds ?? []), member.userId] })
      }
      setEmail('')
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.body.error ?? 'invite failed') : 'invite failed')
    }
    setBusy(false)
  }

  async function remove(userId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.removeMember(canvas.id, userId)
      setPeople((current) => current?.filter((person) => person.userId !== userId) ?? null)
      onChange({ memberIds: canvas.memberIds?.filter((id) => id !== userId) })
      if (userId === meId && !isOwner) navigate('/')
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.body.error ?? 'removal failed') : 'removal failed')
    } finally {
      setBusy(false)
    }
  }

  async function setLink(next: LinkAccess) {
    if (busy || next === linkAccess) return
    setBusy(true)
    setError(null)
    try {
      await api.setLinkAccess(canvas.id, next)
      onChange({ linkAccess: next === 'none' ? undefined : next })
    } catch (caught) {
      setError(
        caught instanceof ApiError ? String(caught.body.error ?? 'access update failed') : 'access update failed',
      )
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    setError(null)
    try {
      await navigator.clipboard.writeText(`${location.origin}/c/${canvas.id}`)
      posthog.capture('canvas_link_shared')
      onCopied()
    } catch {
      setError(t('share.copyFailed'))
    }
  }

  return (
    <Modal size="sm" onClose={onClose}>
      <>
        <ModalTitle className="min-w-0">{t('share.title', { name: canvas.name })}</ModalTitle>
        {isOwner && (
          <>
            <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
              <Input
                variant="well"
                className="flex-1"
                autoFocus
                placeholder={t('share.invitePlaceholder')}
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && invite()}
              />
              <Button
                variant="primary"
                className="justify-center"
                disabled={busy || people === null || !email.trim()}
                onClick={invite}
              >
                {t('share.invite')}
              </Button>
            </div>
          </>
        )}
        {error && <p className="mx-[2px] mt-2 text-label text-accent-ink">{error}</p>}
        <div className="mt-[14px] mb-1 flex max-h-[40vh] flex-col gap-[2px] overflow-y-auto">
          {(people ?? []).map((person) => (
            <PersonRow
              key={person.userId}
              className="px-[2px] py-1.5"
              avatar={<Avatar name={person.name} size={28} />}
              name={`${person.name}${person.userId === meId ? t('share.you') : ''}`}
              detail={person.email}
              trailing={
                person.owner ? (
                  <span className="text-label text-ink-faint">{t('share.owner')}</span>
                ) : isOwner || person.userId === meId ? (
                  <IconButton
                    variant="danger"
                    size="sm"
                    aria-label={person.userId === meId ? t('share.leaveCanvas') : t('share.removePerson', { name: person.name })}
                    disabled={busy}
                    onClick={() => remove(person.userId)}
                  >
                    <XIcon width={14} height={14} />
                  </IconButton>
                ) : (
                  <span className="text-label text-ink-faint">{t('share.canEdit')}</span>
                )
              }
            />
          ))}
          {people === null && <p className="text-label text-ink-faint">{t('common.loading')}</p>}
          {canvas.workspaceId && (
            <PersonRow
              className="px-[2px] py-1.5"
              avatar={
                <span className="grid size-7 flex-none place-items-center rounded-full bg-paper-deep text-ink-soft">
                  <BuildingIcon width={14} height={14} aria-hidden />
                </span>
              }
              name={t('share.everyoneInWorkspace', { name: workspace?.name ?? t('share.theWorkspace') })}
              detail={
                workspace
                  ? workspace.memberCount === 1
                    ? t('home.peopleCountSingle')
                    : t('home.peopleCountMulti', { count: workspace.memberCount })
                  : t('share.workspaceMembers')
              }
              trailing={<span className="text-label text-ink-faint">{t('share.canEdit')}</span>}
            />
          )}
        </div>
        {/* filing: a workspace canvas is open to the whole team, so the
            choice sits with the access controls rather than in a menu */}
        {isOwner && workspaces.length > 0 && (
          <div className="mt-2.5 flex flex-col gap-2 border-t border-line-soft pt-3.5 sm:flex-row sm:items-center">
            <span className="text-body font-medium text-ink">{t('rail.workspaces')}</span>
            <Select
              value={canvas.workspaceId ?? PERSONAL_WORKSPACE}
              disabled={busy}
              onValueChange={(value) => void move(value === PERSONAL_WORKSPACE ? '' : value)}
            >
              <SelectTrigger className="sm:ml-auto sm:w-[240px]" aria-label={t('share.workspaceAria')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL_WORKSPACE}>{t('share.personalInviteOnly')}</SelectItem>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.active ? '' : t('workspace.needsPlan')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="mt-2.5 flex flex-col items-stretch justify-between gap-2.5 border-t border-line-soft pt-3.5 sm:flex-row sm:items-center">
          {isOwner ? (
            <div className="flex items-center gap-2">
              <span className="text-body font-medium text-ink">{t('share.anyoneWithLinkCan')}</span>
              <Select value={linkAccess} disabled={busy} onValueChange={(value) => void setLink(toLinkAccess(value))}>
                <SelectTrigger
                  size="sm"
                  className="w-[132px]"
                  aria-label={t('share.whatLinkCanDo')}
                  title={t('share.linkAccessTip')}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_ACCESS_ORDER.map((level) => (
                    <SelectItem key={level} value={level}>
                      {linkAccessLabels[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span className="text-label text-ink-faint">{linkAccessSummary[linkAccess]}</span>
          )}
          <Button className="justify-center gap-2" onClick={copy}>
            <CopyIcon className="size-3.5" />
            {t('share.copyLink')}
          </Button>
        </div>
        {isOwner && (
          <CommunityListing canvas={canvas} busy={busy} setBusy={setBusy} setError={setError} onChange={onChange} />
        )}
        {upgrade && (
          <UpgradeModal
            workspaceId={upgrade}
            reason={t('home.moveCanvasTeamPlanReason')}
            onClose={() => setUpgrade(null)}
          />
        )}
      </>
    </Modal>
  )
}

/* The gallery is opt-in and owner-only. Listing hands out previews and
   copies, never access — so it sits apart from the access controls above,
   with its own switch and its own blurb. */
function CommunityListing({
  canvas,
  busy,
  setBusy,
  setError,
  onChange,
}: {
  canvas: ShareableCanvas
  busy: boolean
  setBusy: (busy: boolean) => void
  setError: (error: string | null) => void
  onChange: (patch: SharePatch) => void
}) {
  const { t } = useI18n()
  const published = canvas.publishedAt !== undefined
  const [description, setDescription] = useState(canvas.description ?? '')
  const [category, setCategory] = useState<CommunityCategory>(canvas.category ?? 'website')
  const dirty = published && (description.trim() !== (canvas.description ?? '') || category !== canvas.category)

  async function save(next: boolean) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (next) {
        const listing = await api.publishCanvas(canvas.id, { description: description.trim(), category })
        if (!published) posthog.capture('canvas_published')
        onChange(listing)
      } else {
        await api.unpublishCanvas(canvas.id)
        posthog.capture('canvas_unpublished')
        onChange({ publishedAt: undefined, description: undefined, category: undefined })
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.body.error ?? 'publish failed') : 'publish failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3.5 border-t border-line-soft pt-3.5">
      <label
        className="flex cursor-pointer items-center gap-2 text-body font-medium text-ink"
        title={t('share.galleryTip')}
      >
        <Checkbox checked={published} disabled={busy} onChange={(event) => save(event.target.checked)} />
        {t('share.showInGallery')}
      </label>
      <p className="mt-1 pl-[26px] text-label leading-snug text-ink-faint">
        {t('share.galleryDesc')}
      </p>
      {published && (
        <div className="mt-3 flex flex-col gap-2.5 pl-[26px]">
          <Textarea
            rows={2}
            maxLength={280}
            variant="well"
            placeholder={t('share.descriptionPlaceholder')}
            value={description}
            disabled={busy}
            onChange={(event) => setDescription(event.target.value)}
          />
          <ToggleChipGroup
            aria-label={t('share.galleryShelf')}
            className="gap-1.5"
            value={category}
            onValueChange={(next) => setCategory(next as CommunityCategory)}
          >
            {COMMUNITY_CATEGORIES.map((value) => (
              <ToggleChipItem key={value} value={value} size="sm" disabled={busy}>
                {COMMUNITY_CATEGORY_LABELS[value]}
              </ToggleChipItem>
            ))}
          </ToggleChipGroup>
          {dirty && (
            <Button size="sm" className="self-start" disabled={busy} onClick={() => save(true)}>
              {t('share.updateListing')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
