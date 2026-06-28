import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowEditorFrontmatterRichMediaOverlayPoolDisablesStickyCarryover() {
  const graphStatePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasGraphState.ts')
  const text = readFileSync(graphStatePath, 'utf8')
  if (!text.includes("canvas2dRenderer === 'storyboard'\n    || (!flowEditorOverlayInteractionMode && !flowEditorFrontmatterInteractionMode)")) {
    throw new Error('expected Storyboard to preserve Rich Media overlays across transient interaction frames while Flow Editor/frontmatter disable sticky carryover')
  }
  if (!text.includes('if (!useStickyOverlayPool) {')) {
    throw new Error('expected Flow Editor/frontmatter Rich Media overlay pool to follow the live suggested overlay set directly')
  }
  if (!text.includes('stickyMap.clear()')) {
    throw new Error('expected Flow Editor/frontmatter Rich Media overlay pool to clear stale sticky overlay entries before following the live set')
  }
}

export function testFlowEditorFrontmatterWidgetFallbackIsScopedToActiveSource() {
  const overlaySurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlaySurface.tsx')
  const text = readFileSync(overlaySurfacePath, 'utf8')
  if (!text.includes('const lastStableOverlayEditorNodeIdsSourceKeyRef = React.useRef<string>(\'\')')) {
    throw new Error('expected Flow Editor/frontmatter widget overlay fallback ids to be scoped by active source selection')
  }
  if (!text.includes('activeSourceSelectionKey && activeSourceSelectionKey !== lastSourceKey')) {
    throw new Error('expected Flow Editor/frontmatter widget overlay fallback to reject stale ids after active source changes')
  }
  if (!text.includes('flowEditorFrontmatterGraphAvailable || activeSourceFrontmatterFlowAvailable')) {
    throw new Error('expected same-source frontmatter handoff frames to keep stable overlay ids while render graph data is transiently replaced')
  }
  if (!text.includes('if (activeSourceParsedGraphKnown) return false')) {
    throw new Error('expected same-source frontmatter handoff fallback to stop once the active source is known to be non-frontmatter')
  }
  if (!text.includes('const preserveStableFrontmatterGraph =')) {
    throw new Error('expected same-source frontmatter handoff graphs not to replace the stable widget node resolver graph')
  }
}

export function testFlowEditorOverlayCollisionResetsTransientKeysWhenOverlaySetDisappears() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(collisionPath, 'utf8')
  if (!text.includes('const resetOverlayCollisionTransientState = React.useCallback((clearRectCache = false) => {')) {
    throw new Error('expected Flow Editor overlay collision runtime to centralize transient-state reset when overlay ids disappear')
  }
  if (!text.includes('if (overlayNodeIds.length < 2) {\n        resetOverlayCollisionTransientState(true)\n        return\n      }')) {
    throw new Error('expected Flow Editor overlay collision runtime to invalidate stale resolve keys when the overlay set transiently disappears')
  }
  if (!text.includes('if (items.length === 0) {\n        resetOverlayCollisionTransientState(true)\n        return\n      }')) {
    throw new Error('expected Flow Editor overlay collision runtime to drop stale rect cache when no movable overlay items remain')
  }
}

export function testFlowEditorOverlayEdgesReuseStableGraphForMetadataLessHandoff() {
  const edgePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const surfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'FlowEditorCanvasSurface.tsx')
  const text = readFileSync(edgePath, 'utf8')
  const surfaceText = readFileSync(surfacePath, 'utf8')
  if (!surfaceText.includes('{(props.overlayOnlyActive || props.hasOverlayEditors || storyboardCardsActive) && (')) {
    throw new Error('expected Flow Editor overlay edge host to stay mounted whenever overlay editors are visible or storyboard cards are active')
  }
  if (!text.includes('const liveGraphMetaKind = String(((liveGraph?.metadata || {}) as Record<string, unknown>).kind || \'\').trim()')) {
    throw new Error('expected Flow Editor overlay edges to inspect live graph metadata before accepting handoff graphs')
  }
  for (const snippet of [
    'const liveGraphRevision = readGraphDataRevision(liveGraph)',
    'const stableGraphRevision = readGraphDataRevision(stableGraph)',
    'const canReuseMetadataLessStableGraph =',
    'liveGraphRevision === stableGraphRevision',
    'liveGraphNodeCount === stableGraphNodeCount',
    'liveGraphEdgeCount === stableGraphEdgeCount',
  ]) {
    if (!text.includes(snippet)) {
      throw new Error(`expected metadata-less handoff reuse to stay scoped to matching live/stable graph revisions or equal zero-revision counts: ${snippet}`)
    }
  }
  if (!text.includes('|| (\n            canReuseMetadataLessStableGraph\n          )')) {
    throw new Error('expected metadata-less handoff graphs to reuse the stable overlay edge graph only through the explicit handoff guard')
  }
  const stableWriteIndex = text.indexOf('lastStableOverlayEdgeGraphRef.current = graph')
  const emptyFilteredIndex = text.indexOf("pushOverlayEdgeTrace('empty-filtered-edge-set'")
  if (stableWriteIndex < 0 || emptyFilteredIndex < 0 || stableWriteIndex < emptyFilteredIndex) {
    throw new Error('expected stable overlay edge graph to advance only after the live graph resolves overlay edges')
  }
  if (!text.includes('if (rawNodes.length > 0 && rawEdges.length > 0)')) {
    throw new Error('expected successful overlay edge graphs to seed stable edge fallback in Editor Workspace too')
  }
  if (!text.includes('if (!node) {\n      cacheFrozenOverlayEdgePaths()')) {
    throw new Error('expected Flow Editor overlay edges to freeze paths before SVG detach during workspace handoff')
  }
  if (!text.includes('const restoredFrozenPathCount = restoreFrozenOverlayEdgePaths(node)')) {
    throw new Error('expected Flow Editor overlay edges to restore frozen paths in Editor Workspace handoffs')
  }
  if (text.includes('http://127.0.0.1:7777/event')) {
    throw new Error('forbid hardcoded debug event sinks inside the Flow Editor overlay edge runtime')
  }
}

export function testFlowEditorOverlayCollisionRebalancesOnGraphContentRevision() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const runtimeStorePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeStoreState.ts')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  const runtimeStoreText = readFileSync(runtimeStorePath, 'utf8')
  if (!collisionText.includes('graphContentRevision: number')) {
    throw new Error('expected Flow Editor overlay collision hook to accept graphContentRevision so indexing recomposition can invalidate stale layout state')
  }
  if (!collisionText.includes('resetOverlayCollisionTransientState()\n    scheduleOverlayCollisionResolve()')) {
    throw new Error('expected Flow Editor overlay collision effect to clear stale resolve keys before rebalancing on graph-content changes')
  }
  if (!collisionText.includes('args.graphContentRevision,')) {
    throw new Error('expected Flow Editor overlay collision effect dependencies to include graphContentRevision')
  }
  if (!runtimeStoreText.includes('graphContentRevision: s.graphContentRevision || 0')) {
    throw new Error('expected Flow Editor runtime to read graphContentRevision from store')
  }
  if (!runtimeText.includes('graphContentRevision,')) {
    throw new Error('expected Flow Editor runtime to pass graphContentRevision into overlay collision hook')
  }
}
