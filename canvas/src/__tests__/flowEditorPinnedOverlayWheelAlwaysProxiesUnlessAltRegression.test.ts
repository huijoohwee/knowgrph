import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorPinnedOverlayWheelAlwaysProxiesUnlessAlt() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'interactions', 'wheelAndGesture.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('shouldProxyWheelFromOverlay')) {
    throw new Error('expected FlowCanvas to include overlay wheel proxy decision helper')
  }
  if (!text.includes('opts?.isFlowEditor')) {
    throw new Error('expected overlay wheel proxy to accept FlowEditor context')
  }
  const iPinned = text.indexOf('isFlowEditor && overlayPinnedToNode')
  const iScroll = text.indexOf('shouldKeepWidgetInnerPanelWheel(event, overlayRoot)')
  if (iPinned < 0 || iScroll < 0) throw new Error('expected overlay wheel proxy to include scroll detection and pinned proxy logic')
  if (!(iScroll < iPinned)) throw new Error('expected scroll detection to run before pinned overlay wheel proxy rule')
  const iExplicitZoomIntent = text.indexOf('if (event.ctrlKey === true || event.metaKey === true) return true')
  if (iExplicitZoomIntent < 0) throw new Error('expected overlay wheel proxy to force explicit ctrl/cmd zoom intent through to the canvas')
  if (!(iScroll < iExplicitZoomIntent)) {
    throw new Error('expected widget inner-panel scroll surfaces to win before explicit ctrl/cmd canvas zoom')
  }
  const iHandleWheel = text.indexOf('const handleWheel =')
  const iNativeScroll = text.indexOf('shouldKeepWidgetInnerPanelWheel(e)', iHandleWheel)
  const iNativeViewportWheel = text.indexOf('ctx.viewportWheelController.handleWheel(e)', iHandleWheel)
  if (iHandleWheel < 0 || iNativeScroll < 0 || iNativeViewportWheel < 0) {
    throw new Error('expected native canvas wheel handler to reuse the shared widget inner-panel scroll guard across overlay layers')
  }
  if (!(iHandleWheel < iNativeScroll && iNativeScroll < iNativeViewportWheel)) {
    throw new Error('expected widget inner-panel scroll guard to run before native canvas wheel handling')
  }
}
