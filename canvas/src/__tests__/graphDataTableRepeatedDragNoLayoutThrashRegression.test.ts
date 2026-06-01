import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphDataTableHeaderReorderDoesNotMeasureAllHeaderCellsOnEveryPointerMove() {
  const p = resolve(process.cwd(), 'src', 'lib', 'graph-data-table', 'ui', 'GraphDataTableTable.impl.tsx')
  const text = readFileSync(p, 'utf8')
  const onMoveIdx = text.indexOf('onMove: mv =>')
  if (onMoveIdx < 0) throw new Error('expected GraphDataTableTable to define reorder onMove handler')
  const snippet = text.slice(onMoveIdx, Math.min(text.length, onMoveIdx + 900))
  if (snippet.includes("querySelectorAll('th[data-kg-col-key]')") || snippet.includes('getBoundingClientRect()')) {
    throw new Error('expected header reorder onMove to avoid per-move DOM scanning/measurement')
  }
}

export function testGraphDataTableFrozenAreaDragIsRafThrottled() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-data-table', 'ui', 'useGraphDataTableFrozenArea.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('requestAnimationFrame')) {
    throw new Error('expected frozen area drag indicator updates to be rAF throttled')
  }
}

export function testMarkdownDesignOverlayBlockDragIsRafThrottled() {
  const p = resolve(process.cwd(), 'src', 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('createRafValueScheduler') || !text.includes('patchById')) {
    throw new Error('expected markdown design block dragging to use shared raf scheduler + patchById')
  }
  const onMoveIdx = text.indexOf('onHeaderDrag={args0 =>')
  if (onMoveIdx < 0) throw new Error('expected markdown design overlay header drag handler')
  const snippet = text.slice(onMoveIdx, Math.min(text.length, onMoveIdx + 700))
  if (snippet.includes('prev.map(')) {
    throw new Error('expected markdown design block drag to avoid mapping all blocks on each move')
  }
}

export function testMarkdownPreviewViewerDoesNotMeasureLayoutAfterStyleWrites() {
  const p = resolve(process.cwd(), 'src', 'lib', 'markdown-core', 'ui', 'MarkdownPreviewViewer.impl.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('__kgMarkdownViewerWidthPx') || text.includes('--kg-scrollbar-width')) {
    throw new Error('expected MarkdownPreviewViewer to remove stale measured-width globals and scrollbar CSS writes')
  }
  if (text.includes('offsetWidth') || text.includes('clientWidth') || text.includes('getBoundingClientRect()')) {
    throw new Error('expected MarkdownPreviewViewer root sizing to avoid synchronous layout reads')
  }
  if (text.includes('style.setProperty')) {
    throw new Error('expected MarkdownPreviewViewer root sizing to stay CSS-owned instead of imperative style writes')
  }
}
