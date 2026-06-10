import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

export function testStrybldrBottomPanelUnpinDragReusesResizeRuntime() {
  const text = readSource('src/features/strybldr/StrybldrTimelineBottomPanel.tsx')
  const required = [
    'bindResizeSeparatorDragRuntime<number>',
    'HorizontalResizeSeparatorHr',
    'bottomSurfaceHeightRatio',
    'setBottomSurfaceHeightRatio',
    'clampTimelineBottomPanelHeightRatio',
    'startPointerDrag',
    'clampOverlayTopLeftToViewport',
    'data-kg-strybldr-bottom-timeline-pinned',
    'data-kg-strybldr-bottom-timeline-drag-enabled',
    'data-kg-strybldr-bottom-timeline-resize-handle="top"',
    "pinned && 'kg-canvas-bottom-panel--pinned'",
    "!pinned && 'cursor-move'",
  ]
  const missing = required.filter(token => !text.includes(token))
  if (missing.length > 0) {
    throw new Error(`expected Strybldr bottom panel unpin/drag/resize shared contract, missing: ${missing.join(', ')}`)
  }
  if (text.includes("bottom: 'calc(var(--kg-safe-bottom)") || text.includes("width: 'min(calc(100% - 1.5rem")) {
    throw new Error('expected bottom panel safe-area geometry to remain in shared responsive CSS')
  }
}
