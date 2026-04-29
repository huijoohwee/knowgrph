import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterDocumentSkipsSyntheticMediaFitBounds() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasLayoutState.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes("canvas2dRenderer === 'flowEditor'")) {
    throw new Error('expected FlowCanvas fit isolation to target the Flow Editor renderer')
  }
  if (!text.includes("documentSemanticMode === 'document'")) {
    throw new Error('expected FlowCanvas fit isolation to target frontmatter document semantic mode')
  }
  if (!text.includes('if (flowEditorFrontmatterDocumentMode) return nodesForFlowZoom')) {
    throw new Error('expected FlowCanvas fit graph derivation to skip synthetic media panel bounds in Flow Editor frontmatter document mode')
  }
}
