import { t, useI18n } from '../lib/i18n'
import { useMemo } from 'react'
import type { Frame } from '../../shared/types'
import { canvasPages, framePageId } from '../../shared/pages'
import {
  DEFAULT_PROTO_DURATION,
  MAX_PROTO_DELAY,
  MAX_PROTO_DURATION,
  type Interaction,
  type ProtoAction,
  type ProtoTransition,
  type ProtoTrigger,
} from '../../shared/prototype'
import { useStore } from '../lib/store'
import { isLayerLocked } from '../lib/layerEdits'
import { elementInteractions, saveInteractions, setFlowStart } from '../lib/prototype'
import { IconButton } from './ui/icon-button'
import { PlusIcon, TrashIcon } from './ui/icons'
import { Switch } from './ui/switch'
import { NumberField, PropertyRow, PropertySection, SelectField, TextField } from './ui/property-field'

function getTriggers(t: (k: any) => string): { value: ProtoTrigger; label: string }[] {
  return [
    { value: 'click', label: t('interactions.triggerClick') },
    { value: 'hover', label: t('interactions.triggerHover') },
    { value: 'press', label: t('interactions.triggerPress') },
    { value: 'delay', label: t('interactions.triggerDelay') },
    { value: 'key', label: t('interactions.triggerKey') },
  ]
}
function getActions(t: (k: any) => string): { value: ProtoAction; label: string }[] {
  return [
    { value: 'navigate', label: t('interactions.actionNavigate') },
    { value: 'overlay', label: t('interactions.actionOverlay') },
    { value: 'back', label: t('interactions.actionBack') },
    { value: 'close-overlay', label: t('interactions.actionCloseOverlay') },
    { value: 'scroll-to', label: t('interactions.actionScrollTo') },
    { value: 'url', label: t('interactions.actionUrl') },
  ]
}
function getTransitions(t: (k: any) => string): { value: ProtoTransition; label: string }[] {
  return [
    { value: 'instant', label: t('interactions.transInstant') },
    { value: 'dissolve', label: t('interactions.transDissolve') },
    { value: 'slide-left', label: t('interactions.transSlideLeft') },
    { value: 'slide-right', label: t('interactions.transSlideRight') },
    { value: 'slide-up', label: t('interactions.transSlideUp') },
    { value: 'slide-down', label: t('interactions.transSlideDown') },
    { value: 'push-left', label: t('interactions.transPushLeft') },
    { value: 'push-right', label: t('interactions.transPushRight') },
  ]
}

/** The Prototype tab of the element panel: the element's interactions, and
 *  whether its frame starts the page's flow. Every change rewrites the
 *  element's attributes through the frame save path, one undo step each. */
export function InteractionsPanel({ frame, selector }: { frame: Frame; selector: string }) {
  const { t } = useI18n()
  const canvas = useStore((s) => s.canvas)
  const list = useMemo(() => elementInteractions(frame.html, selector), [frame.html, selector])
  const locked = isLayerLocked(frame, selector)
  const pages = canvas ? canvasPages(canvas) : []
  const pageId = canvas ? framePageId(canvas, frame) : null
  const page = pages.find((p) => p.id === pageId)
  const targets = useMemo(() => {
    if (!canvas) return []
    const pageNames = new Map(canvasPages(canvas).map((p) => [p.id, p.name]))
    const multiPage = pageNames.size > 1
    return canvas.frames
      .filter((f) => f.id !== frame.id)
      .map((f) => ({
        value: f.id,
        label: multiPage ? `${f.name} · ${pageNames.get(framePageId(canvas, f)) ?? ''}` : f.name,
      }))
  }, [canvas, frame.id])

  function save(next: Interaction[]) {
    const live = useStore.getState().canvas?.frames.find((f) => f.id === frame.id) ?? frame
    if (!saveInteractions(live, selector, next)) useStore.getState().pushNotice(t('interactions.cantEdit'))
  }

  const firstTarget = targets[0]?.value
  function add() {
    if (!list) return
    const action: ProtoAction = firstTarget ? 'navigate' : 'back'
    save([
      ...list,
      {
        trigger: 'click',
        action,
        ...(firstTarget ? { target: firstTarget } : {}),
        transition: 'instant',
        duration: DEFAULT_PROTO_DURATION,
      },
    ])
  }

  return (
    <>
      <PropertySection
        title={t('interactions.title')}
        action={
          list &&
          !locked && (
            <IconButton size="sm" aria-label={t('interactions.add')} onClick={add}>
              <PlusIcon size="rail" />
            </IconButton>
          )
        }
      >
        {!list ? (
          <p className="text-caption text-ink-faint">
            A script creates this element, so it has no markup to hold interactions. Add them in the frame’s HTML.
          </p>
        ) : list.length === 0 ? (
          <p className="text-caption text-ink-faint">
            {locked ? 'Unlock the layer to add interactions.' : 'Nothing happens when this is clicked yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5" data-interactions="">
            {list.map((interaction, index) => (
              <InteractionRow
                key={index}
                index={index}
                interaction={interaction}
                targets={targets}
                disabled={locked}
                onChange={(next) => save(list.map((item, i) => (i === index ? next : item)))}
                onRemove={() => save(list.filter((_, i) => i !== index))}
              />
            ))}
          </div>
        )}
      </PropertySection>
      {canvas && page && (
        <PropertySection title={t('interactions.flow')}>
          <PropertyRow label={t('interactions.start')}>
            <span className="flex flex-1 items-center justify-between gap-2 text-caption text-ink-soft">
              {page.startFrameId === frame.id ? 'Starts here' : 'Start the flow on this frame'}
              <Switch
                size="sm"
                aria-label={t('interactions.startFlow')}
                checked={page.startFrameId === frame.id}
                onCheckedChange={(on) => setFlowStart(canvas.id, page.id, on ? frame.id : null)}
              />
            </span>
          </PropertyRow>
        </PropertySection>
      )}
    </>
  )
}

function InteractionRow({
  index,
  interaction,
  targets,
  disabled,
  onChange,
  onRemove,
}: {
  index: number
  interaction: Interaction
  targets: { value: string; label: string }[]
  disabled: boolean
  onChange: (next: Interaction) => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const i = interaction
  const n = index + 1
  const firstTarget = targets[0]?.value

  function setTrigger(trigger: ProtoTrigger) {
    const { delay: _delay, key: _key, ...rest } = i
    onChange({
      ...rest,
      trigger,
      ...(trigger === 'delay' ? { delay: 1000 } : {}),
      ...(trigger === 'key' ? { key: 'ArrowRight' } : {}),
    })
  }

  function setAction(action: ProtoAction) {
    const { target: _target, ...rest } = i
    const target =
      action === 'navigate' || action === 'overlay'
        ? i.action === 'navigate' || i.action === 'overlay'
          ? i.target
          : firstTarget
        : action === 'scroll-to'
          ? 'body'
          : action === 'url'
            ? 'https://example.com'
            : undefined
    if ((action === 'navigate' || action === 'overlay') && !target) return
    onChange({ ...rest, action, ...(target ? { target } : {}) })
  }

  const leavesFrame = i.action === 'navigate' || i.action === 'overlay'
  const targetOptions =
    leavesFrame && i.target && !targets.some((t) => t.value === i.target)
      ? [{ value: i.target, label: `Missing frame (${i.target})` }, ...targets]
      : targets

  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col rounded-row bg-sub/60 px-2 pt-0.5 pb-2"
      aria-label={t('interactions.itemAria', { n })}
    >
      <PropertyRow label={t('interactions.trigger')}>
        <SelectField label={t('interactions.triggerN', { n })} value={i.trigger} options={getTriggers(t)} onChange={setTrigger} />
        <IconButton size="sm" variant="danger" aria-label={t('interactions.removeInteraction', { n })} onClick={onRemove}>
          <TrashIcon size="rail" />
        </IconButton>
      </PropertyRow>
      {i.trigger === 'delay' && (
        <PropertyRow label={t('interactions.after')}>
          <NumberField
            label={t('interactions.delayN', { n })}
            value={i.delay ?? 0}
            unit="ms"
            max={MAX_PROTO_DELAY}
            onCommit={(delay) => onChange({ ...i, delay: Math.round(delay) })}
          />
        </PropertyRow>
      )}
      {i.trigger === 'key' && (
        <PropertyRow label={t('interactions.key')}>
          <TextField
            label={t('interactions.keyN', { n })}
            value={i.key === ' ' ? 'Space' : (i.key ?? '')}
            placeholder={t('interactions.keyPlaceholder')}
            onCommit={(key) => key.trim() && onChange({ ...i, key: key.trim() === 'Space' ? ' ' : key.trim() })}
          />
        </PropertyRow>
      )}
      <PropertyRow label={t('interactions.action')}>
        <SelectField label={t('interactions.actionN', { n })} value={i.action} options={getActions(t)} onChange={setAction} />
      </PropertyRow>
      {leavesFrame && (
        <PropertyRow label={t('interactions.frame')}>
          {targetOptions.length ? (
            <SelectField
              label={t('interactions.targetFrameN', { n })}
              value={i.target ?? ''}
              options={targetOptions}
              onChange={(target) => onChange({ ...i, target })}
            />
          ) : (
            <span className="text-caption text-ink-faint">{t('interactions.addAnotherFrameFirst')}</span>
          )}
        </PropertyRow>
      )}
      {i.action === 'scroll-to' && (
        <PropertyRow label={t('interactions.element')}>
          <TextField
            label={t('interactions.scrollTargetN', { n })}
            value={i.target ?? ''}
            placeholder={t('interactions.elementPlaceholder')}
            onCommit={(target) => target.trim() && onChange({ ...i, target: target.trim() })}
          />
        </PropertyRow>
      )}
      {i.action === 'url' && (
        <PropertyRow label={t('interactions.url')}>
          <TextField
            label={t('interactions.linkN', { n })}
            value={i.target ?? ''}
            placeholder={t('interactions.urlPlaceholder')}
            onCommit={(target) => /^https?:\/\/\S+$/i.test(target.trim()) && onChange({ ...i, target: target.trim() })}
          />
        </PropertyRow>
      )}
      {leavesFrame && (
        <PropertyRow label={t('interactions.motion')}>
          <SelectField
            label={t('interactions.transitionN', { n })}
            value={i.transition}
            options={getTransitions(t)}
            onChange={(transition) => onChange({ ...i, transition })}
          />
          {i.transition !== 'instant' && (
            <NumberField
              label={t('interactions.durationN', { n })}
              className="max-w-[72px]"
              value={i.duration}
              unit="ms"
              max={MAX_PROTO_DURATION}
              onCommit={(duration) => onChange({ ...i, duration: Math.round(duration) })}
            />
          )}
        </PropertyRow>
      )}
    </fieldset>
  )
}
