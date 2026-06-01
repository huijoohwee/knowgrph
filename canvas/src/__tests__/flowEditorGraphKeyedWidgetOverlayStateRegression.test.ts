import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorOverlayPrefersGraphKeyedWidgetState() {
  const editorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const overlaySurfaceRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const runtimeWidgetStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRuntimeWidgetState.ts')
  const widgetScopePath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'widgetStateScope.ts')
  const editorText = readFileSync(editorPath, 'utf8')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfaceElementsPath, 'utf8')
  const overlaySurfaceRuntimeText = readFileSync(overlaySurfaceRuntimePath, 'utf8')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  const runtimeWidgetStateText = readFileSync(runtimeWidgetStatePath, 'utf8')
  const widgetScopeText = readFileSync(widgetScopePath, 'utf8')

  if (!overlaySurfaceText.includes('const graphMetaKey = buildGraphMetaKeyIgnoringPending(args.renderGraphDataOverride)')) {
    throw new Error('expected Flow Editor overlay surface to pass the active rendered graph key into widget overlays')
  }
  if (!overlaySurfaceRuntimeText.includes("import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'")) {
    throw new Error('expected Flow Editor overlay surface to reuse the shared scoped widget-state helper for auto-pin seeding')
  }
  if (!overlaySurfaceRuntimeText.includes("import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'")) {
    throw new Error('expected Flow Editor overlay surface to derive the active render graph key before auto-pin seeding')
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
  if (!overlaySurfaceRuntimeText.includes('const renderGraphMetaKey = React.useMemo(')) {
    throw new Error('expected Flow Editor overlay surface to memoize one active render graph key for scoped auto-pin seeding')
  }
  if (!overlaySurfaceRuntimeText.includes('const pinnedById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor overlay surface auto-pin seeding to read pinned state from the active graph scope')
  }
  if (overlaySurfaceRuntimeText.includes('const pinnedById = st.flowWidgetPinnedByNodeId || {}')) {
    throw new Error('expected Flow Editor overlay surface auto-pin seeding to forbid direct global pinned-state fallback')
  }
  if (!widgetScopeText.includes('export function resolveFlowWidgetStateGraphKey')) {
    throw new Error('expected Flow Editor widget overlay state scope to centralize render-graph-key resolution in a shared helper')
  }
  if (!widgetScopeText.includes('if (graphKey) return args.keyedByGraphMetaKey?.[graphKey] || (EMPTY_SCOPED_FLOW_WIDGET_NODE_MAP as Record<string, T>)')) {
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
  if (!runtimeText.includes("const storedWorld = currentStoredWorld || (floatingUsesScreenAuthority ? null : widgetWorldPosRef.current)")) {
    throw new Error('expected Flow Editor widget placement loop to prefer current graph-keyed world SSOT and only suppress stale cached world fallback for screen-authority floating overlays')
  }
  if (!runtimeSceneText.includes('const graphKey = buildGraphMetaKeyIgnoringPending(graphDataForSeeding)')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to write graph-keyed world positions under the active render graph key before falling back to store graph state')
  }
  if (!runtimeSceneText.includes('useFlowEditorWidgetStateDependencyCounts')) {
    throw new Error('expected Flow Editor runtime scene to delegate hot-path widget dependency counts to the shared runtime helper')
  }
  if (!runtimeWidgetStateText.includes("import { useShallow } from 'zustand/react/shallow'")) {
    throw new Error('expected Flow Editor runtime scene to select widget state through a shallow store selector')
  }
  if (!runtimeWidgetStateText.includes('const state = useGraphStore(useShallow(s => ({')) {
    throw new Error('expected Flow Editor runtime scene to gather widget state refs without rebuilding graph identity inside store selectors')
  }
  if (!runtimeWidgetStateText.includes('const graphKey = React.useMemo(() => buildGraphMetaKeyIgnoringPending(state.graphData), [state.graphData])')) {
    throw new Error('expected Flow Editor runtime scene to memoize the active graph key for widget dependency counts')
  }
  if (!runtimeWidgetStateText.includes('const flowWidgetWorldPosCount = React.useMemo(() => Object.keys(resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor runtime scene to memoize scoped world-position dependency counts')
  }
  if (!runtimeWidgetStateText.includes('const flowWidgetPinnedCount = React.useMemo(() => Object.keys(resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor runtime scene to memoize scoped pinned-state dependency counts')
  }
  if (runtimeSceneText.includes('const flowWidgetWorldPosCount = useGraphStore(s => {') || runtimeWidgetStateText.includes('const flowWidgetWorldPosCount = useGraphStore(s => {')) {
    throw new Error('expected Flow Editor runtime scene to avoid rebuilding graph keys inside world-position store selectors')
  }
  if (runtimeSceneText.includes('const flowWidgetPinnedCount = useGraphStore(s => {') || runtimeWidgetStateText.includes('const flowWidgetPinnedCount = useGraphStore(s => {')) {
    throw new Error('expected Flow Editor runtime scene to avoid rebuilding graph keys inside pinned-state store selectors')
  }
  if (!runtimeSceneText.includes("import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'")) {
    throw new Error('expected Flow Editor runtime scene to reuse the shared scoped widget-state helper before reading workspace-blocked widget state')
  }
  if (!runtimeSceneText.includes('const pinnedById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to read pinned state from the active graph scope')
  }
  if (!runtimeSceneText.includes('const posById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to read floating screen positions from the active graph scope')
  }
  if (!runtimeSceneText.includes('const worldById = resolveScopedFlowWidgetNodeMap({')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to read world positions from the active graph scope')
  }
  if (runtimeSceneText.includes('const pinnedById = st.flowWidgetPinnedByNodeId || {}')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to forbid direct global pinned-state fallback')
  }
  if (runtimeSceneText.includes('const posById =\n      (st as unknown as { flowWidgetPosByNodeId?: Record<string, { top: number; left: number }> })')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to forbid direct global floating-position fallback')
  }
  if (runtimeSceneText.includes('const worldById =\n      (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })')) {
    throw new Error('expected Flow Editor runtime scene workspace-blocked widget seeding to forbid direct global world-position fallback')
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
