import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterDocumentSuppressesAutoZoomModes() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected FlowCanvas auto-zoom suppression to target the Flow Editor renderer')
  }
  if (!text.includes('frontmatterModeEnabled')) {
    throw new Error('expected FlowCanvas auto-zoom suppression to gate on frontmatter mode')
  }
  if (!text.includes("documentSemanticMode === 'document'")) {
    throw new Error('expected FlowCanvas auto-zoom suppression to target document semantic mode')
  }
  if (!text.includes('paused: !active || suppressAutoZoomModes')) {
    throw new Error('expected FlowCanvas to pause auto-zoom modes while Flow Editor frontmatter document overlays are active')
  }
}
