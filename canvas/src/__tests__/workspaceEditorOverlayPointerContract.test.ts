import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readMarkdownDesignOverlaySourceText(): string {
  const base = resolve(process.cwd(), 'src')
  const candidatePaths = [
    resolve(base, 'features', 'markdown-edgeless', 'MarkdownDesignOverlay.tsx'),
    resolve(base, 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'),
  ]
  let latest = ''
  for (let i = 0; i < candidatePaths.length; i += 1) {
    const text = readFileSync(candidatePaths[i], 'utf8')
    latest = text
    if (text.includes('pointer-events-none') || text.includes("pointerEvents: 'none'")) {
      return text
    }
  }
  return latest
}

export function testWorkspaceEditorOverlayDoesNotInstallBlockingScrim() {
  const text = readMarkdownDesignOverlaySourceText()
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
