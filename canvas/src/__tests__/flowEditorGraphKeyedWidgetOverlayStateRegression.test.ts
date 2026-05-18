import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayPrefersGraphKeyedWidgetState() {
  const editorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const widgetScopePath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'widgetStateScope.ts')
  const editorText = readFileSync(editorPath, 'utf8')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  const widgetScopeText = readFileSync(widgetScopePath, 'utf8')

  if (!overlaySurfaceText.includes('const graphMetaKey = buildGraphMetaKeyIgnoringPending(args.renderGraphDataOverride)')) {
    throw new Error('expected Flow Editor overlay surface to pass the active rendered graph key into widget overlays')
  }
  if (!overlaySurfaceText.includes('graphMetaKey={graphMetaKey}')) {
    throw new Error('expected Flow Editor overlay surface to thread the active rendered graph key into widget overlay props')
  }
  if (!overlaySurfaceText.includes('const overlayInstanceKey = [')) {
    throw new Error('expected Flow Editor overlay surface to derive one remount key for widget overlays from surface and graph identity')
  }
  if (!overlaySurfaceText.includes("String(args.flowEditorSurfaceId || '').trim() || 'surface'")) {
    throw new Error('expected Flow Editor overlay remount key to include surface identity so stale portal instances cannot survive across surfaces')
  }
  if (!overlaySurfaceText.includes("String(args.renderGraphSemanticKey || '').trim() || String(graphMetaKey || '').trim() || 'graph'")) {
    throw new Error('expected Flow Editor overlay remount key to prefer the semantic render-graph identity before falling back to graph meta kind')
  }
  if (!overlaySurfaceText.includes('key={overlayInstanceKey}')) {
    throw new Error('expected Flow Editor widget overlays to remount when surface or graph identity changes')
  }
  if (!widgetScopeText.includes('export function resolveFlowWidgetStateGraphKey')) {
    throw new Error('expected Flow Editor widget overlay state scope to centralize render-graph-key resolution in a shared helper')
  }
  if (!widgetScopeText.includes('if (graphKey) return args.keyedByGraphMetaKey?.[graphKey] || {}')) {
    throw new Error('expected Flow Editor widget state scope to read keyed widget state exclusively whenever an active graph key exists')
  }
  if (!editorText.includes('return readScopedFlowWidgetNodeValue({')) {
    throw new Error('expected Flow Editor widget overlay readers to resolve floating screen state through the shared scoped widget-state helper')
  }
  if (!editorText.includes('return typeof document === \'undefined\' ? overlayElement : createPortal(overlayElement, document.body)')) {
    throw new Error('expected Flow Editor widget overlays to keep the global body portal contract so fixed-position overlays stay in viewport coordinates')
  }
  if (!editorText.includes('keyedByGraphMetaKey: state.flowWidgetPinnedByNodeIdByGraphMetaKey')) {
    throw new Error('expected Flow Editor widget pin reads to route through graph-keyed state via the shared scoped helper')
  }
  if (editorText.includes("?? s.flowWidgetPosByNodeId?.[nodeId]")) {
    throw new Error('expected Flow Editor widget overlay readers to forbid global screen-position fallback when an active render-graph key is available')
  }
  if (editorText.includes("?? state.flowWidgetPinnedByNodeId?.[id]")) {
    throw new Error('expected Flow Editor widget pin reads to forbid global pinned-state fallback when an active render-graph key is available')
  }
  if (!runtimeText.includes('const graphKey = resolveFlowWidgetStateGraphKey({')) {
    throw new Error('expected Flow Editor widget placement runtime to centralize render-graph-key resolution before writing scoped widget state')
  }
  if (!runtimeText.includes('const prevWorld = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor widget placement runtime to build keyed world-position writes from the active scoped state, not from global caches')
  }
  if (!runtimeText.includes('const currentStoredWorld = readStoredWidgetWorldPos()')) {
    throw new Error('expected Flow Editor widget placement loop to resolve current graph-keyed world positions at render time, not only through subscription warmup')
  }
  if (!runtimeText.includes('return readScopedFlowWidgetNodeValue({')) {
    throw new Error('expected Flow Editor widget placement runtime to resolve stored world positions through the shared scoped widget-state helper')
  }
  if (runtimeText.includes("?? state.flowWidgetWorldPosByNodeId?.[nodeId]")) {
    throw new Error('expected Flow Editor widget placement runtime to forbid global world-position fallback when an active render-graph key is available')
  }
  if (!runtimeText.includes("const storedWorld = floatingUsesScreenAuthority ? null : (currentStoredWorld || widgetWorldPosRef.current)")) {
    throw new Error('expected Flow Editor widget placement loop to prefer live graph-keyed world SSOT before falling back to the cached widget world ref')
  }
  if (!runtimeSceneText.includes('const graphKey = buildGraphMetaKeyIgnoringPending(graphDataForSeeding || prevState.graphData || null)')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to write graph-keyed world positions under the active render graph key before falling back to store graph state')
  }
}

export function testFlowEditorOverlayCollisionPrefersGraphKeyedWidgetState() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const collisionText = readFileSync(collisionPath, 'utf8')

  if (!collisionText.includes("import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'")) {
    throw new Error('expected Flow Editor overlay collision runtime to derive the active render-graph key before reading widget state')
  }
  if (!collisionText.includes("import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'")) {
    throw new Error('expected Flow Editor overlay collision runtime to reuse the shared scoped widget-state helper')
  }
  if (!collisionText.includes('const graphKey = buildGraphMetaKeyIgnoringPending(graphDataForOverlayRuntime)')) {
    throw new Error('expected Flow Editor overlay collision runtime to derive one graph key from the active overlay graph source')
  }
  if (!collisionText.includes('const pinnedById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor overlay collision runtime to read pinned state from graph-keyed widget state')
  }
  if (!collisionText.includes('const posById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor overlay collision runtime to read floating screen positions from graph-keyed widget state')
  }
  if (!collisionText.includes('const worldById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor overlay collision runtime to read widget world positions from graph-keyed widget state')
  }
  if (!collisionText.includes('const shouldWriteGraphScopedInMemory = !!graphKey && graphKey !== storeGraphKey')) {
    throw new Error('expected Flow Editor overlay collision runtime to avoid writing scoped overlay layout through the wrong graph setter context')
  }
  if (!collisionText.includes('flowWidgetPosByNodeIdByGraphMetaKey')) {
    throw new Error('expected Flow Editor overlay collision runtime to persist and subscribe to graph-keyed floating positions')
  }
  if (!collisionText.includes('flowWidgetWorldPosByNodeIdByGraphMetaKey')) {
    throw new Error('expected Flow Editor overlay collision runtime to persist and subscribe to graph-keyed world positions')
  }
  if (!collisionText.includes('flowWidgetPinnedByNodeIdByGraphMetaKey')) {
    throw new Error('expected Flow Editor overlay collision runtime to subscribe to graph-keyed pinned state')
  }
}
