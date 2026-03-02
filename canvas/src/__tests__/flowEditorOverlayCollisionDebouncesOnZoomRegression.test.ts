import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayCollisionDebouncesOnZoom() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('pinnedToNodeByIdRef') || text.includes('anyEditorPinnedToNode')) {
    throw new Error('expected FlowEditorCanvas to avoid legacy pinned editor tracking state')
  }
  if (!text.includes('overlayCollisionZoomDebounceRef')) {
    throw new Error('expected FlowEditorCanvas to debounce overlay collision resolve on zoom')
  }
  if (!text.includes('setTimeout') || !text.includes('clearTimeout')) {
    throw new Error('expected FlowEditorCanvas zoom-driven collision resolving to use time-based debounce')
  }
  if (text.includes('attributeFilter') && text.includes('data-kg-node-quick-editor')) {
    throw new Error('expected FlowEditorCanvas to avoid mutation observers for overlay tracking')
  }
}
