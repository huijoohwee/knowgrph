import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readOverlayCollisionSection(text: string): string {
  const start = text.indexOf('const overlayCollisionResolveRafRef = React.useRef<number | null>(null)')
  const end = text.indexOf('const overlayEdgesSvgRef = React.useRef<SVGSVGElement | null>(null)')
  if (start < 0 || end <= start) return ''
  return text.slice(start, end)
}

export function testFlowEditorOverlayCollisionStaysStableAcrossZoomInteractionFrames() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  const collisionSection = readOverlayCollisionSection(text)
  if (text.includes('pinnedToNodeByIdRef') || text.includes('anyEditorPinnedToNode')) {
    throw new Error('expected FlowEditorCanvas to avoid legacy pinned editor tracking state')
  }
  if (text.includes('overlayCollisionZoomDebounceRef')) {
    throw new Error('expected FlowEditorCanvas to avoid zoom-debounce-driven collision mutation scheduling')
  }
  if (text.includes('overlayCollisionLastZoomKRef')) {
    throw new Error('expected FlowEditorCanvas to avoid zoom-k tracking for collision scheduling')
  }
  if (!collisionSection) {
    throw new Error('expected FlowEditorCanvas to keep a distinct overlay collision section')
  }
  if (collisionSection.includes('FLOW_EDITOR_INTERACTION_FRAME_EVENT')) {
    throw new Error('expected overlay collision section to avoid zoom interaction-frame listeners')
  }
  if (collisionSection.includes('setTimeout(') || collisionSection.includes('clearTimeout(')) {
    throw new Error('expected overlay collision section to avoid timeout-based zoom mutation scheduling')
  }
  if (!collisionSection.includes('}, [active, openQuickEditorNodeIds, overlayOnlyModeEnabled, scheduleOverlayCollisionResolve, viewportH, viewportW])')) {
    throw new Error('expected overlay collision scheduler effect deps to stay scoped to structural/viewport changes only')
  }
  if (text.includes('attributeFilter') && text.includes('data-kg-node-quick-editor')) {
    throw new Error('expected FlowEditorCanvas to avoid mutation observers for overlay tracking')
  }
}
