import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
export function testFlowEditorFrontmatterUsesFlowFilterForWidgetOverlays() {
  const flowEditorRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const flowEditorSharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const canvasViewportText = readFileSync(resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx'), 'utf8')
  const runtimeText = readFileSync(flowEditorRuntimePath, 'utf8')
  const sharedText = readFileSync(flowEditorSharedPath, 'utf8')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const frontmatterOverlayNodeIdsText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'frontmatterOverlayNodeIds.ts'), 'utf8')
  const registryHelperText = readFileSync(resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'resolveWidgetRegistry.ts'), 'utf8')
  if (!sharedText.includes('filterGraphToFlowWidgetEligible')) {
    throw new Error('expected FlowEditorCanvas shared graph derivation to filter view graph using flow widget eligibility filtering')
  }
  if (sharedText.includes('filterGraphToFrontmatterMermaid')) {
    throw new Error('expected shared frontmatter-flow widget derivation to avoid frontmatter-mermaid filtering')
  }
  if (!sharedText.includes('isFrontmatterFlowGraph')) {
    throw new Error('expected shared flow editor helpers to use frontmatter-flow graph detection')
  }
  if (!overlaySurfaceText.includes('if (isFrontmatterFlow) {')) {
    throw new Error('expected overlay node derivation to branch explicitly for frontmatter-flow overlay ownership')
  }
  if (!frontmatterOverlayNodeIdsText.includes('readWidgetRegistryMetadataEntries')) {
    throw new Error('expected shared frontmatter-flow overlay derivation to reuse the shared widget-registry metadata reader SSOT')
  }
  if (!frontmatterOverlayNodeIdsText.includes('if (!node || !isCanonicalFrontmatterBuiltInWidgetNode(node)) continue')) {
    throw new Error('expected registry-backed frontmatter overlay ids to keep canonical built-in widget/media nodes')
  }
  if (!frontmatterOverlayNodeIdsText.includes('isNodeOwnedFrontmatterWidgetRegistryEntry({ node, registryEntry: { formId } })')) {
    throw new Error('expected registry-backed frontmatter overlay ids to require exact node-owned form identity')
  }
  if (!frontmatterOverlayNodeIdsText.includes('if (allowedFlowNodeIds.size === 0) return []')) {
    throw new Error('expected shared frontmatter-flow overlay derivation to avoid synthetic fallback when registry ids are missing')
  }
  if (!frontmatterOverlayNodeIdsText.includes('for (const id of eligibleIds) allowedFlowNodeIds.add(id)')) {
    throw new Error('expected shared frontmatter-flow overlay derivation to include shared eligible node ids')
  }
  if (!frontmatterOverlayNodeIdsText.includes("if (!allowedFlowNodeIds.has(id)) continue")) {
    throw new Error('expected shared frontmatter-flow overlay derivation to exclude non-flow ids from overlay editors')
  }
  if (!registryHelperText.includes('export function isNodeOwnedFrontmatterWidgetRegistryEntry(')) {
    throw new Error('expected shared widget registry helpers to expose node-owned frontmatter form identity checks')
  }
  if (!overlaySurfaceText.includes('const sorted = renderGraphPlacementContext?.frontmatterOverlayNodeIds || []')) {
    throw new Error('expected frontmatter-flow overlay surface to reuse the shared overlay-id set from the placement context')
  }
  if (!overlaySurfaceText.includes('flowEditorFrontmatterGraphAvailable || activeSourceFrontmatterFlowAvailable')) {
    throw new Error('expected frontmatter-flow availability to suppress non-frontmatter widget fallback ids through the dedicated branch')
  }
  if (!overlaySurfaceText.includes("import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'")) {
    throw new Error('expected Flow Editor overlay surface to read the active Source Files path from the shared markdown explorer store')
  }
  if (!overlaySurfaceText.includes('const explorerActivePath = useMarkdownExplorerStore(s => s.activePath)')
    || !overlaySurfaceText.includes('explorerActivePath,')
    || !overlaySurfaceText.includes('[explorerActivePath, markdownDocumentName, sourceFiles]')) {
    throw new Error('expected Flow Editor overlay surface to resolve active frontmatter source files by explorer active path, not only markdown document name')
  }
  if (!canvasViewportText.includes("import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'")
    || !canvasViewportText.includes("import { resolvePreferredEnabledComposedSourceFile } from '@/features/source-files/composedSourceSelection'")
    || !canvasViewportText.includes("import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'")) {
    throw new Error('expected CanvasViewport to reuse shared active source and frontmatter-flow helpers for Flow Editor surface arbitration')
  }
  if (!canvasViewportText.includes('const activeSourceFile = React.useMemo(')
    || !canvasViewportText.includes('resolvePreferredEnabledComposedSourceFile({')
    || !canvasViewportText.includes('const explorerActivePath = useMarkdownExplorerStore(s => s.activePath)')
    || !canvasViewportText.includes('[explorerActivePath, markdownDocumentName, sourceFiles]')) {
    throw new Error('expected CanvasViewport to resolve the active Source Files graph by explorer active path during workspace transitions')
  }
  if (!canvasViewportText.includes('const workspaceFrontmatterFlowEditorSurfaceActive = workspaceEditorOverlayOpen === true')
    || !canvasViewportText.includes('isFrontmatterFlowGraph(activeGraphData)')
    || !canvasViewportText.includes('isFrontmatterFlowGraph(activeSourceFile?.parsedGraphData)')
    || !canvasViewportText.includes("const active2dSurface = workspaceFrontmatterFlowEditorSurfaceActive ? 'flowEditor' : rawActive2dSurface")) {
    throw new Error('expected CanvasViewport to keep Flow Editor as the active surface while the active Source Files graph is frontmatter-flow')
  }
  if (!canvasViewportText.includes('const documentSwitchBlocksCanvas = documentSwitchPending && !workspaceFrontmatterFlowEditorSurfaceActive')
    || !canvasViewportText.includes("!documentSwitchBlocksCanvas && !geospatialOverlayOwnsViewport && canvasRenderMode === '2d'")
    || !canvasViewportText.includes('{documentSwitchBlocksCanvas ? (')) {
    throw new Error('expected CanvasViewport document-switch gating to avoid blanking Flow Editor when source graph authority is already frontmatter-flow')
  }
  if (!overlaySurfaceText.includes('if (!flowEditorViewActive) {')) {
    throw new Error('expected flow editor widget id derivation to avoid live overlay ids whenever flow editor view is inactive')
  }
  if (!overlaySurfaceText.includes('if (workspaceOverlayOpen) return')
    || !overlaySurfaceText.includes('workspaceMutationBlocked, workspaceOverlayOpen]')
    || !overlaySurfaceText.includes('stableOverlaySurfaceCacheKey')) {
    throw new Error('expected inactive-view cleanup to preserve stable overlay ids while Editor Workspace owns the Flow Editor surface')
  }
  if (!overlaySurfaceText.includes('stableFrontmatterOverlaySurfaceCacheById')
    || !overlaySurfaceText.includes('cachedStableOverlaySurface.sourceKey === activeSourceSelectionKey')
    || !overlaySurfaceText.includes('if (workspaceOverlayOpen && sourceKey) return `workspace:${sourceKey}`')
    || !overlaySurfaceText.includes('clearStableFrontmatterOverlaySurfaceCache(stableOverlaySurfaceCacheKey)')
    || !overlaySurfaceText.includes('writeStableFrontmatterOverlaySurfaceCache(stableOverlaySurfaceCacheKey')) {
    throw new Error('expected Flow Editor surface handoff cache to survive remounts while remaining scoped by active source selection')
  }
  if (!overlaySurfaceText.includes('if (workspaceMutationBlocked && lastStable.length > 0) return lastStable')) {
    throw new Error('expected overlay surface to reuse the last stable frontmatter overlay ids during transient workspace-blocked frames')
  }
  if (!overlaySurfaceText.includes('if (workspaceOverlayOpen && lastStable.length > 0) return lastStable')) {
    throw new Error('expected workspace overlay handoff frames to preserve stable frontmatter overlay ids instead of falling through to Flow Canvas')
  }
  if (!overlaySurfaceText.includes('const frontmatterOverlayAuthorityGraphData = React.useMemo(() => {')
    || !overlaySurfaceText.includes('return lastStableGraph')
    || !overlaySurfaceText.includes('renderGraphDataOverride: frontmatterOverlayAuthorityGraphData')) {
    throw new Error('expected overlay surface to keep the stable frontmatter-flow graph as the handoff authority for Flow Editor and Flow Canvas partitioning')
  }
  const surfaceElementsText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx'), 'utf8')
  if (!surfaceElementsText.includes('const useStableFrontmatterGraphAuthority =')
    || !surfaceElementsText.includes('&& stableGraphIsFrontmatterFlow')
    || !surfaceElementsText.includes('&& args.overlayEditorNodeIds.length > 0')
    || surfaceElementsText.includes('!args.renderGraphMetaKind\n    && !currentGraphIsFrontmatterFlow')) {
    throw new Error('expected overlay element builder to classify preserved overlay ids through the stable frontmatter graph authority')
  }
  if (!runtimeText.includes('forceFrontmatterFlow: frontmatterOnlyPolicyActive')) {
    throw new Error('expected Flow Editor runtime to force flow-only graph-family derivation under frontmatter-only policy')
  }
  if (sharedText.includes('MAX_AUTO') || sharedText.includes('MAX_VIEW') || overlaySurfaceText.includes('MAX_AUTO') || overlaySurfaceText.includes('MAX_VIEW')) {
    throw new Error('expected frontmatter-flow widget derivation to avoid capped auto-open or viewport limits')
  }
}
export function testFrontmatterFlowTypedNodesForcePortHandleDefaultsInFlowScene() {
  const buildNativeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'buildNativeScene.ts')
  const text = readFileSync(buildNativeScenePath, 'utf8')
  if (!text.includes('shouldForceFrontmatterFlowTypedHandles')) {
    throw new Error('expected Flow scene builder to force default handles for frontmatter-flow typed nodes')
  }
  if (!text.includes("nodeTypeLower === 'input'")) {
    throw new Error('expected typed handle force rule to cover input nodes')
  }
  if (!text.includes("nodeTypeLower === 'default'")) {
    throw new Error('expected typed handle force rule to cover default nodes')
  }
  if (!text.includes("nodeTypeLower === 'output'")) {
    throw new Error('expected typed handle force rule to cover output nodes')
  }
  if (!text.includes("nodeTypeLower === 'custom'")) {
    throw new Error('expected typed handle force rule to cover custom nodes')
  }
}
export function testFrontmatterFlowWidgetFormShowsFlowContractAndOnlyShowsSmartMediaWhenConfigured() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const registryHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'resolveWidgetRegistry.ts')
  const contractHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'frontmatterWidgetContract.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(registryHelperPath, 'utf8')
  const contractHelperText = readFileSync(contractHelperPath, 'utf8')

  if (!text.includes("const isFrontmatterFlow = String(graphMetaKind || '').trim() === 'frontmatter-flow'")) {
    throw new Error('expected widget form to detect frontmatter-flow mode')
  }
  if (!helperText.includes('export function isFrontmatterWidgetRegistryNode(')) {
    throw new Error('expected shared widget registry helpers to expose frontmatter widget-node classification')
  }
  if (!helperText.includes('export function isNodeOwnedFrontmatterWidgetRegistryEntry(')) {
    throw new Error('expected shared widget registry helpers to expose frontmatter node/entry ownership checks')
  }
  if (!text.includes('!hideFields && isFrontmatterFlow')) {
    throw new Error('expected dedicated frontmatter flow contract section rendering')
  }
  if (!contractHelperText.includes("rowKey: 'flow-handles-target'")) {
    throw new Error('expected shared frontmatter contract helper to include target handle row descriptors')
  }
  if (!contractHelperText.includes("rowKey: args.dir === 'in' ? 'flow-handles-target' : 'flow-handles-source'")) {
    throw new Error('expected shared frontmatter contract helper to derive source handle row descriptors from the shared direction mapping')
  }
  if (!contractHelperText.includes("const flowCompute = pickString(properties['flow:compute'])")) {
    throw new Error('expected shared frontmatter contract helper to bind flow:compute')
  }
  if (!contractHelperText.includes('FRONTMATTER_FLOW_WIDGET_FIELDS_KEY')) {
    throw new Error('expected shared frontmatter contract helper to read declared widget envelope fields metadata')
  }
  if (!contractHelperText.includes('const rawValue = readRecordPathValue(properties, schemaPath)')) {
    throw new Error('expected shared frontmatter contract helper to resolve declared envelope field values by schema path')
  }
  if (!text.includes('onPatchProperties({ data: parsed })')) {
    throw new Error('expected frontmatter flow contract section to parse and persist data json')
  }
}

export function testFrontmatterWidgetOverlayPointerCaptureSkipsInteractiveControls() {
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx')
  const text = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!text.includes("const isInteractiveControl = !!el?.closest('input,textarea,select,button,[contenteditable=\"true\"]')")) {
    throw new Error('expected widget overlay pointer capture to classify native interactive controls once at the root')
  }
  if (!text.includes('if (active && ev.button === 0 && isInteractiveControl) return')) {
    throw new Error('expected widget overlay pointer capture to avoid selection churn while interacting with native form controls')
  }
}

export function testFlowEditorOverlayEdgeSchedulerStabilizesAcrossScrollPanZoom() {
  const edgeHookPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const text = readFileSync(edgeHookPath, 'utf8')

  if (!text.includes('overlayEdgeLayoutSigRef')) {
    throw new Error('expected overlay edge scheduler to cache layout signature and suppress redundant redraw churn')
  }
  if (!text.includes('overlayEdgeAnchorCacheRef')) {
    throw new Error('expected overlay edge scheduler to cache handle anchors and avoid temporary port disconnect jitter')
  }
  if (!text.includes('const svgViewBox = `0 0 ${svgWidth} ${svgHeight}`')) {
    throw new Error('expected overlay edge SVG viewport to be derived from the Flow Editor root rect')
  }
  if (!text.includes("svg.setAttribute('width', String(svgWidth))") || !text.includes("svg.setAttribute('height', String(svgHeight))")) {
    throw new Error('expected overlay edge SVG to set explicit width and height so paths are not clipped by intrinsic SVG sizing')
  }
  if (!text.includes("svg.setAttribute('viewBox', svgViewBox)") || !text.includes("svg.setAttribute('preserveAspectRatio', 'none')")) {
    throw new Error('expected overlay edge SVG to use an explicit non-scaling viewBox for root-relative path coordinates')
  }
  if (!text.includes('const buildRectAnchorCacheKey = (nodeId: string, dir: \'in\' | \'out\', portKey: string, rect: DOMRect, scrollSignature: string): string =>')) {
    throw new Error('expected overlay edge anchor cache keys to include panel geometry so moved widgets cannot reuse stale absolute anchors')
  }
  if (!text.includes('round2(rect.left)') || !text.includes('round2(rect.top)') || !text.includes('round2(rect.width)') || !text.includes('round2(rect.height)') || !text.includes('scrollSignature')) {
    throw new Error('expected overlay edge anchor cache geometry signature to track rect position, size, and nested scroll state')
  }
  if (!text.includes('const anchorCacheKey = buildRectAnchorCacheKey(anchorArgs.nodeId, anchorArgs.dir, portKey, rect, overlayScrollSignature)')) {
    throw new Error('expected overlay edge anchors to use geometry-and-scroll-scoped cache keys')
  }
  if (!text.includes('readOverlayScrollSurfaceSignature') || !text.includes('querySelectorAll<HTMLElement>(FLOW_EDITOR_MEDIA_SCROLL_SURFACE_SELECTOR)')) {
    throw new Error('expected overlay edge layout signature to include nested rich-media scroll surfaces')
  }
  if (!text.includes('scrollLeft') || !text.includes('scrollTop') || !text.includes('nestedScrollSignature')) {
    throw new Error('expected overlay edge layout signature to include overlay and nested scroll offsets')
  }
  if (!text.includes('readPortHandleVisibleBoundaryRect') || !text.includes('button.closest<HTMLElement>(FLOW_EDITOR_MEDIA_SCROLL_SURFACE_SELECTOR)')) {
    throw new Error('expected overlay edge anchors to resolve visible rich-media scroll boundaries for port handles')
  }
  if (!text.includes('isAnchorVisibleInBoundary(dotAnchor.anchor, dotAnchor.boundaryRect)') || !text.includes('clampAnchorYToVisibleBounds(nextAnchor.anchor.y, anchorArgs.fallbackRect, nextAnchor.boundaryRect)')) {
    throw new Error('expected overlay edge anchors to ignore scrolled-away dot handles and clamp to the visible panel boundary')
  }
  if (!text.includes("document.addEventListener('scroll', onAny, true)")) {
    throw new Error('expected overlay edge scheduler to listen to capture scroll updates for widget scrolling')
  }
  if (!text.includes("document.addEventListener('wheel', onAny, { capture: true, passive: true })")) {
    throw new Error('expected overlay edge scheduler to listen to wheel updates for pan/zoom interaction stability')
  }
  if (!text.includes("root?.addEventListener('scroll', onAny, true)")) {
    throw new Error('expected overlay edge scheduler to bind root capture scroll updates')
  }
  if (!text.includes("root?.addEventListener('wheel', onAny, { capture: true, passive: true })")) {
    throw new Error('expected overlay edge scheduler to bind root capture wheel updates')
  }
  if (!text.includes("overlayEdgeLayoutSigRef.current = ''")) {
    throw new Error('expected overlay edge scheduler to invalidate layout signature on global interaction updates')
  }
  if (!text.includes('overlayEdgeAnchorCacheRef.current.clear()')) {
    throw new Error('expected overlay edge scheduler to invalidate anchor cache on global interaction updates')
  }
  if (!text.includes('const onInteractionFrame = () => {')) {
    throw new Error('expected overlay edge scheduler interaction-frame callback to run explicit invalidation before redraw')
  }
  if (!text.includes('getEdgeBaseStroke') || !text.includes('getEdgeStrokeWidth')) {
    throw new Error('expected overlay edge renderer to reuse shared graph edge stroke and width resolvers')
  }
}

export function testFlowEditorOverlayEdgesAnchorThroughSharedOverlayRoots() {
  const edgeHookPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const renderGraphHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const edgeHookText = readFileSync(edgeHookPath, 'utf8')
  const renderGraphHelperText = readFileSync(renderGraphHelperPath, 'utf8')
  if (!edgeHookText.includes("import {\n  getCachedFlowEditorOverlayEdgeGraph,\n  readCanonicalFlowEditorOverlayIdentity,\n} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'")) {
    throw new Error('expected overlay edge renderer to consume shared overlay-edge graph and canonical overlay identity helpers')
  }
  if (!renderGraphHelperText.includes("import { canonicalNodeIdSetHas, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'")) {
    throw new Error('expected shared overlay edge graph helper to reuse canonical overlay identity helpers for workspace-composed graph ids')
  }
  if (!edgeHookText.includes('CANVAS_OVERLAY_PROXY_ROOT_SELECTOR')) {
    throw new Error('expected overlay edge renderer to resolve anchors through the shared Flow Editor overlay surface')
  }
  if (!edgeHookText.includes('readCanvasOverlayNodeId')) {
    throw new Error('expected overlay edge renderer to reuse the shared overlay node-id reader across widgets and Rich Media panels')
  }
  if (!edgeHookText.includes('querySelectorAll<HTMLElement>(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR)')) {
    throw new Error('expected overlay edge renderer to scan both widget and Rich Media overlay roots when collecting anchor rects')
  }
  if (!edgeHookText.includes('Array.from(document.querySelectorAll<HTMLElement>(CANVAS_OVERLAY_PROXY_ROOT_SELECTOR))')) {
    throw new Error('expected overlay edge renderer to query the document-wide overlay pool so portal-mounted widgets remain discoverable')
  }
  if (!edgeHookText.includes('const domOverlayRootEntries = (() => {')) {
    throw new Error('expected overlay edge renderer to collect active overlay roots once before filtering endpoints')
  }
  if (!edgeHookText.includes('for (let i = 0; i < domOverlayRootEntries.length; i += 1) {')) {
    throw new Error('expected overlay edge renderer to reuse active overlay-root entries for both node-set and rect collection')
  }
  if (!edgeHookText.includes('const id = readCanonicalFlowEditorOverlayIdentity(domOverlayRootEntries[i]?.id)')) {
    throw new Error('expected overlay edge renderer to canonicalize active overlay DOM ids before merging them into the edge node set')
  }
  if (!renderGraphHelperText.includes('if (!canonicalNodeIdSetHas(overlayNodeIdSet, sourceRaw) || !canonicalNodeIdSetHas(overlayNodeIdSet, targetRaw)) continue')) {
    throw new Error('expected shared overlay edge graph helper to match edge endpoints through canonical overlay identities during workspace-composed id churn')
  }
  if (!renderGraphHelperText.includes('const source = readCanonicalFlowEditorOverlayIdentity(sourceRaw)')) {
    throw new Error('expected shared overlay edge graph helper to normalize source endpoint ids before edge rendering reuse')
  }
  if (!renderGraphHelperText.includes('const target = readCanonicalFlowEditorOverlayIdentity(targetRaw)')) {
    throw new Error('expected shared overlay edge graph helper to normalize target endpoint ids before edge rendering reuse')
  }
  if (edgeHookText.includes("const stroke = style?.color || 'currentColor'")) {
    throw new Error('expected overlay edge renderer to avoid currentColor-only fallback strokes that can become non-visible')
  }
  if (!edgeHookText.includes('const stroke = style?.color || getEdgeBaseStroke(rawEdge as GraphEdge, schema)')) {
    throw new Error('expected overlay edge renderer to use shared graph stroke fallback when socket style is absent')
  }

  const surfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'FlowEditorCanvasSurface.tsx')
  const surfaceText = readFileSync(surfacePath, 'utf8')
  if (!surfaceText.includes("color: 'var(--kg-canvas-edge-stroke, #9ca3af)'")) {
    throw new Error('expected overlay edge SVG to provide a visible CSS variable fallback color')
  }
  if (!surfaceText.includes('opacity: 1') || !surfaceText.includes("visibility: 'visible'")) {
    throw new Error('expected overlay edge SVG to explicitly remain visible in overlay-only mode')
  }

  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const proxyText = readFileSync(proxyPath, 'utf8')
  if (!proxyText.includes('export function readCanvasOverlayNodeId')) {
    throw new Error('expected shared overlay proxy module to centralize node-id resolution for overlay roots')
  }
  if (!proxyText.includes("return String(overlayRoot.dataset.nodeId || '').trim()")) {
    throw new Error('expected shared overlay node-id reader to support Rich Media overlay roots via data-node-id')
  }

  const richMediaPanelPath = resolve(process.cwd(), 'src', 'components', 'RichMediaPanel.tsx')
  const richMediaPanelText = readFileSync(richMediaPanelPath, 'utf8')
  if (!richMediaPanelText.includes('const flowEditorRichMediaOverlayRoot = flowEditorInteractionMode || canvasOverlayProxyEnabled')) {
    throw new Error('expected Rich Media overlay root marker to include Flow Editor interaction mode, not only canvas proxy handlers')
  }
  if (!richMediaPanelText.includes("data-kg-rich-media-overlay={flowEditorRichMediaOverlayRoot ? '1' : undefined}")) {
    throw new Error('expected Rich Media Panel roots to participate in Flow Editor edge endpoint discovery whenever Flow Editor interaction mode is active')
  }
}

export function testFlowEditorOverlayEdgesPreserveStableNodeSetAcrossWorkspaceToggleChurn() {
  const edgeHookPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const text = readFileSync(edgeHookPath, 'utf8')

  if (!text.includes('const lastStableOverlayEdgeNodeIdsRef = React.useRef<string[]>([])')) {
    throw new Error('expected overlay edge renderer to retain a stable active node set across transient workspace toggle DOM churn')
  }
  if (!text.includes('lastStableOverlayEdgeNodeIdsRef.current = Array.from(set)')) {
    throw new Error('expected overlay edge renderer to refresh its stable node-set cache from live overlay ids before transient empties')
  }
  if (!text.includes('for (let i = 0; i < lastStableOverlayEdgeNodeIdsRef.current.length; i += 1) {')) {
    throw new Error('expected overlay edge renderer to reuse the stable node-set cache when live overlay ids momentarily disappear')
  }
  if (text.includes('if (overlayRectsByNodeId.size === 0) {\n        removeAllPaths(overlayEdgePathByIdRef)')) {
    throw new Error('expected overlay edge renderer to stop clearing all paths on transient empty overlay rects during workspace toggle churn')
  }
  if (!text.includes('if (overlayRectsByNodeId.size === 0) {')) {
    throw new Error('expected overlay edge renderer to preserve current edges until overlay rects recover on the next frame')
  }
  if (!text.includes('scheduleOverlayEdgeUpdate()')) {
    throw new Error('expected overlay edge renderer to reschedule after transient empty overlay rects')
  }
  if (!text.includes("hashSignatureParts(['transient-overlay-edges'")) {
    throw new Error('expected overlay edge renderer to key bounded retries for transient empty node/edge sets')
  }
  if (!text.includes("scheduleTransientOverlayEdgeRetry(['missing-graph-data'")) {
    throw new Error('expected overlay edge renderer to preserve paths while graph data is transiently unavailable during init/workspace/run-all churn')
  }
  if (!text.includes('const liveGraph = args.draftGraphDataRef.current || args.renderGraphDataOverride || null')) {
    throw new Error('expected overlay edge renderer to read the live draft graph before deciding whether bounded stable fallback is required')
  }
  if (!text.includes("'partial-overlay-node-set'")) {
    throw new Error('expected overlay edge renderer to preserve the last stable overlay node set during bounded partial DOM churn')
  }
  if (!text.includes('overlayEdgePartialNodeSetRetryRef')) {
    throw new Error('expected overlay edge renderer to bound retries for partial overlay node-set churn')
  }
  if (!text.includes('if (workspaceOverlayOpen) {')
    || !text.includes('removeAllPaths(overlayEdgePathByIdRef)')
    || !text.includes('if (workspaceOverlayOpen) return set')) {
    throw new Error('expected workspace-open overlay edge churn to clear stale stable-node edge paths instead of reusing them when the live overlay set shrinks or disappears')
  }
  const runtimeText = readFileSync(runtimePath, 'utf8')
  if (!runtimeText.includes('[overlayEdgeHostActive, overlayEditorNodeIdsKey, overlayTopologyLayoutSignature, scheduleOverlayEdgeUpdate]')) {
    throw new Error('expected Flow Editor overlay edge scheduling to resync on semantic topology/layout signature changes, not only overlay node id churn')
  }
  const overlaySurfaceText = readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx'), 'utf8')
  const overlayCoverageText = `${overlaySurfaceText}\n${readFileSync(resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlayCoverage.ts'), 'utf8')}`
  const selectionBookkeepingPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSelectionBookkeeping.ts')
  const selectionBookkeepingText = readFileSync(selectionBookkeepingPath, 'utf8')
  const renderGraphHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const renderGraphHelperText = readFileSync(renderGraphHelperPath, 'utf8')
  if (!overlayCoverageText.includes('frontmatterOverlayOnlyCoverageRef')) {
    throw new Error('expected frontmatter overlay-only mode to preserve the last stable full-coverage state across bounded workspace/indexing churn')
  }
  if (
    !renderGraphHelperText.includes("cacheScope: scope,")
    || !renderGraphHelperText.includes('getCachedGraphLookup({')
    || !overlaySurfaceText.includes("scope: 'flow-editor-overlay-surface-render-graph'")
    || !overlaySurfaceText.includes('getCachedFlowEditorRenderGraph({')
  ) {
    throw new Error('expected Flow Editor overlay surface to reuse the shared render-graph helper instead of rebuilding local node maps per graph revision')
  }
  if (
    !selectionBookkeepingText.includes("scope: 'flow-editor-selection-bookkeeping-draft-graph'")
    || !selectionBookkeepingText.includes('getCachedFlowEditorRenderGraph({')
  ) {
    throw new Error('expected Flow Editor selection bookkeeping to reuse the shared render-graph helper before deriving inner-id aliases')
  }
  if (!overlayCoverageText.includes("'frontmatter-overlay-only-coverage'")) {
    throw new Error('expected frontmatter overlay-only coverage preservation to use a semantic signature instead of raw array identity')
  }
  if (!overlayCoverageText.includes("hashScopedStringArraySignature('visible-flow-nodes', visibleFlowNodeIds)")) {
    throw new Error('expected frontmatter overlay-only coverage preservation to hash visible-node coverage through the shared semantic array helper')
  }
  if (!text.includes("scheduleTransientOverlayEdgeRetry(['empty-overlay-node-set'")) {
    throw new Error('expected overlay edge renderer to preserve paths while overlay ids are transiently empty during init/workspace churn')
  }
  if (!text.includes("scheduleTransientOverlayEdgeRetry(['empty-filtered-edge-set'")) {
    throw new Error('expected overlay edge renderer to preserve paths while filtered edge endpoints are transiently empty during Run all refresh')
  }
  if (!text.includes('const liveGraph = args.draftGraphDataRef.current || args.renderGraphDataOverride || null')) {
    throw new Error('expected overlay edge renderer to distinguish live post-close graph hydration from the stable fallback snapshot')
  }
  if (!text.includes('const graph = shouldReuseStableGraph ? stableGraph : liveGraph')) {
    throw new Error('expected overlay edge renderer to preserve the last stable graph while workspace-close hydration transiently reports zero edges')
  }
  if (!renderGraphHelperText.includes('export function getCachedFlowEditorOverlayEdgeGraph(args: {')) {
    throw new Error('expected FlowEditor runtime helper to own filtered overlay-edge graph derivation')
  }
  if (!text.includes('graphRevision: readGraphDataRevision(graph),')) {
    throw new Error('expected overlay edge renderer to pass graph revisions into the shared filtered overlay-edge helper')
  }
  if (!renderGraphHelperText.includes('function buildOverlayNodeHandleSignature(')) {
    throw new Error('expected FlowEditor runtime helper to derive semantic node-handle signatures for overlay-edge cache invalidation')
  }
  if (!renderGraphHelperText.includes('const id = readCanonicalFlowEditorOverlayIdentity(node?.id)')) {
    throw new Error('expected shared overlay-edge helper to canonicalize workspace-composed overlay node ids before hashing')
  }
  if (!renderGraphHelperText.includes('const nodeHandleSemanticKey = buildOverlayNodeHandleSignature(baseGraph.nodes)')) {
    throw new Error('expected shared overlay-edge helper to compute handle cache invalidation from the shared base graph semantics')
  }
  if (!renderGraphHelperText.includes("hashSignatureParts([\n        'overlay-graph-semantic',")) {
    throw new Error('expected shared overlay-edge helper to combine topology signature with node-handle semantics when graph revision metadata is absent')
  }
  if (!renderGraphHelperText.includes("const overlayNodeIdsKey = hashScopedStringArraySignature('overlay-node-ids', overlayNodeIds, {")) {
    throw new Error('expected shared overlay-edge helper to derive a semantic overlay-node key before caching filtered graph lookups')
  }
  if (!renderGraphHelperText.includes("const cacheKey = hashSignatureParts([\n    'overlay-graph-lookup',\n    graphSemanticKey,\n    overlayNodeIdsKey,")) {
    throw new Error('expected shared overlay-edge helper to cache filtered node and edge lookups by semantic overlay-node signature')
  }
  if (!text.includes("const cacheKey = hashSignatureParts([\n          'topPct',\n          graphSemanticKey,")) {
    throw new Error('expected overlay edge handle-position cache to invalidate from semantic graph revisions instead of only overlay ids and edges')
  }
  if (!text.includes("const overlayEdgeKey = hashScopedStringArraySignature('topPct-overlay-edges', overlayEdgeKeyParts, {")) {
    throw new Error('expected overlay edge handle-position cache to hash filtered edge semantics through the shared semantic array helper')
  }
  const proxyPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'flow-editor-overlay-proxy.ts')
  const proxyText = readFileSync(proxyPath, 'utf8')
  if (!proxyText.includes('export function isTransientOffscreenRichMediaOverlayRoot')) {
    throw new Error('expected shared overlay proxy utilities to identify transient offscreen Rich Media bootstrap roots before geometry consumers use endpoint rects')
  }
  if (!proxyText.includes('export function shouldReplaceFlowEditorOverlayRectCandidate')) {
    throw new Error('expected shared overlay proxy utilities to choose canonical visible overlay roots when duplicate roots exist for the same node')
  }
  if (!proxyText.includes('function readOverlayRectCandidateRank(el: HTMLElement): number')) {
    throw new Error('expected shared overlay proxy utilities to rank duplicate overlay root families before falling back to geometry size heuristics')
  }
  if (!proxyText.includes("const hasWidgetShellId = String(el.dataset.kgWidget || '').trim().length > 0")) {
    throw new Error('expected duplicate overlay root ranking to prefer Flow Editor widget shells with explicit widget identities')
  }
  if (!proxyText.includes('if (nextRank > currentRank) {')) {
    throw new Error('expected canonical overlay rect collection to prefer higher-ranked Flow Editor surface candidates before comparing duplicate rect sizes')
  }
  if (!proxyText.includes('return nextArea > currentArea + 1')) {
    throw new Error('expected duplicate overlay root selection to retain the larger visible geometry fallback within a shared overlay family')
  }
  if (!proxyText.includes("String(overlayRoot.dataset.kgRichMediaOverlay || '').trim() !== '1'")) {
    throw new Error('expected shared offscreen endpoint filtering to be scoped to Rich Media overlay roots')
  }
  if (!text.includes('isTransientOffscreenRichMediaOverlayRoot(el, rect)')) {
    throw new Error('expected overlay edge renderer to reuse shared offscreen Rich Media bootstrap root filtering')
  }
  if (!text.includes('shouldReplaceFlowEditorOverlayRectCandidate(selectedById.get(id), next)')) {
    throw new Error('expected overlay edge renderer to choose one canonical visible root per node before endpoint geometry use')
  }
  if (!text.includes("scheduleTransientOverlayEdgeRetry(['offscreen-rich-media-bootstrap'")) {
    throw new Error('expected overlay edge renderer to retry instead of anchoring edges to offscreen Rich Media bootstrap roots')
  }
  if (!text.includes('if (nextCount > 12) return false')) {
    throw new Error('expected transient empty edge recovery retries to stay bounded')
  }
  if (!text.includes('return { overlayEdgesSvgRef: setOverlayEdgesSvgRef, scheduleOverlayEdgeUpdate }')) {
    throw new Error('expected overlay edge renderer to expose scheduler and callback SVG ref for workflow output-update edge recovery')
  }
  if (!text.includes('const overlayEdgeTransientRetryRef = React.useRef<{ key: string; count: number } | null>(null)')) {
    throw new Error('expected overlay edge renderer to bound retries for partially missing edge anchors')
  }
  if (!text.includes('const overlayEdgeReadinessRetryRef = React.useRef<{ key: string; count: number } | null>(null)')) {
    throw new Error('expected overlay edge renderer to bound readiness retries when root/SVG mounts after initialization scheduling')
  }
  if (!text.includes('const overlayEdgeTraceStateRef = React.useRef<{ key: string; ts: number } | null>(null)')) {
    throw new Error('expected overlay edge renderer to dedupe runtime trace noise while collecting deeper repro telemetry')
  }
  if (!text.includes('const readOverlayEdgeHarnessSnapshot = React.useCallback((label?: string, extras?: Record<string, unknown>) => {')) {
    throw new Error('expected overlay edge renderer to expose a deeper runtime harness snapshot helper for local repro')
  }
  if (!text.includes("win.__KG_FLOW_EDITOR_EDGE_HARNESS__ = harness")) {
    throw new Error('expected overlay edge renderer to publish a debug harness on window for scripted init/workspace/run-all repro')
  }
  if (!text.includes("pushOverlayEdgeTrace('empty-filtered-edge-set'")) {
    throw new Error('expected overlay edge renderer to trace filtered-edge starvation instead of leaving remaining runtime failures opaque')
  }
  if (!text.includes('const lastStableOverlayEdgeGraphRef = React.useRef<GraphData | null>(null)')) {
    throw new Error('expected overlay edge renderer to retain the last stable non-empty graph across bounded workspace-close hydration churn')
  }
  if (!text.includes('const overlayEdgeWorkspaceCloseRecoveryUntilRef = React.useRef(0)')) {
    throw new Error('expected overlay edge renderer to track a bounded workspace-close recovery window before clearing stable edge paths')
  }
  if (!text.includes('const shouldReuseStableGraph =')) {
    throw new Error('expected overlay edge renderer to detect bounded post-close graph hydration gaps before clearing edges')
  }
  if (!text.includes('const withinWorkspaceCloseRecoveryWindow = now <= overlayEdgeWorkspaceCloseRecoveryUntilRef.current')) {
    throw new Error('expected overlay edge renderer to bound stable-graph reuse to the immediate workspace-close recovery window')
  }
  if (!text.includes('const graph = shouldReuseStableGraph ? stableGraph : liveGraph')) {
    throw new Error('expected overlay edge renderer to reuse the last stable graph during bounded post-close empty-edge recovery')
  }
  if (!text.includes('reusedStableGraph: shouldReuseStableGraph ? 1 : 0')) {
    throw new Error('expected overlay edge trace to reveal when bounded stable-graph reuse covers post-close edge hydration churn')
  }
  if (!text.includes('overlayEdgeWorkspaceCloseRecoveryUntilRef.current = Date.now() + 1500')) {
    throw new Error('expected overlay edge renderer to arm bounded recovery only when the real workspace overlay closes')
  }
  if (!text.includes("pushOverlayEdgeTrace('drawn'")) {
    throw new Error('expected overlay edge renderer to trace successful draw passes with svg/path metrics for comparison against failing phases')
  }
  if (!text.includes("hashSignatureParts(['overlay-edge-readiness', reason])")) {
    throw new Error('expected overlay edge renderer to key root/SVG readiness retries semantically')
  }
  if (!text.includes("scheduleOverlayEdgeReadinessRetry('missing-svg')")) {
    throw new Error('expected overlay edge renderer to retry when the SVG layer is not attached yet')
  }
  if (!text.includes('const setOverlayEdgesSvgRef = React.useCallback((node: SVGSVGElement | null) => {')) {
    throw new Error('expected overlay edge SVG callback ref to schedule edge rendering as soon as the SVG attaches')
  }
  if (!text.includes('return { overlayEdgesSvgRef: setOverlayEdgesSvgRef, scheduleOverlayEdgeUpdate }')) {
    throw new Error('expected overlay edge hook to expose the SVG callback ref')
  }
  if (!text.includes('transientMissingEdgeAnchorParts.push(`${edgeId}:${source}:${target}`)')) {
    throw new Error('expected overlay edge renderer to detect partial endpoint readiness without dropping edge paths')
  }
  if (!text.includes('if (existing) keep.add(edgeId)')) {
    throw new Error('expected overlay edge renderer to preserve existing paths while endpoint rects are transiently missing')
  }
  if (!text.includes("hashScopedStringArraySignature('missing-edge-anchors', transientMissingEdgeAnchorParts, {")) {
    throw new Error('expected overlay edge renderer to use a semantic missing-anchor retry signature')
  }
  if (!text.includes('nextCount <= 8')) {
    throw new Error('expected overlay edge renderer to bound transient missing-anchor retries')
  }
  if (!text.includes('const stroke = e.stroke') || !text.includes('const strokeWidth = e.strokeWidth')) {
    throw new Error('expected overlay edge renderer to apply pre-resolved socket/theme edge styling when drawing paths')
  }
  if (!text.includes("const FLOW_EDITOR_OVERLAY_EDGE_OPACITY = '0.82'")) {
    throw new Error('expected overlay edge renderer to centralize default overlay-edge opacity for dense frontmatter scenes')
  }
  if (!text.includes("pathEl.setAttribute('opacity', FLOW_EDITOR_OVERLAY_EDGE_OPACITY)")) {
    throw new Error('expected overlay edge renderer to apply shared default overlay-edge opacity when drawing paths')
  }
  if (!text.includes('${e.sourcePortKey}|${e.targetPortKey}:${e.stroke}:${e.strokeWidth}')) {
    throw new Error('expected overlay edge layout signature to include pre-resolved socket/theme edge styling')
  }
}

export function testFlowEditorOverlayEdgesUseCanonicalOverlayNodeSet() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const edgeHookPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const renderGraphHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const text = `${readFileSync(flowEditorCanvasPath, 'utf8')}\n${readFileSync(edgeHookPath, 'utf8')}`
  const renderGraphHelperText = readFileSync(renderGraphHelperPath, 'utf8')

  if (!text.includes('const overlayEditorNodeIdsRef = React.useRef<string[]>([])')) {
    throw new Error('expected FlowEditor overlay edge renderer to keep a ref of canonical overlay editor node ids')
  }
  if (!text.includes('overlayEditorNodeIdsRef.current = overlayEditorNodeIds')) {
    throw new Error('expected FlowEditor overlay edge renderer to sync the canonical overlay editor node id ref')
  }
  if (!text.includes("hashSignatureParts(['overlay-editor-node-ids', ...overlayEditorNodeIds])")) {
    throw new Error('expected FlowEditor overlay edge renderer to derive a semantic overlay node-id signature for initialization recovery')
  }
  if (!text.includes('const overlayEdgesEnabledRef = React.useRef(false)')) {
    throw new Error('expected FlowEditor overlay edge renderer to keep SVG-mounted overlay edge enablement separate from broad Flow Editor view state')
  }
  if (!text.includes('const overlayEdgeHostActive = overlayOnlyActive || hasOverlayEditors')) {
    throw new Error('expected FlowEditor overlay edge renderer to align scheduling with the mounted overlay edge host')
  }
  if (!text.includes('overlayEdgesEnabledRef.current = overlayEdgeHostActive')) {
    throw new Error('expected FlowEditor overlay edge renderer to stay enabled whenever visible Flow Editor overlays own the edge host')
  }
  if (!text.includes('}, [overlayEdgeHostActive, overlayEditorNodeIdsKey, overlayTopologyLayoutSignature, scheduleOverlayEdgeUpdate])')) {
    throw new Error('expected FlowEditor overlay edge renderer to refresh edges when canonical overlay ids or semantic topology layout change while the SVG layer is active')
  }
  if (!text.includes("pushOverlayEdgeTrace('schedule-skip-disabled'")) {
    throw new Error('expected overlay edge scheduler to trace and idle until the overlay edge SVG lifecycle is active')
  }
  const endpointHelperPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'edgeEndpoints.ts')
  const endpointHelperText = readFileSync(endpointHelperPath, 'utf8')
  if (!endpointHelperText.includes('function normalizeEdgeEndpointId(raw: string): string')) {
    throw new Error('expected shared edge endpoint helper to normalize qualified/port-suffixed endpoint ids')
  }
  if (!endpointHelperText.includes('return dot > 0 ? value.slice(0, dot).trim() : value')) {
    throw new Error('expected shared edge endpoint helper to strip qualified endpoint suffixes before overlay filtering')
  }
  if (text.includes('const endpointNodeId = (raw: unknown): string =>')) {
    throw new Error('expected overlay edge renderer to reuse the shared endpoint helper instead of local endpoint parsing')
  }
  if (
    !renderGraphHelperText.includes('readGraphEdgeEndpoints')
    || !renderGraphHelperText.includes('const { src: sourceRaw, tgt: targetRaw } = readGraphEdgeEndpoints(edge)')
    || !renderGraphHelperText.includes('if (!canonicalNodeIdSetHas(overlayNodeIdSet, sourceRaw) || !canonicalNodeIdSetHas(overlayNodeIdSet, targetRaw)) continue')
  ) {
    throw new Error('expected shared overlay edge graph helper to filter candidate edges with the shared endpoint helper')
  }
  if (
    !text.includes('readGraphEdgeEndpoints')
    || !text.includes('const { src: sourceId, tgt: targetId } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected overlay edge renderer to reuse normalized edge endpoints from the shared overlay edge graph output')
  }
  if (!renderGraphHelperText.includes('const source = readCanonicalFlowEditorOverlayIdentity(sourceRaw)') || !renderGraphHelperText.includes('const target = readCanonicalFlowEditorOverlayIdentity(targetRaw)')) {
    throw new Error('expected shared overlay edge graph helper to canonicalize shared edge endpoints before filtering workspace-composed overlay edges')
  }
  if (
    !renderGraphHelperText.includes("const overlayEdgeGraphData = graphMetaKind === 'frontmatter-flow'")
    || !renderGraphHelperText.includes("deriveSceneDisplayGraph({ graphData: graph })?.displayGraphData || graph")
  ) {
    throw new Error('expected shared overlay edge graph helper to derive frontmatter overlay edges from the visible scene display graph before filtering overlay identities')
  }
  if (!text.includes('Array.isArray(args.overlayEditorNodeIdsRef.current) && args.overlayEditorNodeIdsRef.current.length > 0')) {
    throw new Error('expected overlay edge renderer to prefer canonical overlay editor ids over open widget ids')
  }
  if (!text.includes('? args.overlayEditorNodeIdsRef.current')) {
    throw new Error('expected overlay edge renderer to draw from canonical overlay editor ids when overlay-only mode is active')
  }
}

export function testFrontmatterFlowOverlayEditorsIncludeCanonicalBuiltInWidgets() {
  const placementAuthorityPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'widgetPlacementAuthority.ts')
  const frontmatterOverlayPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'frontmatterOverlayNodeIds.ts')
  const text = `${readFileSync(placementAuthorityPath, 'utf8')}\n${readFileSync(frontmatterOverlayPath, 'utf8')}`

  if (!text.includes('function isCanonicalFrontmatterBuiltInWidgetNode')) {
    throw new Error('expected FlowEditorCanvas to centralize canonical built-in frontmatter widget detection')
  }
  if (!text.includes('isCanonicalFrontmatterBuiltInWidgetNode(n)')) {
    throw new Error('expected frontmatter overlay derivation to recognize canonical built-in widget nodes')
  }
  if (!text.includes('allowedFlowNodeIds.add(id)')) {
    throw new Error('expected frontmatter overlay derivation to keep canonical built-in widget ids in the overlay set')
  }
  if (text.includes("if (String(n?.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) continue")) {
    throw new Error('expected frontmatter overlay derivation to stop excluding Rich Media Panel widget nodes from the Flow Editor overlay set')
  }
}

export function testFlowEditorWidgetFormEmitsInteractionFrameOnScrollAndWheel() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const widgetInnerPanelScrollingPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'widgetInnerPanelScrolling.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const scrollingText = readFileSync(widgetInnerPanelScrollingPath, 'utf8')

  if (!text.includes('emitFlowEditorInteractionFrame')) {
    throw new Error('expected widget form to reuse the shared flow editor interaction frame emitter')
  }
  if (
    !text.includes('onScrollCapture={() => handleWidgetInnerPanelScrollCapture(emitInteractionFrame)}')
    || !scrollingText.includes('export function handleWidgetInnerPanelScrollCapture')
    || !scrollingText.includes('emitInteractionFrame()')
  ) {
    throw new Error('expected widget form scroll to emit interaction frame for edge-anchor resync')
  }
  if (
    !text.includes('onWheelCapture={e => handleWidgetInnerPanelWheelCapture(e, emitInteractionFrame)}')
    || !scrollingText.includes('export function handleWidgetInnerPanelWheelCapture')
    || !scrollingText.includes('emitInteractionFrame()')
  ) {
    throw new Error('expected widget form wheel to emit interaction frame for edge-anchor resync')
  }
}

export function testFrontmatterFlowContractSuppressesPortDotsForComputeAndDataRows() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')

  if (!text.includes("rowKey: 'flow-compute'")) {
    throw new Error('expected flow contract compute row to exist')
  }
  if (!text.includes("rowKey: 'flow-data'")) {
    throw new Error('expected flow contract data row to exist')
  }
  if (!text.includes('showInPortDot: false')) {
    throw new Error('expected flow contract to suppress input port dots for non-handle compute/data rows')
  }
  if (!text.includes('showOutPortDot: false')) {
    throw new Error('expected flow contract to suppress output port dots for non-handle compute/data rows')
  }
}

export function testWidgetWheelCaptureDoesNotBlockInternalScroll() {
  const formPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const scrollingPath = resolve(process.cwd(), 'src', 'lib', 'canvas', 'widgetInnerPanelScrolling.ts')
  const formText = readFileSync(formPath, 'utf8')
  const scrollingText = readFileSync(scrollingPath, 'utf8')
  if (!formText.includes('onWheelCapture={e => handleWidgetInnerPanelWheelCapture(e, emitInteractionFrame)}')) {
    throw new Error('expected widget form wheel capture to route through the shared internal-scroll handler')
  }
  if (!scrollingText.includes('consumeScrollablePanelWheelEvent(event)') || !scrollingText.includes('emitInteractionFrame()')) {
    throw new Error('expected widget panel wheel capture to keep interaction-frame sync through the shared emitter')
  }
  if (scrollingText.includes('stopPropagation')) {
    throw new Error('expected widget panel wheel capture to avoid stopPropagation so internal panel scroll remains usable')
  }
}

export function testWidgetPortHandleTooltipUsesDirectionalHandlePath() {
  const portHandlesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPortHandles.tsx')
  const text = readFileSync(portHandlesPath, 'utf8')
  if (!text.includes('const handlePath = readFlowHandlePath(p.dir)')) {
    throw new Error('expected directional handle path mapping for port handles to reuse shared helper')
  }
  if (!text.includes('formatFlowHandleSemanticKey({ dir: p.dir, portKey })')) {
    throw new Error('expected port-handle tooltip/aria to use semantic port keys via shared helper')
  }
  if (!text.includes('data-kg-port-path={handlePath}')) {
    throw new Error('expected rendered port-handle elements to expose directional handle path metadata')
  }
}

export function testFrontmatterFlowContractFormatsHandlesAsSemanticPortKeys() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const contractHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'frontmatterWidgetContract.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(contractHelperPath, 'utf8')
  if (!helperText.includes('formatFlowHandleValueList')) {
    throw new Error('expected shared frontmatter contract helper to reuse the normalized handle value formatter')
  }
  if (!helperText.includes('flowHandleKeys: FrontmatterFlowHandleKeySet')) {
    throw new Error('expected shared frontmatter contract helper to expose normalized handle keys')
  }
  if (!helperText.includes('valueText: formatFlowHandleValueList(portKeys)')) {
    throw new Error('expected handle row specs to carry normalized semantic port key lists in the shared helper')
  }
  if (!text.includes('const portValueText = readWidgetFieldValueText({') || !text.includes('value={portValueText}')) {
    throw new Error('expected NodeOverlayEditorForm handle row Value cells to read authored property values through the shared widget helper')
  }
  if (!text.includes('const keyLabel = formatFlowHandleKtvKeyLabel({ dir: rowSpec.dir, portKey })')) {
    throw new Error('expected NodeOverlayEditorForm visible handle-row keys to reuse the shared KTV key formatter')
  }
  if (text.includes('`${accessibleName} ${rowSpec.typeLabel} port`')) {
    throw new Error('expected NodeOverlayEditorForm handle-row keys to avoid visible in/out port suffixes')
  }
  if (text.includes('value={portKey}')) {
    throw new Error('expected NodeOverlayEditorForm handle row Value cells to avoid echoing semantic port keys')
  }
  if (helperText.includes("label: readFlowHandlePath(args.dir)")) {
    throw new Error('expected shared handle row specs to avoid generic directional path labels')
  }
  if (!helperText.includes("typeLabel: readFlowHandleTypeLabel(args.dir)")) {
    throw new Error('expected shared handle row specs to reuse directional type labels')
  }
}

export function testWidgetKvTableMaintainsFiveColumnLayoutAndValueContainment() {
  const kvTablePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorKvTable.tsx')
  const text = readFileSync(kvTablePath, 'utf8')
  if (!text.includes("<col style={{ width: '29%' }} />")) {
    throw new Error('expected KV table key column width contract')
  }
  if (!text.includes("<col style={{ width: '10%' }} />")) {
    throw new Error('expected KV table type column width contract')
  }
  if (!text.includes("<col style={{ width: '59%' }} />")) {
    throw new Error('expected KV table value column width contract')
  }
  if (!text.includes("className={cn('px-3 py-2 align-top overflow-hidden'")) {
    throw new Error('expected KV table value column to enforce overflow containment')
  }
  if (!text.includes('<section className="w-full min-w-0">{row.valueNode}</section>')) {
    throw new Error('expected KV table value node wrapper to enforce min-width alignment stability')
  }
}

export function testWidgetKvTableKeepsDimRingPlaceholderDotsForNonEdgeRows() {
  const kvTablePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorKvTable.tsx')
  const text = readFileSync(kvTablePath, 'utf8')
  if (!text.includes('disabled')) {
    throw new Error('expected placeholder dots to stay non-interactive for non-edge rows')
  }
  if (!text.includes("'opacity-50'")) {
    throw new Error('expected placeholder dots to keep dim styling')
  }
  if (!text.includes('rounded-full border')) {
    throw new Error('expected placeholder dots to keep ring style')
  }
}

export function testWidgetRegistryPortsUseDirectionalHandlePathKeyValue() {
  const registrySectionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorRegistrySection.tsx')
  const text = readFileSync(registrySectionPath, 'utf8')
  if (!text.includes('const handlePath = readFlowHandlePath(isIn ? \'in\' : \'out\')')) {
    throw new Error('expected widget registry port rows to derive directional handle path from shared helper')
  }
  if (!text.includes('const handleSemanticKey = formatFlowHandleSemanticKey({ dir: isIn ? \'in\' : \'out\', portKey })')) {
    throw new Error('expected widget registry port rows to format semantic port-key metadata via shared helper')
  }
  if (!text.includes('const portKeyLabel = formatFlowHandleKtvKeyLabel({ dir: isIn ? \'in\' : \'out\', portKey })')) {
    throw new Error('expected widget registry visible port-row key labels to reuse the shared KTV key formatter')
  }
  if (!text.includes('const portValueId = ids.registryField(') || !text.includes('`port-${idx}-${p.direction}-${portKey}-${schemaPath}`')) {
    throw new Error('expected widget registry port rows to derive unique shared SSOT value ids for label/input typography')
  }
  if (!text.includes('formatFlowHandleAccessibleName({')) {
    throw new Error('expected widget registry port rows to use shared accessible names when repeated port keys exist')
  }
  if (!text.includes('<span>{portKeyLabel}</span>')) {
    throw new Error('expected widget registry port key column to show semantic KTV port keys without direction suffixes')
  }
  if (!text.includes("<span className={cn('block', UI_THEME_TOKENS.text.tertiary)}>{schemaPath || portKey}</span>")) {
    throw new Error('expected widget registry port key column to keep schema path or concrete port key as secondary text')
  }
  if (!text.includes('typeNode: <NodeOverlayEditorTypePill text={handleType} />')) {
    throw new Error('expected widget registry port type column to render in/out direction')
  }
  if (!text.includes('<PlainTextInputEditor')) {
    throw new Error('expected widget registry port value column to reuse shared text-input typography')
  }
  if (!text.includes('const portValueText = readWidgetFieldValueText({') || !text.includes('value={portValueText}')) {
    throw new Error('expected widget registry port value column to read schema-path values through the shared widget helper')
  }
  if (text.includes('value={portKey}')) {
    throw new Error('expected widget registry port value column to avoid echoing standalone port keys')
  }
  if (!text.includes('disabled') || !text.includes('readOnly')) {
    throw new Error('expected widget registry port value column to stay read-only while reusing shared value styling')
  }
}

export function testFrontmatterFlowContractUnionsSemanticHandleSourcesWhenPortTypesAreUntyped() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const contractHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'frontmatterWidgetContract.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(contractHelperPath, 'utf8')
  if (!helperText.includes('const flowRegistryHandles: FrontmatterFlowHandleKeySet = (() => {')) {
    throw new Error('expected shared frontmatter contract helper to derive handles from registry ports')
  }
  if (!helperText.includes('const mergeHandleKeys = (...sets: string[][]): string[] => sortUniqueStrings(sets.flat())')) {
    throw new Error('expected shared frontmatter contract helper to union semantic handle sources')
  }
  if (!helperText.includes('target: mergeHandleKeys(frontmatterInKeys, connectedFlowHandles.target, flowRegistryHandles.target, flowPortTypes.target)')) {
    throw new Error('expected shared frontmatter contract helper to union target frontmatter, connected, registry, and typed handles')
  }
  if (!helperText.includes('source: mergeHandleKeys(frontmatterOutKeys, connectedFlowHandles.source, flowRegistryHandles.source, flowPortTypes.source)')) {
    throw new Error('expected shared frontmatter contract helper to union source frontmatter, connected, registry, and typed handles')
  }
  if (!text.includes('const frontmatterContract = React.useMemo(() => {')) {
    throw new Error('expected node overlay editor form to reuse the shared frontmatter contract helper')
  }
  if (!helperText.includes('const portKeys = args.resolvedHandleKeys.length > 0 ? args.resolvedHandleKeys : args.frontmatterPortKeys')) {
    throw new Error('expected frontmatter contract row specs to render resolved handles as semantic per-port rows')
  }
}

export function testFrontmatterFlowContractMakesSourceEditableAndTargetReadOnly() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const registryHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'resolveWidgetRegistry.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(registryHelperPath, 'utf8')
  if (!helperText.includes('export function resolveFrontmatterWidgetRegistrySectionState(')) {
    throw new Error('expected shared widget registry helpers to expose frontmatter registry-section state resolution')
  }
  if (!text.includes('const frontmatterWidgetRegistrySection = React.useMemo(')) {
    throw new Error('expected built-in frontmatter widgets to reuse the shared frontmatter registry-section state helper')
  }
  if (!text.includes('const hideFrontmatterFlowContractRows = frontmatterWidgetRegistrySection.hideFlowContractRows')) {
    throw new Error('expected built-in frontmatter widgets to collapse duplicate flow-contract rows through shared section state')
  }
  if (!text.includes('const frontmatterWidgetIdentityLabel = frontmatterWidgetRegistrySection.identityLabel')) {
    throw new Error('expected built-in frontmatter widgets to derive the canonical Widget identity row from shared section state')
  }
  if (!text.includes('ariaLabel={UI_LABELS.flowWidget}')) {
    throw new Error('expected built-in frontmatter widgets to render the canonical Widget identity row')
  }
  if (!text.includes('showPortRows')) {
    throw new Error('expected frontmatter widget registry section to keep canonical port rows visible')
  }
}

export function testFrontmatterFlowContractKeepsTwoDotColumnsAlignedForHandleRows() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const contractHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'frontmatterWidgetContract.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(contractHelperPath, 'utf8')
  if (!text.includes('const frontmatterPortRows = React.useMemo(() => {')) {
    throw new Error('expected frontmatter flow contract handle rows to be rendered from shared row specs')
  }
  if (!helperText.includes("rowKey: args.dir === 'in' ? 'flow-handles-target' : 'flow-handles-source'")) {
    throw new Error('expected shared frontmatter contract helper to derive directional handle row keys')
  }
  if (!text.includes("inPortNode: rowSpec.dir === 'in' ? portButton : undefined") || !text.includes("outPortNode: rowSpec.dir === 'out' ? portButton : undefined")) {
    throw new Error('expected flow contract handle rows to render explicit directional port nodes from shared specs')
  }
  if (!helperText.includes('portKeys: string[]')) {
    throw new Error('expected flow contract handle rows to expose explicit semantic port-key lists')
  }
  if (!text.includes('forcePortDots')) {
    throw new Error('expected flow contract handle rows to keep table-level fallback dots for consistent | dot | key | type | value | dot | alignment')
  }
}

export function testFrontmatterFlowWidgetRegistryOptionsAreScopedToCurrentFormId() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const registryHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'resolveWidgetRegistry.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(registryHelperPath, 'utf8')
  if (!helperText.includes('export function resolveExpectedFrontmatterWidgetFormId(')) {
    throw new Error('expected shared widget registry helpers to expose frontmatter expected form-id resolution')
  }
  if (!helperText.includes("return nodeId ? `fm:${nodeId}` : ''")) {
    throw new Error('expected frontmatter expected form-id helper to fall back to fm:<nodeId> when explicit formId is absent')
  }
  if (!helperText.includes('export function listScopedWidgetRegistryEntries(')) {
    throw new Error('expected shared widget registry helpers to expose scoped entry filtering')
  }
  if (!text.includes('return listScopedWidgetRegistryEntries({')) {
    throw new Error('expected node overlay editor form to reuse the shared scoped widget registry helper')
  }
  if (!text.includes('resolveFrontmatterWidgetRegistrySectionState({')) {
    throw new Error('expected node overlay editor form to reuse the shared frontmatter registry-section state helper')
  }
  if (!text.includes('buildFrontmatterWidgetContractModel({')) {
    throw new Error('expected node overlay editor form to reuse the shared frontmatter contract model helper')
  }
  if (!text.includes('const nodeHelperSignature = React.useMemo(() => {')) {
    throw new Error('expected node overlay editor form to derive a semantic node helper signature before reusing registry and contract helpers')
  }
  if (!text.includes('const registryEntriesSignature = React.useMemo(')) {
    throw new Error('expected node overlay editor form to derive semantic registry-entry list signatures before scoping widget mappings')
  }
  if (!text.includes('const registryEntriesSnapshotRef = React.useRef<{ key: string; value: ReadonlyArray<WidgetRegistryEntry> } | null>(null)')) {
    throw new Error('expected node overlay editor form to snapshot scoped registry inputs by semantic signature')
  }
}

export function testWidgetRegistryMetadataMissingClearsDocumentRegistryToAvoidStaleFallbacks() {
  const graphDataSliceUtilsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graphDataSliceUtils.ts')
  const text = readFileSync(graphDataSliceUtilsPath, 'utf8')
  if (!text.includes('const metadataRecord = isRecord(metadata) ? metadata : ({} as Record<string, unknown>)')) {
    throw new Error('expected widget registry metadata reader to coerce missing metadata to empty record')
  }
  if (!text.includes('const rawArr = Array.isArray(raw) ? raw : []')) {
    throw new Error('expected widget registry metadata reader to treat missing registry payload as empty and clear stale entries')
  }
}

export function testFrontmatterFlowContractAvoidsSyntheticHandleAndDataFallbacks() {
  const nodeOverlayEditorFormPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorForm.tsx')
  const contractHelperPath = resolve(process.cwd(), 'src', 'features', 'flow-editor-manager', 'frontmatterWidgetContract.ts')
  const text = readFileSync(nodeOverlayEditorFormPath, 'utf8')
  const helperText = readFileSync(contractHelperPath, 'utf8')
  if (!helperText.includes('hasFlowTargetHandles: flowHandleKeys.target.length > 0')) {
    throw new Error('expected shared frontmatter contract helper to gate input handle rows by actual derived handles')
  }
  if (!helperText.includes('hasFlowSourceHandles: flowHandleKeys.source.length > 0')) {
    throw new Error('expected shared frontmatter contract helper to gate output handle rows by actual derived handles')
  }
  if (!helperText.includes("if (typeof raw === 'undefined') return ''")) {
    throw new Error('expected shared frontmatter contract helper to avoid synthetic {} fallback when data key is absent')
  }
  if (!text.includes('onPatchProperties({ data: undefined })')) {
    throw new Error('expected frontmatter flow data editor clear action to remove data key instead of writing synthetic {}')
  }
}

export function testFlowEditorOverlayEdgesUseRendererEdgeTypeSsot() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!text.includes('const globalEdgeType = readGlobalEdgeType(schema)')) {
    throw new Error('expected FlowEditor overlay edge rendering to use renderer edge-type SSOT from schema')
  }
  if (text.includes('frontmatterFlowRenderSettings?.edgeType || readGlobalEdgeType(schema)')) {
    throw new Error('expected FlowEditor overlay edge rendering to avoid frontmatter edge-type override over renderer edge-type SSOT')
  }
}

export function testFlowEditorDraftGraphHydrationIsNotClearedByFrontmatterRequirementGuard() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const renderStatePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRenderState.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const renderStateText = readFileSync(renderStatePath, 'utf8')

  if (!runtimeText.includes('const flowEditorBaseGraphData = React.useMemo(')) {
    throw new Error('expected FlowEditor draft graph hydration to derive a stable Flow Editor graph-family source')
  }
  if (!renderStateText.includes('const base = args.flowEditorBaseGraphData as GraphData | null')) {
    throw new Error('expected FlowEditor draft graph hydration to avoid raw store graph fallback under view-lock transitions')
  }
  if (!renderStateText.includes('setDraftGraphData(prev => (prev === base ? prev : base))')) {
    throw new Error('expected FlowEditor draft graph hydration to stay aligned with base graph for stable zoom/minimap state')
  }
  if (renderStateText.includes('if (!canEdit) {\n      setDraftGraphData(prev => (prev === null ? prev : null))')) {
    throw new Error('expected FlowEditor draft graph hydration to avoid editability-driven clears that break zoom/minimap alignment')
  }
  if (runtimeText.includes('keywordModeActive') || renderStateText.includes('keywordModeActive')) {
    throw new Error('expected FlowEditor draft graph hydration to stay independent from keyword-mode coupling')
  }
}

export function testFlowEditorInactiveWarmMountDoesNotMutateWidgetsAcrossRenderers() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const selectionBookkeepingPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorSelectionBookkeeping.ts')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const selectionBookkeepingText = readFileSync(selectionBookkeepingPath, 'utf8')
  if (!selectionBookkeepingText.includes('if (!active) return')) {
    throw new Error('expected FlowEditor selection bookkeeping to guard inactive warm mounts')
  }
  if (!selectionBookkeepingText.includes('if (!editorRuntimeActive || !flowEditorViewActive || !draftGraphData) return')) {
    throw new Error('expected FlowEditor widget pruning effect to guard non-flow-editor or draftless states')
  }
  if (!selectionBookkeepingText.includes('updateOpenWidgetNodeIds(prev => prev.filter')) {
    throw new Error('expected FlowEditor widget pruning effect to stay scoped to active Flow Editor bookkeeping')
  }
  if (!selectionBookkeepingText.includes('idSet.has(s)')) {
    throw new Error('expected FlowEditor widget pruning effect to filter ids to current graph nodes')
  }
  if (!runtimeText.includes('const flowEditorViewActive = editorRuntimeActive')) {
    throw new Error('expected FlowEditor runtime to keep flow-editor view activation renderer-scoped during warm mounts')
  }
}

export function testWidgetInitUsesLayoutHydrationAndRafClampCommit() {
  const nodeOverlayEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts')
  const text = readFileSync(nodeOverlayEditorPath, 'utf8')

  if (!text.includes('useIsomorphicLayoutEffect(() => {') || !text.includes('resolveFloatingPos(widgetPos, defaultFloatingPos)')) {
    throw new Error('expected widget floating position hydration to run in layout effect to avoid first-frame snap')
  }
  if (text.includes('pendingClampCommitRef') || text.includes('persistClamp')) {
    throw new Error('expected widget placement runtime to remove stale clamp commit scheduling and no-op clamp persistence')
  }
  if (!text.includes('applyOverlayPosition()')) {
    throw new Error('expected widget placement runtime to use immediate layout-position application for stable alignment')
  }
}

export function testFlowEditorWidgetGridFollowsToolbarAndAvoidsRightDocking() {
  const sharedPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'flowEditorCanvasShared.tsx')
  const sharedText = readFileSync(sharedPath, 'utf8')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  const nodeText = [
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx'),
    resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayPlacementRuntime.ts'),
  ].map(path => readFileSync(path, 'utf8')).join('\n')

  if (!sharedText.includes('export function readWidgetGridLayoutSettings(schema: unknown): {')) {
    throw new Error('expected FlowEditor widget layout to derive settings from toolbar grid behavior')
  }
  if (!collisionText.includes('const widgetGrid = readWidgetGridLayoutSettings(schema)')) {
    throw new Error('expected FlowEditor overlay collision/layout pass to read widget grid settings')
  }
  if (!collisionText.includes('computeCollectiveFollowPinnedScale')) {
    throw new Error('expected widget collision layout scale to reuse the shared follow-pinned scale helper')
  }
  if (!collisionText.includes('isFrontmatterFlow || widgetGrid.gridEnabled')) {
    throw new Error('expected widget dock layout to use centered grid strategy when toolbar grid is enabled')
  }
  if (!collisionText.includes('snapToGridPx(') || !collisionText.includes('snapScreen(')) {
    throw new Error('expected widget overlay positions to snap to toolbar grid increments')
  }
  if (!runtimeSceneText.includes('const widgetGrid = readWidgetGridLayoutSettings(args.schema)')) {
    throw new Error('expected widget seeded world positions to use toolbar grid settings')
  }

  if (nodeText.includes('floatingDockRef')) {
    throw new Error('expected widget overlay to avoid right-edge floating dock ref behavior')
  }
  if (nodeText.includes("mode: 'right'")) {
    throw new Error('expected widget overlay to avoid right-edge auto-docking mode')
  }
}

export function testFlowEditorWidgetPinDescriptionsAreActionClear() {
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const panelChromePath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'FlowEditorPanelChrome.tsx')
  const panelText = readFileSync(panelPath, 'utf8')
  const panelChromeText = readFileSync(panelChromePath, 'utf8')
  const copyPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiCopy.ts')
  const copyText = readFileSync(copyPath, 'utf8')
  const labelsPath = resolve(process.cwd(), 'src', 'lib', 'config-copy', 'uiMeta.ts')
  const labelsText = readFileSync(labelsPath, 'utf8')

  if (!(panelText + panelChromeText).includes('title={pinned ? UI_LABELS.unpinPanel : UI_LABELS.pinPanel}')) {
    throw new Error('expected widget pin button title to reflect explicit action for current state')
  }
  if (!panelChromeText.includes("'relative z-10 flex-none'")) {
    throw new Error('expected widget panel header to stay above rich-media body content so drag handles remain hittable at Flow Editor scale')
  }
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'useNodeOverlayDragHandlers.ts')
  const overlayText = readFileSync(overlayPath, 'utf8')
  if (overlayText.includes('if (pinnedInCanvas) return')) {
    throw new Error('expected widget header drag to allow the shared pinned world-position branch')
  }
  if (!overlayText.includes('if (!floating) {') || !overlayText.includes('persistWorldPos(out)')) {
    throw new Error('expected widget header drag to keep the pinned world-position drag branch active')
  }
  if (!labelsText.includes("pinPanel: 'Pin to canvas'")) {
    throw new Error('expected widget pin label to describe the pin action without stale drag-disabled copy')
  }
  if (!labelsText.includes("unpinPanel: 'Unpin from canvas'")) {
    throw new Error('expected widget unpin label to describe the unpin action without stale drag-enabled copy')
  }
  if (!copyText.includes("flowWidgetPin: 'Pin to canvas (follows canvas zoom/pan).'")) {
    throw new Error('expected widget pin tooltip copy to state zoom-follow without stale drag-disabled copy')
  }
  if (!copyText.includes("flowWidgetUnpin: 'Unpin from canvas (screen-positioned).'")) {
    throw new Error('expected widget unpin tooltip copy to state screen-positioned behavior without stale drag-enabled copy')
  }
}

export function testFlowEditorOverlayEdgesPreferRailPortAnchorsOverScrollingDotAnchors() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const text = readFileSync(flowEditorCanvasPath, 'utf8')
  if (!text.includes('const dotBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="dot"]`)')) {
    throw new Error('expected overlay edge anchor selector to read dot handle candidate explicitly')
  }
  if (!text.includes('const railBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="rail"]`)')) {
    throw new Error('expected overlay edge anchor selector to read rail handle candidate explicitly')
  }
  if (!text.includes('const dotVisible = !!(')) {
    throw new Error('expected overlay edge anchor selector to gate dot usage by visible panel bounds')
  }
  if (!text.includes('const nextAnchor = (dotVisible ? dotAnchor : null) || railAnchor || dotAnchor || fallbackAnchor')) {
    throw new Error('expected overlay edge anchor selector to fallback to rail anchor when dot is out of panel view')
  }
  if (!text.includes('const clampedY =')) {
    throw new Error('expected overlay edge anchor position to clamp Y within widget bounds')
  }
  if (!text.includes("const dotEl = btn.querySelector('span') as HTMLElement | null")) {
    throw new Error('expected overlay edge anchor to compute center from inner dot element when present')
  }
}

export function testFlowEditorPortHandleEdgeConnectivityUsesEndpointIdResolver() {
  const portHandlesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPortHandles.tsx')
  const portHandlesText = readFileSync(portHandlesPath, 'utf8')
  const handlesPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'handles.ts')
  const handlesText = readFileSync(handlesPath, 'utf8')
  const buildNativeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'buildNativeScene.ts')
  const buildNativeSceneText = readFileSync(buildNativeScenePath, 'utf8')
  const elkLayoutPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'elkLayout.ts')
  const elkLayoutText = readFileSync(elkLayoutPath, 'utf8')
  const flowDataflowPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'flowDataflow.ts')
  const flowDataflowText = readFileSync(flowDataflowPath, 'utf8')
  const draftActionsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorNodeDraftActions.ts')
  const draftActionsText = readFileSync(draftActionsPath, 'utf8')
  const endpointHelperPath = resolve(process.cwd(), 'src', 'lib', 'graph', 'edgeEndpoints.ts')
  const endpointHelperText = readFileSync(endpointHelperPath, 'utf8')

  if (!endpointHelperText.includes('export function readEdgeEndpointId')) {
    throw new Error('expected shared edge endpoint id resolver helper for object/string edge endpoint compatibility')
  }
  if (
    !portHandlesText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")
    || !portHandlesText.includes('const { src: source, tgt: target } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected widget port handle edge coercion to resolve object-form edge endpoints via shared pair helper')
  }
  if (
    !handlesText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")
    || !handlesText.includes('const { src: source, tgt: target } = readGraphEdgeEndpoints(edge)')
    || !handlesText.includes('const { src: source, tgt: target } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected flow handle computation to resolve edge endpoints via shared pair helper')
  }
  if (!handlesText.includes('const cacheKey = buildFlowHandlesByNodeSignature(args)')) {
    throw new Error('expected flow handle computation to derive a semantic cache key before rebuilding node handles')
  }
  if (!handlesText.includes('return writeCachedFlowHandlesByNode(cacheKey, out)')) {
    throw new Error('expected flow handle computation to reuse cached results across stable graph semantics')
  }
  if (!portHandlesText.includes('const edgeConnectivitySignature = React.useMemo(() => {')) {
    throw new Error('expected widget port handle overlay to derive semantic edge connectivity signatures before coercing edge endpoints')
  }
  if (!portHandlesText.includes('const registryEntriesSignature = React.useMemo(() => {')) {
    throw new Error('expected widget port handle overlay to derive semantic registry signatures before recomputing handles')
  }
  if (!portHandlesText.includes('const nodePropertiesSignature = React.useMemo(() => {')) {
    throw new Error('expected widget port handle overlay to derive semantic node property signatures before recomputing handles')
  }
  if (
    !buildNativeSceneText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")
    || !buildNativeSceneText.includes('const { src: source, tgt: target } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected flow native scene edge construction to resolve endpoint ids via shared edge endpoint helper')
  }
  if (
    !elkLayoutText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")
    || !elkLayoutText.includes('const { src: source, tgt: target } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected flow ELK layout edge shaping to resolve endpoint ids via shared edge endpoint helper')
  }
  if (
    !flowDataflowText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")
    || !flowDataflowText.includes('const { src, tgt } = readGraphEdgeEndpoints(edge)')
    || !flowDataflowText.includes('const { src: sourceId, tgt: targetId } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected flow dataflow connected-value pipeline to resolve edge endpoints via shared pair helper')
  }
  if (
    !draftActionsText.includes("import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'")
    || !draftActionsText.includes('const { src, tgt } = readGraphEdgeEndpoints(e)')
  ) {
    throw new Error('expected flow editor draft actions to resolve incident edge endpoints via shared pair helper')
  }
}

export function testFlowEditorWidgetOverlaysDefaultToFloatingBalancedZoomFollow() {
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const placementAuthorityPath = resolve(process.cwd(), 'src', 'lib', 'flowEditor', 'widgetPlacementAuthority.ts')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorInner.tsx')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const renderGraphHelperPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorRenderGraph.ts')
  const overlaySurfaceText = readFileSync(overlaySurfacePath, 'utf8')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  const placementAuthorityText = readFileSync(placementAuthorityPath, 'utf8')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const overlaySurfaceElementsText = readFileSync(overlaySurfaceElementsPath, 'utf8')
  const renderGraphHelperText = readFileSync(renderGraphHelperPath, 'utf8')
  if (overlaySurfaceText.includes('forcePinnedToCanvas')) {
    throw new Error('expected FlowEditor overlay widgets to avoid legacy force-pinned canvas mode')
  }
  if (!placementAuthorityText.includes('export function resolveDefaultFlowWidgetPinnedInCanvas')) {
    throw new Error('expected FlowEditor widget placement authority to expose shared default pinning rules')
  }
  if (!renderGraphHelperText.includes('export function getCachedFlowEditorWidgetPlacementContext(args: {')) {
    throw new Error('expected FlowEditor runtime helper to centralize widget placement context derivation')
  }
  if (!runtimeSceneText.includes("return typeof v === 'boolean' ? v : defaultPinnedInCanvas")) {
    throw new Error('expected zoom-follow pinned buckets to defer undefined pin state to shared default pinning rules')
  }
  if (!runtimeSceneText.includes('const widgetPlacementContext = getCachedFlowEditorWidgetPlacementContext({')) {
    throw new Error('expected runtime scene to reuse the shared widget placement context for frontmatter seeding decisions')
  }
  if (!overlayText.includes("openWidgetNodeCount: Array.isArray(s.openWidgetNodeIds) ? s.openWidgetNodeIds.length : 0")) {
    throw new Error('expected widget overlay scale follow to depend on semantic open-widget count rather than raw array identity')
  }
  if (!renderGraphHelperText.includes('incidentEdgesByNodeId: baseLookup.incidentEdgesByNodeId')) {
    throw new Error('expected FlowEditor render-graph helper to reuse cached per-node incident edges from the shared graph lookup')
  }
  if (!renderGraphHelperText.includes('const defaultPinnedInCanvas = resolveDefaultFlowWidgetPinnedInCanvas({ graphMetaKind })')) {
    throw new Error('expected widget placement context helper to own shared default pinning rules')
  }
  if (
    !overlaySurfaceElementsText.includes('const portHandleEdges =')
    || !overlaySurfaceElementsText.includes('args.renderGraphIncidentEdgesByNodeId?.get(actionNodeId)')
    || !overlaySurfaceElementsText.includes('|| EMPTY_GRAPH_EDGES')
  ) {
    throw new Error('expected overlay surface to pass only node-local cached edges into each widget overlay')
  }
  if (!overlaySurfaceText.includes('const renderGraphPlacementContext = React.useMemo(() => {')) {
    throw new Error('expected overlay surface to reuse the shared widget placement context')
  }
  if (!overlayText.includes('registryEntries={registryEntries}')) {
    throw new Error('expected widget overlay editor to reuse upstream merged registry entries instead of rebuilding a local registry')
  }
}

export function testFlowEditorPinnedWidgetForbidsAccidentalDuplicateCopy() {
  const toolbarPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorActionsToolbar.tsx')
  const toolbarText = readFileSync(toolbarPath, 'utf8')
  const overlayPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorView.tsx')
  const overlayText = readFileSync(overlayPath, 'utf8')
  const overlaySurfaceElementsPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'flowEditorOverlaySurfaceElements.tsx')
  const overlaySurfaceElementsText = readFileSync(overlaySurfaceElementsPath, 'utf8')
  if (!toolbarText.includes('duplicateDisabled: boolean')) {
    throw new Error('expected widget actions toolbar to accept duplicateDisabled guard for accidental copy prevention')
  }
  if (!toolbarText.includes('{showDuplicateAction && !duplicateDisabled ? (')) {
    throw new Error('expected duplicate action to be removed when accidental-copy guard is active')
  }
  if (!overlayText.includes('duplicateDisabled={pinnedInCanvas}')) {
    throw new Error('expected duplicate guard to activate only for explicitly pinned widgets')
  }
  if (!overlaySurfaceElementsText.includes('const pinned = pinnedMap[actionNodeId] === true')) {
    throw new Error('expected widget duplicate callback to guard only explicit pinned state before copying')
  }
  if (!overlaySurfaceElementsText.includes('Pinned widget blocks duplicate copy.')) {
    throw new Error('expected widget duplicate guard to notify user when copy is blocked in pinned mode')
  }
}
