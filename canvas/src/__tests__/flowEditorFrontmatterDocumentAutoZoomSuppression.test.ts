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
  if (!text.includes('const autoZoomPaused = !active || (suppressAutoZoomModes && !fitToScreenMode && !zoomToSelectionMode)')) {
    throw new Error('expected FlowCanvas to pause auto-zoom only when Flow Editor frontmatter document overlays are active and no explicit auto-zoom mode is enabled')
  }
  if (!text.includes('useAutoZoomModes2d({ viewportW, viewportH, paused: autoZoomPaused })')) {
    throw new Error('expected FlowCanvas to route auto-zoom pause through the explicit autoZoomPaused gate')
  }
}
