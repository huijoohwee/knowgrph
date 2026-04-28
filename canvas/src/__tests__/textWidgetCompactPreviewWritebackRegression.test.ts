import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testTextWidgetCompactPreviewKeepsRawTextWhileTyping() {
  const filePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(filePath, 'utf8')

  if (!text.includes("nextText === '' ? undefined : nextText")) {
    throw new Error('expected text widget compact preview writeback to preserve raw text instead of trimming on every keystroke')
  }
  if (text.includes("nextText.trim() ? nextText : undefined")) {
    throw new Error('expected text widget compact preview writeback to stop trimming live text edits')
  }
}
