import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildForwardFlowEdgePathD } from '@/lib/graph/edgeTypes'

const readFirstLineCoordinate = (pathD: string, axis: 'x' | 'y'): number | null => {
  const match = /^M[^L]+ L(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(pathD)
  if (!match) return null
  const value = Number(axis === 'x' ? match[1] : match[2])
  return Number.isFinite(value) ? value : null
}

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
  const designWireframePath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasWireframeDecor.ts')
  const designWireframeText = readFileSync(designWireframePath, 'utf8')
  const storyboardWidgetPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlayEdges.ts')
  const storyboardWidgetText = readFileSync(storyboardWidgetPath, 'utf8')
  const storyboardAnchorPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetOverlayEdgeAnchors.ts')
  const storyboardAnchorText = readFileSync(storyboardAnchorPath, 'utf8')
  const flowScenePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'buildNativeScene.ts')
  const flowSceneText = readFileSync(flowScenePath, 'utf8')
  const flowRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'nativeRuntime.ts')
  const flowRuntimeText = readFileSync(flowRuntimePath, 'utf8')
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
  if (!designWireframeText.includes('const wireframeEdgeStroke = readGlobalEdgeColor(schema)')) {
    throw new Error('expected Design renderer wireframe edge stroke to reuse shared global edge color SSOT')
  }
  if (!storyboardWidgetText.includes('const edgeAnimated = readGlobalEdgeAnimationEnabled(schema)')) {
    throw new Error('expected Storyboard Widget overlay edge animation to reuse shared global edge animation helper')
  }
  if (!storyboardWidgetText.includes('const globalEdgeColor = readGlobalEdgeColor(schema)')) {
    throw new Error('expected Storyboard Widget overlay edge stroke to reuse shared global edge color helper')
  }
  if (!designWireframeText.includes('const edgeType = readGlobalEdgeType(schema)')) {
    throw new Error('expected Design renderer edge type to derive from shared global edge-type SSOT')
  }
  if (!storyboardWidgetText.includes('const globalEdgeType = readGlobalEdgeType(schema)')) {
    throw new Error('expected Storyboard Widget overlay edge type to derive from shared global edge-type SSOT')
  }
  if (!edgeTypesText.includes('export const buildForwardFlowEdgePathD')) {
    throw new Error('expected shared 2D edge owner to expose forward-flow path construction')
  }
  if (!edgeTypesText.includes('flowForwardTrack?: boolean')) {
    throw new Error('expected shared 2D edge owner to carry the forward-flow routing flag')
  }
  if (!storyboardAnchorText.includes('return buildForwardFlowEdgePathD(args)')) {
    throw new Error('expected Storyboard overlay edges to use shared forward-flow path construction')
  }
  if (storyboardAnchorText.includes('buildStoryboardForwardTrackPath')) {
    throw new Error('expected Storyboard overlay edges not to keep a local forward-track path fork')
  }
  if (!flowSceneText.includes('buildGraphFlowOrderIndexByNodeId') || !flowSceneText.includes('resolveGraphEdgeFlowOrderDirection')) {
    throw new Error('expected Flow native scene construction to derive forward-flow edges from the shared flow-order helper')
  }
  if (!flowSceneText.includes('flowForwardTrack')) {
    throw new Error('expected Flow native scene edges to carry shared forward-flow routing state')
  }
  if (!flowRuntimeText.includes('flowForwardTrack?: boolean') || !flowRuntimeText.includes('flowForwardTrack: e.flowForwardTrack === true')) {
    throw new Error('expected Flow native runtime to pass shared forward-flow routing state into the shared edge tracer')
  }
  if (!d3LinksText.includes("readEffectiveEdgeTypeFor2dRenderer({ schema, canvas2dRenderer: 'd3' })")) {
    throw new Error('expected Flowchart/D3 renderer edge path type resolution to reuse the shared 2D edge-type helper')
  }
}

export function testForwardFlowEdgeRoutingSharedAcross2dRendererSurfaces() {
  const lrSourceX = 520
  const lrPath = buildForwardFlowEdgePathD({
    edgeType: 'smoothstep',
    flowForwardTrack: true,
    rankdir: 'LR',
    sx: lrSourceX,
    sy: 180,
    tx: 120,
    ty: 180,
  })
  const lrBaselinePath = buildForwardFlowEdgePathD({
    edgeType: 'smoothstep',
    rankdir: 'LR',
    sx: lrSourceX,
    sy: 180,
    tx: 120,
    ty: 180,
  })
  const lrFirstX = readFirstLineCoordinate(lrPath, 'x')
  const lrBaselineFirstX = readFirstLineCoordinate(lrBaselinePath, 'x')
  if (lrFirstX == null || lrFirstX <= lrSourceX) {
    throw new Error(`expected shared LR forward-flow path to move forward first, got ${lrPath}`)
  }
  if (lrBaselineFirstX == null || lrBaselineFirstX >= lrSourceX) {
    throw new Error(`expected baseline LR smoothstep path to preserve normal reverse geometry, got ${lrBaselinePath}`)
  }

  const tbSourceY = 520
  const tbPath = buildForwardFlowEdgePathD({
    edgeType: 'smoothstep',
    flowForwardTrack: true,
    rankdir: 'TB',
    sx: 180,
    sy: tbSourceY,
    tx: 180,
    ty: 120,
  })
  const tbBaselinePath = buildForwardFlowEdgePathD({
    edgeType: 'smoothstep',
    rankdir: 'TB',
    sx: 180,
    sy: tbSourceY,
    tx: 180,
    ty: 120,
  })
  const tbFirstY = readFirstLineCoordinate(tbPath, 'y')
  const tbBaselineFirstY = readFirstLineCoordinate(tbBaselinePath, 'y')
  if (tbFirstY == null || tbFirstY <= tbSourceY) {
    throw new Error(`expected shared TB forward-flow path to move forward first, got ${tbPath}`)
  }
  if (tbBaselineFirstY == null || tbBaselineFirstY >= tbSourceY) {
    throw new Error(`expected baseline TB smoothstep path to preserve normal reverse geometry, got ${tbBaselinePath}`)
  }
}
