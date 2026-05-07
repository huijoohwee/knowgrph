import React from 'react'

import {
  deriveOpenWidgetOverlayNodeIds,
  filterGraphByExcludedNodeIds,
  FlowEditorWidgetOverlay,
  isCanonicalFrontmatterBuiltInWidgetNode,
  resolveDefaultFlowWidgetPinnedInCanvas,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { computeFlowConnectedValuesBySchemaPath, type FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { resolveNodeWidgetIdentity } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { emitMainPanelOpen } from '@/features/panels/utils/useMainPanelRect'
import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import {
  hashScopedStringArraySignature,
  hashSignatureParts,
  normalizeStringArrayForSignature,
} from '@/lib/hash/signature'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import { isFlowEditorQeTraceEnabled, pushFlowEditorQeTrace } from '@/lib/flowEditor/flowEditorQeTrace'
import {
  buildRichMediaConnectedValueTargetNodeIdSet,
  listDisplayRichMediaOverlayNodes,
} from '@/lib/render/richMediaSsot'
import {
  getCachedFlowEditorRenderGraph,
  getCachedFlowEditorWidgetPlacementContext,
} from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'

const EMPTY_GRAPH_NODES: GraphNode[] = []
const EMPTY_GRAPH_EDGES: GraphEdge[] = []
const EMPTY_GRAPH_NODE_BY_ID = new Map<string, GraphNode>()
const EMPTY_GRAPH_ELIGIBLE_NODE_IDS = new Set<string>()

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
  const overlayEditorNodeIdsRef = React.useRef<string[]>([])
  const lastStableOverlayEditorNodeIdsRef = React.useRef<string[]>([])
  const frontmatterOverlayOnlyCoverageRef = React.useRef<{ key: string; untilMs: number } | null>(null)

  React.useEffect(() => {
    if (!flowEditorViewActive) {
      lastStableOverlayEditorNodeIdsRef.current = []
      frontmatterOverlayOnlyCoverageRef.current = null
    }
  }, [flowEditorViewActive])

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

  const overlayEditorNodeIds = React.useMemo(() => {
    if (!flowEditorViewActive) return []
    const isFrontmatterFlow = renderGraphPlacementContext?.isFrontmatterFlow === true
    const nodes = renderGraphNodes
    const nodeById = renderGraphNodeById
    if (isFrontmatterFlow && nodes.length > 0) {
      const sorted = renderGraphPlacementContext?.frontmatterOverlayNodeIds || []
      if (sorted.length > 0) {
        lastStableOverlayEditorNodeIdsRef.current = sorted
        return sorted
      }
      return nodes.length > 0 ? lastStableOverlayEditorNodeIdsRef.current : []
    }
    if (flowEditorFrontmatterGraphAvailable) return []
    const next = deriveOpenWidgetOverlayNodeIds({
      graphData: renderGraphDataOverride,
      openWidgetNodeIds: openWidgetNodeIdsSnapshot,
      eligibleNodeIds: renderGraphEligibleNodeIds,
      nodeById,
      selectedNodeId: overlayDraftNode?.id || null,
    })
    if (next.length > 0) lastStableOverlayEditorNodeIdsRef.current = next
    return next
  }, [
    flowEditorFrontmatterGraphAvailable,
    flowEditorViewActive,
    overlayDraftNode?.id,
    renderGraphDataOverride,
    renderGraphPlacementContext,
    openWidgetNodeIdsSnapshot,
    renderGraphEligibleNodeIds,
    renderGraphNodeById,
    renderGraphNodes,
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
    })
  }, [
    canEdit,
    flowEditorFrontmatterGraphAvailable,
    flowEditorViewActive,
    overlayEditorNodeIds,
    openWidgetNodeIdsKey,
    openWidgetNodeIdsSnapshot.length,
    renderGraphDataRevision,
    renderGraphEdges.length,
    renderGraphNodes.length,
  ])

  const renderGraphDataOverrideRef = React.useRef<GraphData | null>(renderGraphDataOverride)
  React.useEffect(() => {
    renderGraphDataOverrideRef.current = renderGraphDataOverride
  }, [renderGraphDataOverride])

  const overlayEditorNodeIdsKey = React.useMemo(
    () => hashScopedStringArraySignature('overlay', overlayEditorNodeIds),
    [overlayEditorNodeIds],
  )
  const seededFrontmatterAutoWidgetsKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    const graphData = renderGraphDataOverrideRef.current
    if (!graphData) return
    if (renderGraphPlacementContext?.isFrontmatterFlow !== true) return
    if (overlayEditorNodeIds.length === 0) return

    const st = useGraphStore.getState()
    if (isWorkspaceGraphMutationBlocked(st)) return
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
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
  }, [overlayTopologyLayoutSignature, overlayEditorNodeIds, overlayEditorNodeIdsKey, renderGraphPlacementContext, scheduleOverlayCollisionResolve])

  const seededGeospatialOverlayWidgetPinsKeyRef = React.useRef<string>('')
  const overlayEditorNodeIdsSnapshotRef = React.useRef<{ key: string; value: string[] } | null>(null)
  if (overlayEditorNodeIdsSnapshotRef.current?.key !== overlayEditorNodeIdsKey) {
    overlayEditorNodeIdsSnapshotRef.current = {
      key: overlayEditorNodeIdsKey,
      value: normalizeStringArrayForSignature(overlayEditorNodeIds, { unique: true }),
    }
  }
  const overlayEditorNodeIdsSnapshot = overlayEditorNodeIdsSnapshotRef.current.value
  const frontmatterOverlayCoverageActive = React.useMemo(() => {
    return flowEditorViewActive && renderGraphPlacementContext?.isFrontmatterFlow === true
  }, [flowEditorViewActive, renderGraphPlacementContext])

  React.useEffect(() => {
    if (!geospatialWidgetPanelMode) return
    if (overlayEditorNodeIds.length === 0) return
    const st = useGraphStore.getState()
    if (isWorkspaceGraphMutationBlocked(st)) return
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
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
  }, [geospatialWidgetPanelMode, overlayEditorNodeIds, overlayEditorNodeIdsKey, scheduleOverlayCollisionResolve])
  const frontmatterVisibleSceneDisplayRef = React.useRef<{
    key: string
    value: ReturnType<typeof deriveSceneDisplayGraph> | null
  } | null>(null)
  const frontmatterVisibleGraphSemanticKey = React.useMemo(
    () => buildScopedGraphSemanticKey('flow-editor-overlay-surface-frontmatter-visible-graph', {
      graphData: renderGraphDataOverride,
      graphRevision: renderGraphDataRevision,
      graphSemanticKey: renderGraphSemanticKey,
    }),
    [renderGraphDataOverride, renderGraphDataRevision, renderGraphSemanticKey],
  )
  if (
    !frontmatterVisibleSceneDisplayRef.current
    || frontmatterVisibleSceneDisplayRef.current.key !== frontmatterVisibleGraphSemanticKey
  ) {
    frontmatterVisibleSceneDisplayRef.current = {
      key: frontmatterVisibleGraphSemanticKey,
      value: frontmatterOverlayCoverageActive && renderGraphDataOverride
        ? deriveSceneDisplayGraph({ graphData: renderGraphDataOverride })
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
      graphData: renderGraphDataOverride,
      registry: Array.isArray(widgetRegistry) ? widgetRegistry : [],
      targetNodeIds: connectedValueTargetNodeIds,
      graphRevision: connectedValuesGraphRevision,
      graphSemanticKey: renderGraphSemanticKey,
    })
  }, [connectedValuesGraphRevision, connectedValueTargetNodeIds, renderGraphDataOverride, renderGraphSemanticKey, widgetRegistry])
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
    scheduleOverlayCollisionResolve()
  }, [scheduleOverlayCollisionResolve])

  const overlayEditorElements = React.useMemo(() => {
    if (!flowEditorViewActive) return []
    const nodeById = renderGraphNodeById
    const incidentEdgesByNodeId = renderGraphIncidentEdgesByNodeId
    const graphMetaKind = renderGraphMetaKind
    const resolveNode = (id: string) => {
      const found = nodeById.get(id) || null
      if (found) return found
      const pending = pendingOverlayNodeIdRef.current
      if (pending && pending === id) return pendingOverlayNode
      return null
    }
    return overlayEditorNodeIds
      .map((id, stackIndex) => {
        const node = resolveNode(id)
        if (!node) return null
        if (String(node.type || '') === 'Section') return null
        const autoRevealKey = id === String(lastDroppedWidgetNodeIdRef.current || '') ? lastDroppedWidgetToken : 0
        const connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath | undefined = connectedValuesByNodeId.get(id) || undefined
        const portHandleEdges = incidentEdgesByNodeId?.get(id) || EMPTY_GRAPH_EDGES
        return (
          <FlowEditorWidgetOverlay
            key={`qe-${id}`}
            visible={flowEditorViewActive}
            active={canEdit}
            flowEditorSurfaceId={flowEditorSurfaceId}
            node={node}
            graphMetaKind={graphMetaKind}
            portHandleEdges={portHandleEdges}
            registryEntries={widgetRegistry}
            connectedValuesBySchemaPath={connectedValuesBySchemaPath}
            toolMode={toolMode}
            pendingEdgeSourceId={pendingEdgeSourceId}
            onBeginAddEdgeFromNode={beginAddEdgeFromNode}
            onFinalizeAddEdgeToNode={finalizePendingEdge}
            viewportW={viewportW}
            viewportH={viewportH}
            canvasWindowOffset={canvasWindowOffset}
            zoomViewKey={zoomViewKey}
            autoRevealKey={autoRevealKey}
            stackIndex={stackIndex}
            getLiveNodeWorldPos={getLiveNodeWorldPos}
            getLiveZoomTransform={getLiveZoomTransform}
            getLiveContainmentGroupAabbForNode={getLiveContainmentGroupAabbForNode}
            onSetLabel={(label) => setNodeLabelById(id, label)}
            onSetType={(type) => setNodeTypeById(id, type)}
            onPatchProperties={(patch) => patchNodePropertiesById(id, patch)}
            onSetProperties={(props) => setNodePropertiesById(id, props)}
            onValidate={() => validateNodeById(id)}
            onRun={() => {
              void args.runWorkflowNode(id)
            }}
            onDuplicate={() => {
              const pinnedMap = flowWidgetPinnedByNodeId || {}
              const pinned = pinnedMap[id] === true
              if (pinned) {
                upsertUiToast({
                  id: `flow-editor-node-duplicate-disabled-${id}`,
                  kind: 'warning',
                  message: 'Pinned widget blocks duplicate copy.',
                  ttlMs: 2200,
                })
                return
              }
              duplicateNodeById(id)
            }}
            onRemove={() => removeNodeById(id)}
            onClearOutput={() => clearNodeOutputById(id)}
            onHelp={showNodeEditorHelp}
            onConvertToLoopNode={() => convertNodeToLoopById(id)}
            onEnableHandlesForAllInputs={enableHandlesForAllInputs}
            onUpdateKvEntry={() => {
              if (typeof window === 'undefined') return
              const resolvedWidgetRegistryEntry = resolveWidgetRegistryEntry({
                node,
                registry: widgetRegistry,
                graphMetaKind,
              })
              const widgetIdentity = resolveNodeWidgetIdentity({ node, registryEntry: resolvedWidgetRegistryEntry })
              const searchQuery = [
                String(resolvedWidgetRegistryEntry?.id || '').trim(),
                String(node.type || '').trim(),
                widgetIdentity.widgetTypeId,
                widgetIdentity.formId,
              ].filter(Boolean).join(' ')
              emitMainPanelOpen({
                tab: 'workflowManager' as const,
                workflowManagerTab: 'mapping' as const,
                searchQuery,
              })
            }}
            onPinnedInCanvasChange={handlePinnedInCanvasChange}
            onRenameSchemaFieldId={({ prevId, nextId }) => renameSchemaFieldIdByNodeId(id, prevId, nextId)}
          />
        )
      })
      .filter(Boolean)
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
    flowEditorViewActive,
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
  ])

  const hasOverlayEditors = overlayEditorElements.length > 0
  const frontmatterOverlayHideSafety = React.useMemo(() => {
    const kind = String(((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim()
    if (kind !== 'frontmatter-flow') {
      return { kind, visibleNodeIds: [] as string[], hasFullOverlayCoverageForVisibleNodes: true, coverageGuardKey: '' }
    }
    const visibleNodeIds = Array.isArray(frontmatterVisibleSceneDisplay?.displayNodes)
      ? frontmatterVisibleSceneDisplay.displayNodes.map(n => String(n?.id || '').trim()).filter(Boolean)
      : []
    const eligibleIds = renderGraphEligibleNodeIds
    const overlayCoverageIdSet = new Set([
      ...overlayEditorNodeIdsSnapshot,
      ...frontmatterRichMediaOverlayNodeIdsSnapshot,
    ])
    const visibleFlowNodeIds = visibleNodeIds.filter(id => eligibleIds.size === 0 || eligibleIds.has(id))
    const hasFullOverlayCoverageForVisibleNodes = visibleFlowNodeIds.every(id => overlayCoverageIdSet.has(id))
    const visibleFlowNodeIdsKey = hashScopedStringArraySignature('visible-flow-nodes', visibleFlowNodeIds)
    const coverageGuardKey = hashSignatureParts([
      'frontmatter-overlay-only-coverage',
      overlayTopologyLayoutSignature,
      visibleFlowNodeIdsKey,
    ])
    return { kind, visibleNodeIds: visibleFlowNodeIds, hasFullOverlayCoverageForVisibleNodes, coverageGuardKey }
  }, [
    overlayTopologyLayoutSignature,
    renderGraphDataOverride,
    frontmatterVisibleSceneDisplay,
    frontmatterRichMediaOverlayNodeIdsSnapshot,
    overlayEditorNodeIdsSnapshot,
    renderGraphEligibleNodeIds,
  ])

  const overlayOnlyActive =
    (() => {
      const baseActive = flowEditorViewActive && (hasOverlayEditors || Boolean(geospatialWidgetPanelMode))
      if (!baseActive) {
        frontmatterOverlayOnlyCoverageRef.current = null
        return false
      }
      if (Boolean(geospatialWidgetPanelMode)) return true
      if (frontmatterOverlayHideSafety.kind === 'frontmatter-flow') {
        // Keep the base FlowCanvas graph visible in document frontmatter mode; overlays augment it.
        frontmatterOverlayOnlyCoverageRef.current = null
        return false
      }
      return true
    })()

  const flowCanvasGraphDataOverride = React.useMemo(() => {
    if (frontmatterOverlayHideSafety.kind !== 'frontmatter-flow') return renderGraphDataOverride
    const excludedNodeIds =
      renderGraphPlacementContext?.isFrontmatterFlow === true
        ? renderGraphPlacementContext.frontmatterOverlayNodeIds
        : overlayEditorNodeIdsSnapshot
    return filterGraphByExcludedNodeIds({
      graphData: renderGraphDataOverride,
      excludedNodeIds,
    })
  }, [
    frontmatterOverlayHideSafety.kind,
    overlayEditorNodeIdsSnapshot,
    renderGraphDataOverride,
    renderGraphPlacementContext,
  ])

  const overlayOnlyHidePortHandleNodeIds = React.useMemo(() => {
    if (!overlayOnlyActive) return undefined
    return renderGraphNodes.map(n => String((n as { id?: unknown })?.id || '')).filter(Boolean)
  }, [overlayOnlyActive, renderGraphNodes])

  return {
    hasOverlayEditors,
    noGraphLoaded: !renderGraphDataOverride,
    overlayEditorElements,
    overlayEditorNodeIds,
    overlayOnlyActive,
    overlayOnlyHidePortHandleNodeIds,
    flowCanvasGraphDataOverride,
  }
}
