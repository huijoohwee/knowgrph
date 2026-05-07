import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testPresentationPdfScrollViewportPreservesWorkspaceState() {
  const presentationHelpersPath = resolve(process.cwd(), 'src', 'lib', 'print', 'printElementToPdf.presentation.ts')
  const presentationHelpersText = readFileSync(presentationHelpersPath, 'utf8')

  if (!presentationHelpersText.includes('export const copyPresentationScrollableState = (src: HTMLElement, dst: HTMLElement): void => {')) {
    throw new Error('expected presentation PDF scroll-state clone helper to exist in presentation print helper SSOT')
  }
  if (
    !presentationHelpersText.includes('dstScroller.scrollLeft = srcScroller.scrollLeft')
    || !presentationHelpersText.includes('dstScroller.scrollTop = srcScroller.scrollTop')
  ) {
    throw new Error('expected presentation PDF fidelity to preserve workspace scroller viewport state in print clone')
  }
  if (presentationHelpersText.includes('dstScroller.scrollLeft = 0') || presentationHelpersText.includes('dstScroller.scrollTop = 0')) {
    throw new Error('expected presentation PDF scroll-state helper to forbid hardcoded viewport resets')
  }

  const exportPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'main', 'exports', 'exportPdf.ts')
  const exportText = readFileSync(exportPath, 'utf8')
  if (
    !exportText.includes('const syncPresentationDeckScrollState = (')
    || !exportText.includes('copyExportScrollableState(srcScroller, dstScroller)')
    || !exportText.includes('syncPresentationDeckScrollState(presentationSurfaceEl, presentationDeckTarget)')
  ) {
    throw new Error('expected export PDF pipeline to sync presentation deck scroll state before print cloning')
  }
}
