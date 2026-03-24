import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testWorkspaceEditorOverlayDoesNotInstallBlockingScrim() {
  const p = resolve(process.cwd(), 'src', 'features', 'markdown-edgeless', 'MarkdownDesignOverlay.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('pointer-events-none')) {
    throw new Error('expected MarkdownDesignOverlay root to be pointer-events-none by default')
  }
  if (!text.includes("pointerEvents: 'none'")) {
    throw new Error('expected MarkdownDesignOverlay drag mask to be pointerEvents none')
  }
}

export function testGraphDataTableOverlayDoesNotUseFullscreenScrim() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-data-table', 'ui', 'GraphDataTablePanelOverlay.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('inset: 0') || text.includes('inset-0') || text.includes('fixed inset-0')) {
    throw new Error('expected GraphDataTablePanelOverlay not to render a fullscreen scrim')
  }
}
