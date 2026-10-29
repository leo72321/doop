import { readingOrder } from '../../shared/frameOrder'
import type { Frame } from '../../shared/types'
import { downloadFrameExport, downloadFramesPdf, type FrameExportFormat } from '../lib/frameExport'
import { useI18n } from '../lib/i18n'
import { Button } from './ui/button'
import { Modal, ModalActions, ModalLede, ModalTitle } from './ui/modal'

export function FrameExportModal({
  frame,
  groupFrames = [frame],
  onClose,
}: {
  frame: Frame
  /** the selection the menu acts on; the PDF binds all of it, a page per
   *  frame in reading order */
  groupFrames?: Frame[]
  onClose: () => void
}) {
  const { t } = useI18n()

  function download(format: FrameExportFormat) {
    void downloadFrameExport(frame, format)
    onClose()
  }

  function downloadPdf() {
    void downloadFramesPdf(frame.canvasId, readingOrder(groupFrames))
    onClose()
  }

  return (
    <Modal size="sm" onClose={onClose}>
      <ModalTitle className="break-words">{t('frameExport.title', { name: frame.name })}</ModalTitle>
      <ModalLede>{t('frameExport.lede')}</ModalLede>
      <div className="mt-5 grid gap-2">
        <Button variant="ghost" className="justify-start" onClick={() => download('png')}>
          {t('frameExport.downloadPng')}
        </Button>
        <Button variant="ghost" className="justify-start" onClick={() => download('jpg')}>
          {t('frameExport.downloadJpg')}
        </Button>
        <Button
          variant="ghost"
          className="h-auto flex-col items-start gap-1 whitespace-normal text-left"
          onClick={downloadPdf}
        >
          <span>
            {groupFrames.length > 1
              ? t('frameExport.downloadPdfCount', { count: groupFrames.length })
              : t('frameExport.downloadPdfSingle')}
          </span>
          <span className="text-xs font-normal text-ink-soft">
            {groupFrames.length > 1 ? t('frameExport.pdfMultiDesc') : t('frameExport.pdfSingleDesc')}
          </span>
        </Button>
      </div>
      <ModalActions>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
      </ModalActions>
    </Modal>
  )
}
