import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorWorkspaceFrontmatterPreInitSuppressionKeepsRenderableGraphsOffEarlyDrawPath() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  if (!runtimeText.includes("import { isFlowEditorFrontmatterDocumentModeRequested } from '@/lib/graph/frontmatterMode'")) {
    throw new Error('expected Flow runtime workspace-open pre-init draw suppression to reuse the shared Flow Editor frontmatter document mode helper')
  }
  if (!runtimeText.includes('const frontmatterDocumentModeRequested = isFlowEditorFrontmatterDocumentModeRequested({')) {
    throw new Error('expected Flow runtime workspace-open pre-init draw suppression to derive one shared frontmatter document mode flag')
  }
  if (!runtimeText.includes('if (hasRenderableGraphNodes && !frontmatterDocumentModeRequested) return false')) {
    throw new Error('expected Flow runtime workspace-open pre-init draw suppression to keep Flow Editor frontmatter document mode off the generic renderable-graph early-draw path')
  }
  if (!runtimeText.includes('const graphDataForFit = graphDataForZoomRequests || graphDataForZoom || sceneGraphData || null')
    || runtimeText.includes('if (!runtime || !graphDataForZoom) return')) {
    throw new Error('expected Flow runtime pre-init fit to reuse the same current graph source family as workspace-open draw suppression, avoiding a stale missing graphDataForZoom deadlock')
  }
  if (!runtimeText.includes("__flowCanvasDebug.lastRecoveryReason = 'workspace-open-preinit-draw-suppressed'")) {
    throw new Error('expected Flow runtime workspace-open frontmatter pre-init draw suppression to emit the deterministic debug reason')
  }
}
