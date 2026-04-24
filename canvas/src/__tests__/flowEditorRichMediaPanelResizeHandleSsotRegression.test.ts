import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRichMediaPanelUsesResizeHandleSsot() {
  const p = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('data-kg-resize-handle="se"')) {
    throw new Error('expected RichMediaPanel to render a bottom-right resize handle using data-kg-resize-handle="se"')
  }
}

export function testFlowEditorOverlayProxyTreatsRichMediaResizeHandleAsProtectedHandle() {
  const p = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('[data-kg-resize-handle]')) {
    throw new Error('expected Flow Editor overlay proxy drag-handle selector to include RichMediaPanel resize handles so window-capture proxy pan cannot steal resize drags')
  }
}
