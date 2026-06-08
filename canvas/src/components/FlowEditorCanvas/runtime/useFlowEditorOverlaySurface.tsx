import React from 'react'
import {
  deriveOpenWidgetOverlayNodeIds,
  isCanonicalFrontmatterBuiltInWidgetNode,
  resolveDefaultFlowWidgetPinnedInCanvas,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { computeFlowConnectedValuesBySchemaPath, type FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import { shouldDeferComposedGraphRender } from '@/features/source-files/composedApplyGuards'
import {
  buildComposedSourceFileSelectionKey,
  resolvePreferredEnabledComposedSourceFile,
} from '@/features/source-files/composedSourceSelection'
import {
  hashScopedStringArraySignature,
  hashSignatureParts,
  normalizeStringArrayForSignature,
} from '@/lib/hash/signature'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { resolveScopedFlowWidgetNodeMap } from '@/lib/flowEditor/widgetStateScope'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import { isFlowEditorQeTraceEnabled, pushFlowEditorQeTrace } from '@/lib/flowEditor/flowEditorQeTrace'
import {
  buildRichMediaConnectedValueTargetNodeIdSet,
  listDisplayRichMediaOverlayNodes,
} from '@/lib/render/richMediaSsot'
import {
  getCachedFlowEditorRenderGraph,
  getCachedFlowEditorWidgetPlacementContext,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import { type FrontmatterOverlayOnlyCoverageCache, resolveFrontmatterOverlayVisualIsolationWithStableCoverage } from '@/components/FlowEditorCanvas/runtime/flowEditorOverlayCoverage'
import { buildOverlayEditorElements } from '@/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceElements'
import {
  buildFlowCanvasGraphDataOverride,
  resolveOverlayOnlyActive,
} from '@/components/FlowEditorCanvas/runtime/flowEditorOverlaySurfaceVisibility'
const EMPTY_GRAPH_NODES: GraphNode[] = []
const EMPTY_GRAPH_EDGES: GraphEdge[] = []
const EMPTY_GRAPH_NODE_BY_ID = new Map<string, GraphNode>()
const EMPTY_GRAPH_ELIGIBLE_NODE_IDS = new Set<string>()

type StableFrontmatterOverlaySurfaceCache = {
  sourceKey: string
  graphKey: string
  ids: string[]
  graphData: GraphData | null
}

const stableFrontmatterOverlaySurfaceCacheById = new Map<string, StableFrontmatterOverlaySurfaceCache>()

function normalizeOverlaySurfaceCacheKey(surfaceId: unknown): string {
  return String(surfaceId || '').trim() || 'surface'
}

function readStableFrontmatterOverlaySurfaceCache(surfaceId: unknown): StableFrontmatterOverlaySurfaceCache | null {
  return stableFrontmatterOverlaySurfaceCacheById.get(normalizeOverlaySurfaceCacheKey(surfaceId)) || null
}

function writeStableFrontmatterOverlaySurfaceCache(surfaceId: unknown, cache: StableFrontmatterOverlaySurfaceCache): void {
  const ids = normalizeStringArrayForSignature(cache.ids, { unique: true })
  if (ids.length === 0) return
  stableFrontmatterOverlaySurfaceCacheById.set(normalizeOverlaySurfaceCacheKey(surfaceId), {
    sourceKey: String(cache.sourceKey || '').trim(),
    graphKey: String(cache.graphKey || '').trim(),
    ids,
    graphData: cache.graphData,
  })
}

function clearStableFrontmatterOverlaySurfaceCache(surfaceId: unknown): void {
  stableFrontmatterOverlaySurfaceCacheById.delete(normalizeOverlaySurfaceCacheKey(surfaceId))
}

function isGraphDataLike(value: unknown): value is GraphData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as { nodes?: unknown; edges?: unknown }
  return Array.isArray(candidate.nodes) || Array.isArray(candidate.edges)
}

export function useFlowEditorOverlaySurface(args: {
  flowEditorSurfaceId: string
  canEdit: boolean
  flowEditorViewActive: boolean
  flowEditorFrontmatterGraphAvailable: boolean
  geospatialWidgetPanelMode?: boolean
  renderGraphDataOverride: GraphData | null
  baseGraphDataRevision: number
  draftGraphDataRevision: number
  overlayTopologyLayoutSignature: string
  openWidgetNodeIds: string[]
  overlayDraftNode: GraphNode | null
  pendingOverlayNode: GraphNode | null
  pendingOverlayNodeIdRef: React.MutableRefObject<string | null>
  lastDroppedWidgetNodeIdRef: React.MutableRefObject<string | null>
  lastDroppedWidgetToken: number
  toolMode: 'select' | 'addEdge'
  pendingEdgeSourceId: string | null
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  zoomViewKey: string | null
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  beginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  finalizePendingEdge: (nodeId: string, portKey?: string | null) => void
  setNodeLabelById: (nodeId: string, label: string) => void
  setNodeTypeById: (nodeId: string, type: string) => void
  patchNodePropertiesById: (nodeId: string, patch: Record<string, unknown>) => void
  setNodePropertiesById: (nodeId: string, properties: Record<string, unknown>) => void
  validateNodeById: (nodeId: string) => void
  runWorkflowNode: (nodeId: string) => Promise<void> | void
  duplicateNodeById: (nodeId: string) => void
  removeNodeById: (nodeId: string) => void
  clearNodeOutputById: (nodeId: string) => void
  showNodeEditorHelp: () => void
  convertNodeToLoopById: (nodeId: string) => void
  enableHandlesForAllInputs: () => void
  renameSchemaFieldIdByNodeId: (nodeId: string, prevId: string, nextId: string) => void
  scheduleOverlayCollisionResolve: () => void
  upsertUiToast: (args: { id: string; kind: 'neutral' | 'warning' | 'success' | 'error'; message: string; ttlMs?: number }) => void
  widgetRegistry: ReadonlyArray<WidgetRegistryEntry>
  flowWidgetPinnedByNodeId?: Record<string, boolean>
}) {
  const {
    flowEditorSurfaceId,
    canEdit,
    flowEditorViewActive,
    flowEditorFrontmatterGraphAvailable,
    geospatialWidgetPanelMode,
    renderGraphDataOverride,
    baseGraphDataRevision,
    draftGraphDataRevision,
    overlayTopologyLayoutSignature,
    openWidgetNodeIds,
    overlayDraftNode,
    pendingOverlayNode,
    pendingOverlayNodeIdRef,
    lastDroppedWidgetNodeIdRef,
    lastDroppedWidgetToken,
    toolMode,
    pendingEdgeSourceId,
    viewportW,
    viewportH,
    canvasWindowOffset,
    zoomViewKey,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    getLiveContainmentGroupAabbForNode,
    beginAddEdgeFromNode,
    finalizePendingEdge,
    setNodeLabelById,
    setNodeTypeById,
    patchNodePropertiesById,
    setNodePropertiesById,
    validateNodeById,
    runWorkflowNode,
    duplicateNodeById,
    removeNodeById,
    clearNodeOutputById,
    showNodeEditorHelp,
    convertNodeToLoopById,
    enableHandlesForAllInputs,
    renameSchemaFieldIdByNodeId,
    scheduleOverlayCollisionResolve,
    upsertUiToast,
    widgetRegistry,
    flowWidgetPinnedByNodeId,
  } = args
  const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))
  const workspaceOverlayOpen = useGraphStore(s => isWorkspaceEditorOverlayOpen(s))
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const explorerActivePath = useMarkdownExplorerStore(s => s.activePath)
  const overlayEditorNodeIdsRef = React.useRef<string[]>([])
  const lastStableOverlayEditorNodeIdsRef = React.useRef<string[]>([])
  const lastStableOverlayEditorNodeIdsGraphKeyRef = React.useRef<string>('')
  const lastStableOverlayEditorNodeIdsSourceKeyRef = React.useRef<string>('')
  const renderGraphDataOverrideRef = React.useRef<GraphData | null>(renderGraphDataOverride)
  const lastStableRenderGraphDataOverrideRef = React.useRef<GraphData | null>(renderGraphDataOverride)
  const previousActiveSourceSelectionKeyRef = React.useRef<string>('')

  const activeSourceFile = React.useMemo(
    () => resolvePreferredEnabledComposedSourceFile({
      sourceFiles,
      markdownDocumentName,
      explorerActivePath,
      fallbackName: markdownDocumentName,
    }),
    [explorerActivePath, markdownDocumentName, sourceFiles],
  )
  const activeSourceSelectionKey = React.useMemo(
    () => buildComposedSourceFileSelectionKey(activeSourceFile),
    [activeSourceFile],
  )
  const stableOverlaySurfaceCacheKey = React.useMemo(() => {
    const sourceKey = String(activeSourceSelectionKey || '').trim()
    if (workspaceOverlayOpen && sourceKey) return `workspace:${sourceKey}`
    return normalizeOverlaySurfaceCacheKey(flowEditorSurfaceId)
  }, [activeSourceSelectionKey, flowEditorSurfaceId, workspaceOverlayOpen])
  const activeSourceFrontmatterFlowAvailable = React.useMemo(
    () => isFrontmatterFlowGraph(activeSourceFile?.parsedGraphData),
    [activeSourceFile],
  )
  const activeSourceParsedGraphKnown = React.useMemo(
    () => isGraphDataLike(activeSourceFile?.parsedGraphData),
    [activeSourceFile],
  )

  const cachedStableOverlaySurface = readStableFrontmatterOverlaySurfaceCache(stableOverlaySurfaceCacheKey)
  if (
    cachedStableOverlaySurface
    && lastStableOverlayEditorNodeIdsRef.current.length === 0
    && (!activeSourceSelectionKey || cachedStableOverlaySurface.sourceKey === activeSourceSelectionKey)
  ) {
    lastStableOverlayEditorNodeIdsRef.current = cachedStableOverlaySurface.ids
    lastStableOverlayEditorNodeIdsGraphKeyRef.current = cachedStableOverlaySurface.graphKey
    lastStableOverlayEditorNodeIdsSourceKeyRef.current = cachedStableOverlaySurface.sourceKey
    lastStableRenderGraphDataOverrideRef.current = cachedStableOverlaySurface.graphData
  }

  React.useEffect(() => {
    const previous = previousActiveSourceSelectionKeyRef.current
    if (previous && activeSourceSelectionKey && previous !== activeSourceSelectionKey) {
      lastStableOverlayEditorNodeIdsRef.current = []
      lastStableOverlayEditorNodeIdsGraphKeyRef.current = ''
      lastStableOverlayEditorNodeIdsSourceKeyRef.current = ''
      clearStableFrontmatterOverlaySurfaceCache(stableOverlaySurfaceCacheKey)
    }
    if (activeSourceSelectionKey) previousActiveSourceSelectionKeyRef.current = activeSourceSelectionKey
  }, [activeSourceSelectionKey, stableOverlaySurfaceCacheKey])

  React.useEffect(() => {
    if (!flowEditorViewActive) {
      if (workspaceMutationBlocked) return
      if (workspaceOverlayOpen) return
      lastStableOverlayEditorNodeIdsRef.current = []
      lastStableOverlayEditorNodeIdsGraphKeyRef.current = ''
      lastStableOverlayEditorNodeIdsSourceKeyRef.current = ''
      clearStableFrontmatterOverlaySurfaceCache(stableOverlaySurfaceCacheKey)
    }
  }, [flowEditorViewActive, stableOverlaySurfaceCacheKey, workspaceMutationBlocked, workspaceOverlayOpen])

  const openWidgetNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('open-widget-node-ids', openWidgetNodeIds),
    [openWidgetNodeIds],
  )
  const openWidgetNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (openWidgetNodeIdsSnapshotRef.current?.key !== openWidgetNodeIdsKey) {
    openWidgetNodeIdsSnapshotRef.current = {
      key: openWidgetNodeIdsKey,
      value: normalizeStringArrayForSignature(openWidgetNodeIds, { unique: true }),
    }
  }
  const openWidgetNodeIdsSnapshot = openWidgetNodeIdsSnapshotRef.current.value
  const renderGraphDataRevision = React.useMemo(() => {
    const revision = readGraphDataRevision(renderGraphDataOverride)
    if (revision > 0) return revision
    return flowEditorViewActive ? draftGraphDataRevision : baseGraphDataRevision
  }, [baseGraphDataRevision, draftGraphDataRevision, flowEditorViewActive, renderGraphDataOverride])
  const renderGraphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('flow-editor-overlay-surface-render-graph', {
      graphData: renderGraphDataOverride,
      graphRevision: renderGraphDataRevision,
    }),
    [renderGraphDataOverride, renderGraphDataRevision],
  )
  const renderGraphLookup = React.useMemo(() => {
    return getCachedFlowEditorRenderGraph({
      scope: 'flow-editor-overlay-surface-render-graph',
      graphData: renderGraphDataOverride,
      graphRevision: renderGraphDataRevision,
      preferCurrentGraphDataRefs: true,
    })
  }, [renderGraphDataOverride, renderGraphDataRevision])
  const renderGraphNodes = renderGraphLookup?.nodes || EMPTY_GRAPH_NODES
  const renderGraphEdges = renderGraphLookup?.edges || EMPTY_GRAPH_EDGES
  const renderGraphNodeById = renderGraphLookup?.nodeById || EMPTY_GRAPH_NODE_BY_ID
  const renderGraphIncidentEdgesByNodeId = renderGraphLookup?.incidentEdgesByNodeId || null
  const renderGraphEligibleNodeIds = renderGraphLookup?.eligibleNodeIds || EMPTY_GRAPH_ELIGIBLE_NODE_IDS
  const renderGraphPlacementContext = React.useMemo(() => {
    return getCachedFlowEditorWidgetPlacementContext({
      graphData: renderGraphDataOverride,
      graphRevision: renderGraphDataRevision,
      openWidgetNodeIds: openWidgetNodeIdsSnapshot,
      preferCurrentGraphDataRefs: true,
    })
  }, [openWidgetNodeIdsSnapshot, renderGraphDataOverride, renderGraphDataRevision])
  const renderGraphMetaKind = renderGraphPlacementContext?.graphMetaKind || renderGraphLookup?.graphMetaKind || null
  const renderGraphMetaKey = React.useMemo(
    () => buildGraphMetaKeyIgnoringPending(renderGraphDataOverride),
    [renderGraphDataOverride],
  )
  const deferComposedGraphOverlayRender = React.useMemo(
    () => shouldDeferComposedGraphRender({
      graphData: renderGraphDataOverride,
      layers: sourceFiles,
    }),
    [renderGraphDataOverride, sourceFiles],
  )

  const overlayEditorNodeIds = React.useMemo(() => {
    const rememberStableOverlayIds = (ids: string[]) => {
      lastStableOverlayEditorNodeIdsRef.current = ids
      lastStableOverlayEditorNodeIdsGraphKeyRef.current = renderGraphSemanticKey
      lastStableOverlayEditorNodeIdsSourceKeyRef.current = activeSourceSelectionKey
      writeStableFrontmatterOverlaySurfaceCache(stableOverlaySurfaceCacheKey, {
        sourceKey: activeSourceSelectionKey,
        graphKey: renderGraphSemanticKey,
        ids,
        graphData: renderGraphDataOverride,
      })
    }
    const readLastStableForCurrentSource = (): string[] => {
      const lastStable = lastStableOverlayEditorNodeIdsRef.current
      if (lastStable.length === 0) return []
      const lastSourceKey = lastStableOverlayEditorNodeIdsSourceKeyRef.current
      if (activeSourceSelectionKey && activeSourceSelectionKey !== lastSourceKey) return []
      return lastStable
    }
    const shouldKeepLastStableForFrontmatterHandoff = (): boolean => {
      if (flowEditorFrontmatterGraphAvailable || activeSourceFrontmatterFlowAvailable) return true
      if (activeSourceParsedGraphKnown) return false
      return !renderGraphMetaKind
    }
    if (deferComposedGraphOverlayRender) {
      if (shouldKeepLastStableForFrontmatterHandoff()) return readLastStableForCurrentSource()
      return []
    }
    if (!flowEditorViewActive) {
      const isFrontmatterFlow = renderGraphPlacementContext?.isFrontmatterFlow === true
      if (workspaceOverlayOpen && isFrontmatterFlow) {
        const sorted = renderGraphPlacementContext?.frontmatterOverlayNodeIds || []
        if (sorted.length > 0) {
          rememberStableOverlayIds(sorted)
          return sorted
        }
      }
      const lastStable = readLastStableForCurrentSource()
      if (workspaceOverlayOpen && lastStable.length > 0) return lastStable
      if (workspaceMutationBlocked && lastStable.length > 0) return lastStable
      return []
    }
    const isFrontmatterFlow = renderGraphPlacementContext?.isFrontmatterFlow === true
    const nodes = renderGraphNodes
    const nodeById = renderGraphNodeById
    if (isFrontmatterFlow) {
      const sorted = renderGraphPlacementContext?.frontmatterOverlayNodeIds || []
      if (sorted.length > 0) {
        rememberStableOverlayIds(sorted)
        return sorted
      }
      const lastStable = readLastStableForCurrentSource()
      const sameGraphAsLastStable = lastStableOverlayEditorNodeIdsGraphKeyRef.current === renderGraphSemanticKey
      if (lastStable.length > 0 && (sameGraphAsLastStable || workspaceMutationBlocked || nodes.length === 0)) return lastStable
      return []
    }
    if (shouldKeepLastStableForFrontmatterHandoff()) {
      const lastStable = readLastStableForCurrentSource()
      if (lastStable.length > 0) return lastStable
      return []
    }
    const next = deriveOpenWidgetOverlayNodeIds({
      graphData: renderGraphDataOverride,
      openWidgetNodeIds: openWidgetNodeIdsSnapshot,
      eligibleNodeIds: renderGraphEligibleNodeIds,
      nodeById,
      selectedNodeId: overlayDraftNode?.id || null,
    })
    if (next.length > 0) rememberStableOverlayIds(next)
    return next
  }, [
    activeSourceFrontmatterFlowAvailable,
    activeSourceParsedGraphKnown,
    activeSourceSelectionKey,
    flowEditorFrontmatterGraphAvailable,
    flowEditorViewActive,
    overlayDraftNode?.id,
    renderGraphDataOverride,
    renderGraphPlacementContext,
    openWidgetNodeIdsSnapshot,
    renderGraphEligibleNodeIds,
    renderGraphMetaKind,
    renderGraphNodeById,
    renderGraphNodes,
    renderGraphSemanticKey,
    stableOverlaySurfaceCacheKey,
    workspaceMutationBlocked,
    workspaceOverlayOpen,
    deferComposedGraphOverlayRender,
  ])

  React.useEffect(() => {
    overlayEditorNodeIdsRef.current = overlayEditorNodeIds
  }, [overlayEditorNodeIds])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isFlowEditorQeTraceEnabled(window)) return

    const graphNodes = renderGraphNodes.length
    const graphEdges = renderGraphEdges.length
    pushFlowEditorQeTrace(window, {
      kind: 'overlay-surface',
      active: canEdit ? 1 : 0,
      view: flowEditorViewActive ? 1 : 0,
      frontmatterGraph: flowEditorFrontmatterGraphAvailable ? 1 : 0,
      graphNodes,
      graphEdges,
      openWidgetCount: openWidgetNodeIdsSnapshot.length,
      overlayCount: overlayEditorNodeIds.length,
      overlayIdsHead: overlayEditorNodeIds.slice(0, 8).join(','),
      overlayOnlyActive: overlayEditorNodeIds.length > 0 ? 1 : 0,
      activeSourceSelectionKey,
      activeSourceFrontmatterFlowAvailable: activeSourceFrontmatterFlowAvailable ? 1 : 0,
      activeSourceParsedGraphKnown: activeSourceParsedGraphKnown ? 1 : 0,
      lastStableSourceSelectionKey: lastStableOverlayEditorNodeIdsSourceKeyRef.current,
      deferComposedGraphOverlayRender: deferComposedGraphOverlayRender ? 1 : 0,
      graphMetaKind: renderGraphMetaKind || '',
    })
  }, [
    activeSourceFrontmatterFlowAvailable,
    activeSourceParsedGraphKnown,
    activeSourceSelectionKey,
    canEdit,
    deferComposedGraphOverlayRender,
    flowEditorFrontmatterGraphAvailable,
    flowEditorViewActive,
    overlayEditorNodeIds,
    openWidgetNodeIdsKey,
    openWidgetNodeIdsSnapshot.length,
    renderGraphMetaKind,
    renderGraphDataRevision,
    renderGraphEdges.length,
    renderGraphNodes.length,
  ])

  React.useEffect(() => {
    renderGraphDataOverrideRef.current = renderGraphDataOverride
    const nodeCount = Array.isArray(renderGraphDataOverride?.nodes) ? renderGraphDataOverride.nodes.length : 0
    if (!renderGraphDataOverride || nodeCount <= 0) return
    const activeSourceMatchesStableOverlay =
      !!activeSourceSelectionKey
      && activeSourceSelectionKey === lastStableOverlayEditorNodeIdsSourceKeyRef.current
      && lastStableOverlayEditorNodeIdsRef.current.length > 0
    const graphIsFrontmatterFlow = isFrontmatterFlowGraph(renderGraphDataOverride)
    const preserveStableFrontmatterGraph =
      activeSourceMatchesStableOverlay
      && !graphIsFrontmatterFlow
      && (
        flowEditorFrontmatterGraphAvailable
        || activeSourceFrontmatterFlowAvailable
        || !activeSourceParsedGraphKnown
        || !renderGraphMetaKind
      )
    if (preserveStableFrontmatterGraph) return
    lastStableRenderGraphDataOverrideRef.current = renderGraphDataOverride
  }, [
    activeSourceFrontmatterFlowAvailable,
    activeSourceParsedGraphKnown,
    activeSourceSelectionKey,
    flowEditorFrontmatterGraphAvailable,
    renderGraphDataOverride,
    renderGraphMetaKind,
  ])

  const overlayEditorNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('overlay', overlayEditorNodeIds),
    [overlayEditorNodeIds],
  )
  const seededFrontmatterAutoWidgetsKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    if (deferComposedGraphOverlayRender) return
    const graphData = renderGraphDataOverrideRef.current
    if (!graphData) return
    if (renderGraphPlacementContext?.isFrontmatterFlow !== true) return
    if (overlayEditorNodeIds.length === 0) return

    const st = useGraphStore.getState()
    if (isWorkspaceGraphMutationBlocked(st)) return
    const pinnedById = resolveScopedFlowWidgetNodeMap({
      graphMetaKey: renderGraphMetaKey,
      keyedByGraphMetaKey: (st as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalByNodeId: st.flowWidgetPinnedByNodeId,
    })
    const defaultPinned = renderGraphPlacementContext?.defaultPinnedInCanvas ?? true
    const missingIds = overlayEditorNodeIds.filter(id => id && !Object.prototype.hasOwnProperty.call(pinnedById, id))
    const missingIdsKey = hashScopedStringArraySignature('missing-frontmatter-pins', missingIds)
    const seedKey = hashSignatureParts([
      'frontmatter-overlay-auto-pins',
      overlayTopologyLayoutSignature,
      overlayEditorNodeIdsKey,
      missingIdsKey,
      defaultPinned,
    ])
    if (seededFrontmatterAutoWidgetsKeyRef.current === seedKey) return
    seededFrontmatterAutoWidgetsKeyRef.current = seedKey
    if (missingIds.length === 0) return

    const nextPinned = { ...pinnedById }
    let changed = false
    for (let i = 0; i < missingIds.length; i += 1) {
      const id = missingIds[i]
      if (!id) continue
      nextPinned[id] = defaultPinned
      changed = true
    }
    if (!changed) return
    st.setFlowWidgetPinnedByNodeId(nextPinned)
    if (!defaultPinned) scheduleOverlayCollisionResolve()
  }, [deferComposedGraphOverlayRender, overlayTopologyLayoutSignature, overlayEditorNodeIds, overlayEditorNodeIdsKey, renderGraphMetaKey, renderGraphPlacementContext, scheduleOverlayCollisionResolve])

  const seededGeospatialOverlayWidgetPinsKeyRef = React.useRef<string>('')
  const overlayEditorNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (overlayEditorNodeIdsSnapshotRef.current?.key !== overlayEditorNodeIdsKey) {
    overlayEditorNodeIdsSnapshotRef.current = {
      key: overlayEditorNodeIdsKey,
      value: normalizeStringArrayForSignature(overlayEditorNodeIds, { unique: true }),
    }
  }
  const overlayEditorNodeIdsSnapshot = overlayEditorNodeIdsSnapshotRef.current.value
  const overlayVisibilityActive = React.useMemo(() => {
    return flowEditorViewActive || (workspaceOverlayOpen && overlayEditorNodeIds.length > 0)
  }, [flowEditorViewActive, overlayEditorNodeIds.length, workspaceOverlayOpen])
  const frontmatterOverlayAuthorityGraphData = React.useMemo(() => {
    if (isFrontmatterFlowGraph(renderGraphDataOverride)) return renderGraphDataOverride
    const lastStableGraph = lastStableRenderGraphDataOverrideRef.current
    if (!isFrontmatterFlowGraph(lastStableGraph)) return renderGraphDataOverride
    if (!workspaceOverlayOpen && !flowEditorViewActive) return renderGraphDataOverride
    if (overlayEditorNodeIdsSnapshot.length === 0) return renderGraphDataOverride
    return lastStableGraph
  }, [flowEditorViewActive, overlayEditorNodeIdsSnapshot, renderGraphDataOverride, workspaceOverlayOpen])
  const frontmatterOverlayCoverageActive = React.useMemo(() => {
    return overlayVisibilityActive && (
      renderGraphPlacementContext?.isFrontmatterFlow === true
      || isFrontmatterFlowGraph(frontmatterOverlayAuthorityGraphData)
    )
  }, [frontmatterOverlayAuthorityGraphData, overlayVisibilityActive, renderGraphPlacementContext])

  React.useEffect(() => {
    if (deferComposedGraphOverlayRender) return
    if (!geospatialWidgetPanelMode) return
    if (overlayEditorNodeIds.length === 0) return
    const st = useGraphStore.getState()
    if (isWorkspaceGraphMutationBlocked(st)) return
    const pinnedById = resolveScopedFlowWidgetNodeMap({
      graphMetaKey: renderGraphMetaKey,
      keyedByGraphMetaKey: (st as unknown as { flowWidgetPinnedByNodeIdByGraphMetaKey?: Record<string, Record<string, boolean>> }).flowWidgetPinnedByNodeIdByGraphMetaKey,
      globalByNodeId: st.flowWidgetPinnedByNodeId,
    })
    const missingIds = overlayEditorNodeIds.filter(id => id && !Object.prototype.hasOwnProperty.call(pinnedById, id))
    const defaultPinned = resolveDefaultFlowWidgetPinnedInCanvas({ geospatialWidgetPanelMode: true })
    const missingIdsKey = hashScopedStringArraySignature('missing-geospatial-pins', missingIds)
    const seedKey = hashSignatureParts([
      'geospatial-overlay-auto-pins',
      overlayEditorNodeIdsKey,
      missingIdsKey,
      defaultPinned,
    ])
    if (seededGeospatialOverlayWidgetPinsKeyRef.current === seedKey) return
    seededGeospatialOverlayWidgetPinsKeyRef.current = seedKey
    if (missingIds.length === 0) return
    const nextPinned = { ...pinnedById }
    for (let i = 0; i < missingIds.length; i += 1) nextPinned[missingIds[i]!] = defaultPinned
    st.setFlowWidgetPinnedByNodeId(nextPinned)
    if (!defaultPinned) scheduleOverlayCollisionResolve()
  }, [deferComposedGraphOverlayRender, geospatialWidgetPanelMode, overlayEditorNodeIds, overlayEditorNodeIdsKey, renderGraphMetaKey, scheduleOverlayCollisionResolve])
  const frontmatterVisibleSceneDisplayRef = React.useRef<{
    key: string
    value: ReturnType<typeof deriveSceneDisplayGraph> | null
  } | null>(null)
  const frontmatterVisibleGraphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('flow-editor-overlay-surface-frontmatter-visible-graph', {
      graphData: frontmatterOverlayAuthorityGraphData,
      graphRevision: renderGraphDataRevision,
      graphSemanticKey: renderGraphSemanticKey,
    }),
    [frontmatterOverlayAuthorityGraphData, renderGraphDataRevision, renderGraphSemanticKey],
  )
  if (
    !frontmatterVisibleSceneDisplayRef.current
    || frontmatterVisibleSceneDisplayRef.current.key !== frontmatterVisibleGraphSemanticKey
  ) {
    frontmatterVisibleSceneDisplayRef.current = {
      key: frontmatterVisibleGraphSemanticKey,
      value: frontmatterOverlayCoverageActive && frontmatterOverlayAuthorityGraphData
        ? deriveSceneDisplayGraph({ graphData: frontmatterOverlayAuthorityGraphData })
        : null,
    }
  }
  const frontmatterVisibleSceneDisplay = frontmatterVisibleSceneDisplayRef.current?.value || null
  const frontmatterVisibleGraphNodes = React.useMemo(() => {
    if (!frontmatterOverlayCoverageActive) return renderGraphNodes
    const displayNodes = Array.isArray(frontmatterVisibleSceneDisplay?.displayGraphData?.nodes)
      ? (frontmatterVisibleSceneDisplay?.displayGraphData?.nodes as GraphNode[])
      : null
    if (displayNodes && displayNodes.length > 0) return displayNodes
    return renderGraphNodes
  }, [frontmatterOverlayCoverageActive, frontmatterVisibleSceneDisplay, renderGraphNodes])
  const connectedValueTargetNodeIds = React.useMemo(() => {
    return buildRichMediaConnectedValueTargetNodeIdSet({
      nodes: frontmatterOverlayCoverageActive ? frontmatterVisibleGraphNodes : [],
      extraNodeIds: overlayEditorNodeIdsSnapshot,
    })
  }, [frontmatterOverlayCoverageActive, frontmatterVisibleGraphNodes, overlayEditorNodeIdsSnapshot])
  const connectedValuesGraphRevision = args.flowEditorViewActive ? args.draftGraphDataRevision : args.baseGraphDataRevision
  const connectedValuesByNodeId = React.useMemo(() => {
    if (connectedValueTargetNodeIds.size === 0) return new Map<string, FlowConnectedValuesBySchemaPath>()
    return computeFlowConnectedValuesBySchemaPath({
      graphData: frontmatterOverlayCoverageActive ? frontmatterOverlayAuthorityGraphData : renderGraphDataOverride,
      registry: Array.isArray(widgetRegistry) ? widgetRegistry : [],
      targetNodeIds: connectedValueTargetNodeIds,
      graphRevision: connectedValuesGraphRevision,
      graphSemanticKey: renderGraphSemanticKey,
    })
  }, [connectedValuesGraphRevision, connectedValueTargetNodeIds, frontmatterOverlayAuthorityGraphData, frontmatterOverlayCoverageActive, renderGraphDataOverride, renderGraphSemanticKey, widgetRegistry])
  const frontmatterRichMediaOverlayNodeIds = React.useMemo(() => {
    if (!frontmatterOverlayCoverageActive) return [] as string[]
    const overlayEditorNodeIdSet = new Set(overlayEditorNodeIdsSnapshot)
    const overlays = listDisplayRichMediaOverlayNodes({
      renderMediaAsNodes: false,
      canvas2dRenderer: 'flowEditor',
      frontmatterModeEnabled: true,
      documentSemanticMode: 'document',
      nodes: frontmatterVisibleGraphNodes,
      poolMax: 24,
      excludeNodeIdSet: overlayEditorNodeIdSet,
      connectedValuesByNodeId,
    })
    return overlays.map(node => String(node.id || '').trim()).filter(Boolean)
  }, [connectedValuesByNodeId, frontmatterOverlayCoverageActive, frontmatterVisibleGraphNodes, overlayEditorNodeIdsSnapshot])
  const frontmatterRichMediaOverlayNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('frontmatter-rich-media-overlay', frontmatterRichMediaOverlayNodeIds),
    [frontmatterRichMediaOverlayNodeIds],
  )
  const frontmatterRichMediaOverlayNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (frontmatterRichMediaOverlayNodeIdsSnapshotRef.current?.key !== frontmatterRichMediaOverlayNodeIdsKey) {
    frontmatterRichMediaOverlayNodeIdsSnapshotRef.current = {
      key: frontmatterRichMediaOverlayNodeIdsKey,
      value: normalizeStringArrayForSignature(frontmatterRichMediaOverlayNodeIds, { unique: true }),
    }
  }
  const frontmatterRichMediaOverlayNodeIdsSnapshot = frontmatterRichMediaOverlayNodeIdsSnapshotRef.current.value

  const handlePinnedInCanvasChange = React.useCallback(() => {
    // Pin state switches placement authority; collision layout stays owned by topology,
    // viewport changes, and explicit floating-position updates.
  }, [])
  const overlayEditorElements = React.useMemo(() => {
    return buildOverlayEditorElements({
      overlayVisibilityActive,
      renderGraphNodeById,
      renderGraphIncidentEdgesByNodeId,
      renderGraphMetaKind,
      renderGraphDataOverride,
      lastStableRenderGraphDataOverride: lastStableRenderGraphDataOverrideRef.current,
      pendingOverlayNodeIdRef,
      pendingOverlayNode,
      overlayEditorNodeIds,
      connectedValuesByNodeId,
      flowEditorSurfaceId,
      renderGraphSemanticKey,
      canEdit,
      widgetRegistry,
      toolMode,
      pendingEdgeSourceId,
      viewportW,
      viewportH,
      canvasWindowOffset,
      zoomViewKey,
      lastDroppedWidgetNodeIdRef,
      lastDroppedWidgetToken,
      getLiveNodeWorldPos,
      getLiveZoomTransform,
      getLiveContainmentGroupAabbForNode,
      beginAddEdgeFromNode,
      finalizePendingEdge,
      setNodeLabelById,
      setNodeTypeById,
      patchNodePropertiesById,
      setNodePropertiesById,
      validateNodeById,
      runWorkflowNode,
      duplicateNodeById,
      removeNodeById,
      clearNodeOutputById,
      showNodeEditorHelp,
      convertNodeToLoopById,
      enableHandlesForAllInputs,
      renameSchemaFieldIdByNodeId,
      upsertUiToast,
      flowWidgetPinnedByNodeId,
      handlePinnedInCanvasChange,
    })
  }, [
    beginAddEdgeFromNode,
    canEdit,
    canvasWindowOffset,
    clearNodeOutputById,
    convertNodeToLoopById,
    duplicateNodeById,
    enableHandlesForAllInputs,
    finalizePendingEdge,
    flowEditorSurfaceId,
    flowWidgetPinnedByNodeId,
    getLiveContainmentGroupAabbForNode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    lastDroppedWidgetNodeIdRef,
    lastDroppedWidgetToken,
    patchNodePropertiesById,
    pendingEdgeSourceId,
    pendingOverlayNode,
    pendingOverlayNodeIdRef,
    removeNodeById,
    renameSchemaFieldIdByNodeId,
    runWorkflowNode,
    setNodeLabelById,
    setNodePropertiesById,
    setNodeTypeById,
    showNodeEditorHelp,
    toolMode,
    upsertUiToast,
    validateNodeById,
    viewportH,
    viewportW,
    widgetRegistry,
    zoomViewKey,
    connectedValuesByNodeId,
    handlePinnedInCanvasChange,
    overlayEditorNodeIds,
    renderGraphIncidentEdgesByNodeId,
    renderGraphMetaKind,
    renderGraphNodeById,
    renderGraphDataOverride,
    overlayVisibilityActive,
  ])

  const hasOverlayEditors =
    overlayEditorElements.length > 0
    || (workspaceOverlayOpen && overlayEditorNodeIds.length > 0)
  const frontmatterOverlayOnlyCoverageRef = React.useRef<FrontmatterOverlayOnlyCoverageCache | null>(null)
  const frontmatterOverlayVisualIsolation = React.useMemo(() => resolveFrontmatterOverlayVisualIsolationWithStableCoverage({
    frontmatterOverlayOnlyCoverageRef,
    renderGraphDataOverride: frontmatterOverlayAuthorityGraphData,
    frontmatterVisibleSceneDisplay,
    frontmatterRichMediaOverlayNodeIdsSnapshot,
    overlayEditorNodeIdsSnapshot,
    renderGraphEligibleNodeIds,
    renderGraphSemanticKey,
    workspaceMutationBlocked,
  }), [
    frontmatterOverlayAuthorityGraphData, frontmatterVisibleSceneDisplay, frontmatterRichMediaOverlayNodeIdsSnapshot,
    overlayEditorNodeIdsSnapshot, renderGraphEligibleNodeIds, renderGraphSemanticKey, workspaceMutationBlocked,
  ])

  const overlayOnlyActive = resolveOverlayOnlyActive({
    overlayVisibilityActive,
    hasOverlayEditors,
    geospatialWidgetPanelMode,
    frontmatterOverlayVisualIsolation,
    workspaceMutationBlocked,
  })

  const flowCanvasGraphDataOverride = React.useMemo(() => {
    return buildFlowCanvasGraphDataOverride({
      renderGraphDataOverride: frontmatterOverlayAuthorityGraphData,
      frontmatterOverlayVisualIsolation,
      overlayEditorNodeIdsSnapshot,
      overlayOnlyActive,
    })
  }, [
    frontmatterOverlayVisualIsolation.kind,
    frontmatterOverlayVisualIsolation.visibleNodeIds,
    overlayEditorNodeIdsSnapshot,
    overlayOnlyActive,
    frontmatterOverlayAuthorityGraphData,
  ])

  return {
    hasOverlayEditors,
    noGraphLoaded: !renderGraphDataOverride,
    overlayEditorElements,
    overlayEditorNodeIds,
    overlayOnlyActive,
    flowCanvasGraphDataOverride,
  }
}
