import type { RefObject } from 'react'
import { useStore } from '../lib/store'
import { isDrawingTool } from '../lib/tools'
import { useIsMobile } from '../hooks/use-mobile'
import { MOD_KEY } from '../lib/keys'
import { cn } from '../lib/utils'
import { useI18n } from '../lib/i18n'
import { MenuHint } from './ui/menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Toolbar, ToolbarButton } from './ui/toolbar'
import { MinusIcon, PlusIcon } from './ui/icons'

/* The zoom pill at the bottom right of the open canvas: step out, the current
   level, step in. The level doubles as the trigger of a menu with the preset
   zooms and the fits. The Stage writes the percentage into `labelRef` straight
   from its viewport subscription, so pan/zoom never re-renders this. */
export function ZoomControls({
  labelRef,
  hidden,
  onZoomIn,
  onZoomOut,
  onZoomTo,
  onFit,
  onFitSelection,
}: {
  labelRef: RefObject<HTMLSpanElement>
  /** ⌘. has hidden the chrome: display:none, so the label ref stays mounted */
  hidden: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomTo: (zoom: number) => void
  onFit: () => void
  onFitSelection: () => void
}) {
  const isMobile = useIsMobile()
  const hasSelection = useStore((s) => s.selectedIds.length > 0)
  const drawing = useStore((s) => isDrawingTool(s.tool))
  const rulers = useStore((s) => s.rulers)
  const toggleRulers = useStore((s) => s.toggleRulers)
  const { t } = useI18n()
  /* phones have no room for shortcut hints, and no keyboard to use them */
  const hint = (keys: string) => !isMobile && <MenuHint>{keys}</MenuHint>
  const stepBtn = 'min-h-0'

  return (
    <Toolbar
      className={cn(
        'absolute bottom-[calc(64px+env(safe-area-inset-bottom))] z-[35] h-9 gap-0.5 px-1 py-0 transition-[right] duration-150 ease-[ease] md:bottom-3.5',
        /* on phones the tool strip runs along the bottom, with its drawing hint above it */
        drawing && 'max-md:bottom-[calc(124px+env(safe-area-inset-bottom))]',
        /* beside the account island and whatever panels are open — the page
           sets --chrome-right as they come and go */
        isMobile ? 'left-1/2 -translate-x-1/2' : 'right-[var(--chrome-right,12px)]',
        hidden && 'hidden',
      )}
    >
      <ToolbarButton aria-label={t('zoom.zoomOut')} className={stepBtn} onClick={onZoomOut}>
        <MinusIcon />
      </ToolbarButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            aria-label={t('zoom.zoomLevel')}
            className={cn(stepBtn, 'w-auto min-w-[48px] px-1.5 font-mono text-[12px] text-ink sm:w-auto sm:px-1.5')}
          >
            <span ref={labelRef}>100%</span>
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" width="md">
          <DropdownMenuItem onSelect={onZoomIn}>{t('zoom.zoomIn')}{hint(`${MOD_KEY}+`)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={onZoomOut}>{t('zoom.zoomOut')}{hint(`${MOD_KEY}−`)}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onFit}>{t('zoom.zoomToFit')}{hint('⇧1')}</DropdownMenuItem>
          <DropdownMenuItem disabled={!hasSelection} onSelect={onFitSelection}>
            {t('zoom.zoomToSelection')}{hint('⇧2')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onZoomTo(0.5)}>{t('zoom.zoomTo50')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onZoomTo(1)}>{t('zoom.zoomTo100')}{hint(`${MOD_KEY}0`)}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onZoomTo(2)}>{t('zoom.zoomTo200')}</DropdownMenuItem>
          {/* phones show no rulers, so there is nothing to toggle there */}
          {!isMobile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={toggleRulers}>
                {rulers ? t('zoom.hideRulers') : t('zoom.showRulers')}
                {hint('⇧R')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton aria-label={t('zoom.zoomIn')} className={stepBtn} onClick={onZoomIn}>
        <PlusIcon />
      </ToolbarButton>
    </Toolbar>
  )
}
