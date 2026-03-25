import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRichMediaPanelEditorModeDisablesInteractiveContentForDragging() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("workspaceViewMode") || !text.includes("editorMode")) {
    throw new Error('expected RichMediaPanel to read workspaceViewMode to gate editor-mode drag behavior')
  }
  if (!text.includes("pointerEvents: editorMode ? 'none'")) {
    throw new Error('expected RichMediaPanel to disable media element pointerEvents in editor mode')
  }
  if (!text.includes('allowClickToOpenOverlay')) {
    throw new Error('expected RichMediaPanel to gate click-to-open overlay outside editor mode')
  }
}

