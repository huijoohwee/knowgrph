import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasRootPanelOnlyHideIsNotGatedByMarkdownOverlayEnabled() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('if (!markdownOverlayEnabled) return null')) {
    throw new Error('expected panelOnlyNodeIdSetForScene to not be gated by markdownOverlayEnabled')
  }
}

