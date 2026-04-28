import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testEdgeTypeSsotSharedAcross2dRenderersAndToolbarWriters() {
  const edgeTypesPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'edgeTypes.ts')
  const edgeTypesText = readFileSync(edgeTypesPath, 'utf8')
  const toolbarPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'ToolbarToolMenuRendererView.tsx')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const edgeSettingsPath = resolve(process.cwd(), 'src', 'features', 'toolbar', 'ui', 'EdgeTypesRendererSettings.tsx')
  const edgeSettingsText = readFileSync(edgeSettingsPath, 'utf8')
  const flowPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'presentation.ts')
  const flowText = readFileSync(flowPath, 'utf8')
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')
  const designPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const designText = readFileSync(designPath, 'utf8')
  const flowEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const flowEditorText = readFileSync(flowEditorPath, 'utf8')
  const d3LinksPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'links.ts')
  const d3LinksText = readFileSync(d3LinksPath, 'utf8')

  if (!edgeTypesText.includes('export const withGlobalEdgeType')) {
    throw new Error('expected shared edge type schema writer helper for renderer SSOT reuse')
  }
  if (edgeTypesText.includes("if (renderer === 'd3') return 'straight'")) {
    throw new Error('expected renderer-specific straight-only applicability to be removed from shared edge-type SSOT')
  }
  if (!edgeTypesText.includes('getGlobalEdgeTypeOptionsFor2dRenderer')) {
    throw new Error('expected edge type options to be centralized in shared per-renderer helper')
  }
  if (!edgeTypesText.includes('return GLOBAL_EDGE_TYPE_OPTIONS')) {
    throw new Error('expected 2D renderer edge type options helper to keep the shared global option set')
  }
  if (edgeTypesText.includes("option.value === 'straight'")) {
    throw new Error('expected no renderer-specific straight-only option filtering in shared edge-type options helper')
  }
  if (!toolbarText.includes('withGlobalEdgeType(current, next)')) {
    throw new Error('expected FloatingPanel renderer edge-type updates to use shared edge-type SSOT writer helper')
  }
  if (!toolbarText.includes('WORKSPACE_SYNC_TASK_RENDERER_EDGE_TYPE_VIEW_STATE')) {
    throw new Error('expected FloatingPanel renderer edge-type updates to use shared coalesced scheduler task key')
  }
  if (!edgeSettingsText.includes('withGlobalEdgeType(current, next)')) {
    throw new Error('expected edge type settings fallback updates to use shared edge-type SSOT writer helper')
  }
  if (!edgeSettingsText.includes('withGlobalEdgeThicknessPx(current, nextRaw)')) {
    throw new Error('expected edge thickness settings to use shared global edge thickness writer helper')
  }
  if (!edgeSettingsText.includes('withGlobalEdgeColor(current, nextRaw)')) {
    throw new Error('expected edge color settings to use shared global edge color writer helper')
  }
  if (!edgeSettingsText.includes('GLOBAL_EDGE_COLOR_OPTIONS.map')) {
    throw new Error('expected edge color selector options to reuse shared global edge color option set')
  }
  if (!edgeSettingsText.includes('withGlobalEdgeAnimationEnabled(current, next)')) {
    throw new Error('expected edge animation settings to use shared global edge animation writer helper')
  }
  if (!edgeSettingsText.includes('readEffectiveEdgeTypeFor2dRenderer')) {
    throw new Error('expected edge type settings view to derive effective edge type from shared renderer applicability helper')
  }
  if (edgeSettingsText.includes('disabled={forceStraightOnly}')) {
    throw new Error('expected edge type selector to stay writable across all 2D renderers')
  }
  if (!edgeSettingsText.includes('Default is Bezier with animated blue edges.')) {
    throw new Error('expected edge type settings copy to reflect bezier default and animated blue edge defaults')
  }
  if (!edgeSettingsText.includes('Color')) {
    throw new Error('expected edge settings panel to expose edge color selector')
  }
  if (!edgeSettingsText.includes('WORKSPACE_SYNC_SCOPE_RENDERER_EDGE_TYPE_RUNTIME_PERSISTENCE')) {
    throw new Error('expected edge type settings fallback updates to reuse shared runtime/persistence scope key')
  }
  if (!flowText.includes('edgeType: readGlobalEdgeType(s)')) {
    throw new Error('expected Flow renderer presentation edge type to derive from shared global edge-type SSOT')
  }
  if (!flowText.includes('strokeWidthPx: readGlobalEdgeThicknessPx(s)')) {
    throw new Error('expected Flow renderer presentation edge thickness to derive from shared global edge-thickness SSOT')
  }
  if (!flowText.includes('animated: readGlobalEdgeAnimationEnabled(s)')) {
    throw new Error('expected Flow renderer presentation edge animation to derive from shared global edge-animation SSOT')
  }
  if (flowCanvasText.includes('frontmatterFlowRenderSettings?.edgeType || base.edges.edgeType')) {
    throw new Error('expected Flow canvas frontmatter mode to keep global edge-type SSOT without local edge-type override')
  }
  if (!designText.includes('const wireframeEdgeStroke = readGlobalEdgeColor(snapshot.schema)')) {
    throw new Error('expected Design renderer wireframe edge stroke to reuse shared global edge color SSOT')
  }
  if (!flowEditorText.includes('const edgeAnimated = readGlobalEdgeAnimationEnabled(schema)')) {
    throw new Error('expected Flow Editor overlay edge animation to reuse shared global edge animation helper')
  }
  if (!flowEditorText.includes('const globalEdgeColor = readGlobalEdgeColor(schema)')) {
    throw new Error('expected Flow Editor overlay edge stroke to reuse shared global edge color helper')
  }
  if (!designText.includes('const edgeType = readGlobalEdgeType(snapshot.schema)')) {
    throw new Error('expected Design renderer edge type to derive from shared global edge-type SSOT')
  }
  if (!flowEditorText.includes('const globalEdgeType = readGlobalEdgeType(schema)')) {
    throw new Error('expected Flow Editor overlay edge type to derive from shared global edge-type SSOT')
  }
  if (!d3LinksText.includes("readEffectiveEdgeTypeFor2dRenderer({ schema, canvas2dRenderer: 'd3' })")) {
    throw new Error('expected Flowchart/D3 renderer edge path type resolution to reuse the shared 2D edge-type helper')
  }
}
