import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorPinnedOverlayWheelAlwaysProxiesUnlessAlt() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'bindNativeInteractions.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('shouldProxyWheelFromOverlay')) {
    throw new Error('expected FlowCanvas to include overlay wheel proxy decision helper')
  }
  if (!text.includes('opts?.isFlowEditor')) {
    throw new Error('expected overlay wheel proxy to accept FlowEditor context')
  }
  const iPinned = text.indexOf('isFlowEditor && overlayPinnedToNode')
  const iScroll = Math.max(text.indexOf('isScrollable'), text.indexOf('scrollHeight'), text.indexOf('overflowY'))
  if (iPinned < 0 || iScroll < 0) throw new Error('expected overlay wheel proxy to include scroll detection and pinned proxy logic')
  if (!(iScroll < iPinned)) throw new Error('expected scroll detection to run before pinned overlay wheel proxy rule')
}
