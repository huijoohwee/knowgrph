import { printElementToPdf } from '@/lib/print/printElementToPdf'
import type { PrintOrientation } from '@/lib/print/printElementToPdf'
import type { UiToastInput } from '@/hooks/store/types'

export async function exportViewerPdf(args: {
  exportBaseName: string
  viewerEl: HTMLElement | null
  viewerRefCurrent: HTMLElement | null
  pushUiToast: (toast: UiToastInput) => void
  orientation?: PrintOrientation
}): Promise<void> {
  const root = args.viewerEl || args.viewerRefCurrent
  if (!root) {
    args.pushUiToast({ id: 'export-pdf-missing-view', kind: 'warning', message: 'Open the Viewer to export PDF.' })
    return
  }
  const previewRoot = (root.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null) || root
  const target = (previewRoot.querySelector('article') as HTMLElement | null) || previewRoot
  await printElementToPdf(target, { title: args.exportBaseName, orientation: args.orientation })
}
