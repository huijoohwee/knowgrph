import React from 'react'
import { createPortal } from 'react-dom'
import {
  deriveFlowEditorViewGraph,
  type ToolMode,
} from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import { useFlowEditorInspectorState } from '@/components/FlowEditorCanvas/runtime/useFlowEditorInspectorState'
import { useFlowEditorRuntimeScene } from '@/components/FlowEditorCanvas/runtime/useFlowEditorRuntimeScene'
import { useFlowEditorRenderState } from '@/components/FlowEditorCanvas/runtime/useFlowEditorRenderState'
import { useFlowEditorOverlaySurface } from '@/components/FlowEditorCanvas/runtime/useFlowEditorOverlaySurface'
import { useFlowEditorSurfaceAnchors } from '@/components/FlowEditorCanvas/runtime/useFlowEditorSurfaceAnchors'
import { useFlowEditorWidgetDropBridge } from '@/components/FlowEditorCanvas/runtime/useFlowEditorWidgetDropBridge'
import { useFlowEditorOverlayCollision } from '@/components/FlowEditorCanvas/runtime/useFlowEditorOverlayCollision'
import { useFlowEditorOverlayEdges } from '@/components/FlowEditorCanvas/runtime/useFlowEditorOverlayEdges'
import { useFlowEditorInspectorSurface } from '@/components/FlowEditorCanvas/runtime/useFlowEditorInspectorSurface'
import { useFlowEditorSelectionBookkeeping } from '@/components/FlowEditorCanvas/runtime/useFlowEditorSelectionBookkeeping'
import { useFlowEditorNodeDraftActions } from '@/components/FlowEditorCanvas/runtime/useFlowEditorNodeDraftActions'
import { useFlowEditorGraphActions } from '@/components/FlowEditorCanvas/runtime/useFlowEditorGraphActions'
import { useFlowEditorWorkflowActions } from '@/components/FlowEditorCanvas/runtime/useFlowEditorWorkflowActions'
import { useFlowEditorRuntimeStoreState } from '@/components/FlowEditorCanvas/runtime/useFlowEditorRuntimeStoreState'
import { resolveFlowEditorAutoRunNodeIds } from '@/components/FlowEditorCanvas/runtime/flowEditorAutoRunTargets'
import FlowEditorCanvasSurface from '@/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface'
import { useContainerDims } from '@/hooks/useContainerDims'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { resolveCanvasViewportMeasureElement } from '@/lib/canvas/viewportMeasureElement'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'
import { hashSignatureParts } from '@/lib/hash/signature'
import { useCanvasAppliedMarkdownDocument } from '@/features/canvas/useCanvasAppliedMarkdownDocument'
import { resolveRichMediaWidgetKind } from '@/features/chat/richMediaRun'
import { isCanonicalNodeIdEqual, resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { appendPendingOverlayNodesToGraphData, resolvePendingOverlayGraphDataBase } from '@/components/FlowEditorCanvas/runtime/flowEditorPendingOverlayGraph'

// #region debug-point A:runtime-storyboard-graph-handoff
const STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event'
const STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SESSION_ID = 'storyboard-media-panel-loop'
const reportStoryboardMediaPanelLoopRuntimeDebug = (args: {
  hypothesisId: 'A' | 'B' | 'C' | 'D' | 'E'
  location: string
  msg: string
  data?: Record<string, unknown>
}) => {
  if (typeof fetch !== 'function') return
  void fetch(STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SERVER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sessionId: STORYBOARD_MEDIA_PANEL_LOOP_DEBUG_SESSION_ID,
      runId: 'pre-fix',
      hypothesisId: args.hypothesisId,
      location: args.location,
      msg: `[DEBUG] ${args.msg}`,
      data: args.data || {},
      ts: Date.now(),
    }),
  }).catch(() => {
    void 0
  })
}
// #endregion

export default function FlowEditorCanvasRuntime(
  {
    active = true,
    flowEditorSurfaceId: flowEditorSurfaceIdProp,
    storyboardCardsMode = false,
    widgetDropCaptureEnabled = false,
    geospatialWidgetPanelMode = false,
  }: {
    active?: boolean
    flowEditorSurfaceId?: string
    storyboardCardsMode?: boolean
    widgetDropCaptureEnabled?: boolean
    geospatialWidgetPanelMode?: boolean
  },
) {
  const flowEditorSurfaceIdRef = React.useRef<string>('')
  if (!flowEditorSurfaceIdRef.current) {
    const providedSurfaceId = String(flowEditorSurfaceIdProp || '').trim()
    flowEditorSurfaceIdRef.current = providedSurfaceId || `kgfe-${Math.random().toString(36).slice(2, 10)}`
  }
  const flowEditorSurfaceId = flowEditorSurfaceIdRef.current
  const editorRuntimeActive = active
  // In geospatial/widget-drop bridge mode, keep only drop capture and forbid
  // Flow Editor runtime layout/edge/collision effects from mutating canvas state.
  const widgetDropBridgeOnly = widgetDropCaptureEnabled && !active
  const rootRef = React.useRef<HTMLElement | null>(null)
  const { width, height, left: containerLeft, top: containerTop } = useContainerDims(rootRef, {
    resolveMeasureElement: resolveCanvasViewportMeasureElement,
  })
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  const {
    addEdge, addNode, addNodesToUserSubgraph, baseGraphData, baseGraphDataRevision,
    baseWidgetRegistry, canvasRenderMode, canvas2dRenderer, canvasRunMode, collapsedGroupIds, createUserSubgraph,
    documentSemanticMode, documentStructureBaselineLock, documentWidgetRegistry, effectiveWidgetRegistry,
    flowEditorLayoutRebalanceRequest, flowWidgetPinnedByNodeId, frontmatterModeEnabled, graphContentRevision, markdownDocumentName,
    markdownDocumentApplyRevision, markdownDocumentApplyViewPreset, markdownDocumentSourceUrl, markdownDocumentText, mediaPanelDensity, openWidgetNodeIds, removeNodesFromUserSubgraph,
    removeUserSubgraph, renderMediaAsNodes, resolvedThemeMode, schema, selectEdge, selectGroup,
    selectNode, selectedEdgeId, selectedNodeId, selectedNodeIds, setGraphDataPreservingLayout,
    setOpenWidgetNodeIds, setSchema, setSelectionSource, toggleGroupCollapsed, updateEdge, updateNode,
    updateOpenWidgetNodeIds, updateUserSubgraph, upsertUiToast, workspaceMutationBlocked,
  } = useFlowEditorRuntimeStoreState()
  const runWorkflowNodeRef = React.useRef<((nodeId: string) => Promise<void> | void) | null>(null)
  const setSelectionSourceForActions = React.useCallback(
    (source: 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown' | 'system') => {
      setSelectionSource(source === 'canvas' || source === 'toolbar' ? source : 'editor')
    },
    [setSelectionSource],
  )

  const baseGraphKind = React.useMemo(() => {
    if (baseGraphData && isFrontmatterFlowGraph(baseGraphData as unknown as GraphData)) return 'frontmatter-flow'
    const meta = (baseGraphData?.metadata || {}) as Record<string, unknown>
    const byKind = String(meta.kind || '').trim()
    if (byKind) return byKind
    return String(baseGraphData?.context || '').trim()
  }, [baseGraphData])
  const flowEditorFrontmatterGraphAvailable = React.useMemo(
    () => (baseGraphData ? isFrontmatterFlowGraph(baseGraphData as unknown as GraphData) : false),
    [baseGraphData],
  )
  const frontmatterOnlyPolicyActive = React.useMemo(
    () => isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer }),
    [canvas2dRenderer, canvasRenderMode],
  )
  const canvasMarkdownDocument = useCanvasAppliedMarkdownDocument({
    name: markdownDocumentName,
    sourceUrl: markdownDocumentSourceUrl,
    text: markdownDocumentText,
    applyViewPreset: markdownDocumentApplyViewPreset !== false,
  })
  const activeDocumentKey = React.useMemo(() => {
    return [String(canvasMarkdownDocument.semanticKey || '').trim(), String(markdownDocumentApplyRevision || 0)].join('::')
  }, [canvasMarkdownDocument.semanticKey, markdownDocumentApplyRevision])
  const flowEditorViewActive = editorRuntimeActive
  const canInteract = editorRuntimeActive
  const canEdit = editorRuntimeActive && !documentStructureBaselineLock
  const { canvasWindowOffset, canvasWindowOffsetRef, inspectorPortalHost, setCanvasWindowOffsetFromRect } = useFlowEditorSurfaceAnchors({
    active,
    editorRuntimeActive,
    rootRef,
  })
  const collapsedGroupIdsKey = React.useMemo(() => buildCollapsedGroupIdsKey(collapsedGroupIds), [collapsedGroupIds])
  const collapsedGroupIdsForView = React.useMemo(() => (collapsedGroupIdsKey ? collapsedGroupIdsKey.split('|').filter(Boolean) : []), [collapsedGroupIdsKey])
  const zoomGraphData = React.useMemo(
    (): GraphData | null => deriveFlowEditorViewGraph({
      graphData: (baseGraphData || null) as GraphData | null,
      collapsedGroupIds: collapsedGroupIdsForView,
      forceFrontmatterFlow: frontmatterOnlyPolicyActive,
    }),
    [baseGraphData, collapsedGroupIdsForView, frontmatterOnlyPolicyActive],
  )
  const flowEditorBaseGraphData = React.useMemo(
    (): GraphData | null => deriveFlowEditorViewGraph({
      graphData: (baseGraphData || null) as GraphData | null,
      collapsedGroupIds: [],
      forceFrontmatterFlow: frontmatterOnlyPolicyActive,
    }),
    [baseGraphData, frontmatterOnlyPolicyActive],
  )

  const zoomViewKey = React.useMemo(() => {
    return buildActive2dZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schema,
      graphData: zoomGraphData,
      documentSemanticMode,
      frontmatterModeEnabled,
      documentStructureBaselineLock,
      renderMediaAsNodes,
      mediaPanelDensity,
      collapsedGroupIds,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    schema,
    zoomGraphData,
  ])

  const zoomViewKeyRef = React.useRef<string | null>(zoomViewKey)
  React.useEffect(() => {
    zoomViewKeyRef.current = zoomViewKey
  }, [zoomViewKey])

  const widgetRegistry = React.useMemo(
    () => buildDataflowWidgetRegistry({ documentWidgetRegistry, effectiveWidgetRegistry, widgetRegistry: baseWidgetRegistry }),
    [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry],
  )
  const widgetRegistryRef = React.useRef(widgetRegistry)
  const lastWidgetDropRef = React.useRef<{ key: string; ts: number } | null>(null)
  const lastDroppedWidgetNodeIdRef = React.useRef<string | null>(null)
  const [lastDroppedWidgetToken, setLastDroppedWidgetToken] = React.useState<number>(0)

  const openWidgetNodeIdsRef = React.useRef(openWidgetNodeIds)
  const overlayEditorNodeIdsRef = React.useRef<string[]>([])

  React.useEffect(() => {
    openWidgetNodeIdsRef.current = openWidgetNodeIds
  }, [openWidgetNodeIds])

  const [toolMode, setToolMode] = React.useState<ToolMode>('select')
  const [pendingEdgeSourceId, setPendingEdgeSourceId] = React.useState<string | null>(null)
  const [pendingEdgeSourcePortKey, setPendingEdgeSourcePortKey] = React.useState<string | null>(null)
  const pendingSelectNodeIdRef = React.useRef<string | null>(null)
  const pendingOpenWidgetNodeIdRef = React.useRef<string | null>(null)
  const [overlayNodeIdOverride, setOverlayNodeIdOverride] = React.useState<string | null>(null)
  const [pendingOverlayNode, setPendingOverlayNode] = React.useState<GraphNode | null>(null)
  const [pendingOverlayNodesById, setPendingOverlayNodesById] = React.useState<Record<string, GraphNode>>({})
  const pendingOverlayNodeIdRef = React.useRef<string | null>(null)
  const registerPendingOverlayNode = React.useCallback<React.Dispatch<React.SetStateAction<GraphNode | null>>>((nextPendingNode) => {
    setPendingOverlayNode(nextPendingNode)
  }, [])
  React.useEffect(() => {
    const id = String(pendingOverlayNode?.id || '').trim()
    if (!id || !pendingOverlayNode) return
    setPendingOverlayNodesById(prevNodes => {
      if (prevNodes[id] === pendingOverlayNode) return prevNodes
      return { ...prevNodes, [id]: pendingOverlayNode }
    })
  }, [pendingOverlayNode])
  const overlayNodeIdOverrideWasSelectedRef = React.useRef(false)
  const overlayNodeIdOverrideUntilMsRef = React.useRef<number>(0)
  const reservedNodeIdsRef = React.useRef<Set<string>>(new Set())
  const forceSelectRef = React.useRef<{ id: string; remaining: number; untilMs: number } | null>(null)
  const forceSelectTimerRef = React.useRef<number | null>(null)
  const {
    draftGraphData,
    draftGraphDataRef,
    draftGraphDataRevision,
    frontmatterFlowRenderSettings,
    renderGraphDataOverride,
    selectedDraftEdge,
    setDraftGraphData,
  } = useFlowEditorRenderState({
    active,
    editorRuntimeActive,
    flowEditorViewActive,
    workspaceMutationBlocked,
    baseGraphData: (baseGraphData || null) as GraphData | null,
    baseGraphDataRevision,
    flowEditorBaseGraphData,
    collapsedGroupIdsForView,
    frontmatterOnlyPolicyActive,
    activeDocumentKey,
    selectedEdgeId, preferDraftGraphData: storyboardCardsMode,
  })
  const overlayTopologyLayoutSignature = React.useMemo(() => {
    return buildOverlayTopologyLayoutSignature(renderGraphDataOverride || flowEditorBaseGraphData || baseGraphData || null)
  }, [baseGraphData, flowEditorBaseGraphData, renderGraphDataOverride])

  const {
    emitFlowEditorInteractionFrame,
    flowRuntimeRefRef,
    getLiveContainmentGroupAabbForNode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
  } = useFlowEditorRuntimeScene({
    active,
    flowEditorSurfaceId,
    openWidgetNodeIds,
    renderGraphDataOverride,
    viewportW,
    viewportH,
    schema,
    overlayTopologyLayoutSignature,
    flowEditorLayoutRebalanceRequest,
    zoomViewKeyRef,
  })

  const overlayOnlyModeEnabled = React.useMemo(() => {
    return flowEditorViewActive
  }, [flowEditorViewActive])

  const overlayEdgesEnabledRef = React.useRef(false)

  const { scheduleOverlayCollisionResolve } = useFlowEditorOverlayCollision({
    editorRuntimeActive,
    overlayOnlyModeEnabled,
    renderGraphDataOverride,
    schema,
    selectedNodeId,
    viewportW,
    viewportH,
    canvasWindowOffset,
    canvasWindowOffsetRef,
    zoomViewKeyRef,
    draftGraphDataRef,
    frontmatterFlowRenderSettings,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    flowEditorSurfaceId,
    graphContentRevision,
  })

  const { overlayEdgesSvgRef, scheduleOverlayEdgeUpdate } = useFlowEditorOverlayEdges({
    active,
    overlayOnlyModeEnabled,
    resolvedThemeMode,
    overlayEdgesEnabledRef,
    flowEditorSurfaceId,
    rootRef,
    draftGraphDataRef,
    renderGraphDataOverride,
    overlayEditorNodeIdsRef,
    openWidgetNodeIdsRef,
    pendingOverlayNodeIdRef,
    widgetRegistryRef,
    schema,
    toolMode,
    pendingEdgeSourceId,
    pendingEdgeSourcePortKey,
    frontmatterFlowRenderSettings,
  })

  const {
    overlayDraftNode,
    scheduleForceSelect,
    selectedDraftNode,
    shouldDedupeWidgetDrop,
  } = useFlowEditorSelectionBookkeeping({
    active,
    editorRuntimeActive,
    flowEditorViewActive,
    canvas2dRenderer,
    overlayOnlyModeEnabled,
    flowEditorFrontmatterGraphAvailable,
    widgetRegistry,
    draftGraphData,
    renderGraphDataOverride,
    selectedNodeId,
    overlayNodeIdOverride,
    pendingOverlayNode,
    openWidgetNodeIdsRef,
    draftGraphDataRef,
    widgetRegistryRef,
    lastWidgetDropRef,
    forceSelectRef,
    forceSelectTimerRef,
    pendingSelectNodeIdRef,
    reservedNodeIdsRef,
    pendingOpenWidgetNodeIdRef,
    pendingOverlayNodeIdRef,
    overlayNodeIdOverrideWasSelectedRef,
    overlayNodeIdOverrideUntilMsRef,
    setOpenWidgetNodeIds,
    updateOpenWidgetNodeIds,
    setOverlayNodeIdOverride,
  })

  const { appendDraftNode, beginAddEdgeFromNode, cancelPendingEdge, finalizePendingEdge } = useFlowEditorGraphActions({
    active,
    draftGraphData,
    draftGraphDataRef, setDraftGraphData,
    baseGraphData: (baseGraphData || null) as GraphData | null,
    schema,
    selectedNodeId,
    toolMode,
    pendingEdgeSourceId,
    pendingEdgeSourcePortKey, extraGraphNodesById: pendingOverlayNodesById,
    pendingSelectNodeIdRef,
    setSelectionSource: setSelectionSourceForActions,
    selectNode,
    selectEdge,
    addEdge,
    addNode,
    setToolMode,
    setPendingEdgeSourceId,
    setPendingEdgeSourcePortKey,
    upsertUiToast,
  })

  const { addNodeFromRegistryAtWorld, addRichMediaPanelFromMediaAtWorld } = useFlowEditorWidgetDropBridge({
    active,
    widgetDropCaptureEnabled,
    widgetDropBridgeOnly,
    geospatialWidgetPanelMode,
    rootRef,
    widgetRegistryRef,
    baseGraphData,
    draftGraphDataRef,
    reservedNodeIdsRef,
    pendingOverlayNodeIdRef,
    pendingOpenWidgetNodeIdRef,
    overlayNodeIdOverrideWasSelectedRef,
    overlayNodeIdOverrideUntilMsRef,
    lastDroppedWidgetNodeIdRef,
    zoomViewKeyRef,
    getLiveZoomTransform,
    appendDraftNode,
    updateNode,
    shouldDedupeWidgetDrop,
    scheduleForceSelect,
    setCanvasWindowOffsetFromRect,
    setOverlayNodeIdOverride,
    setPendingOverlayNode: registerPendingOverlayNode,
    setLastDroppedWidgetToken,
    upsertUiToast,
  })

  const {
    edgeMetaJson,
    edgePropsJson,
    inspectorTab,
    jsonError,
    nodeMetaJson,
    nodePropsJson,
    setEdgeMetaJson,
    setEdgePropsJson,
    setInspectorTab,
    setJsonError,
    setNodeMetaJson,
    setNodePropsJson,
    setWorkflowContextJson,
    setWorkflowMetaJson,
    workflowContextJson,
    workflowMetaJson,
  } = useFlowEditorInspectorState({
    active,
    draftGraphData,
    selectedDraftNode,
    selectedDraftEdge,
  })
  const handleNodePropertiesCommittedForAutoRun = React.useCallback((nodeId: string, changedPropertyKeys?: ReadonlyArray<string>) => {
    if (canvasRunMode !== 'auto') return
    const id = String(nodeId || '').trim()
    if (!id) return
    const run = () => {
      if (runWorkflowNodeRef.current == null) return
      const graphData = (draftGraphDataRef.current || draftGraphData || baseGraphData || null) as GraphData | null
      const targetNodeIds = resolveFlowEditorAutoRunNodeIds({
        graphData,
        nodeId: id,
        changedPropertyKeys,
        resolveRichMediaKind: resolveRichMediaWidgetKind,
      })
      for (const targetNodeId of targetNodeIds) {
        void runWorkflowNodeRef.current(targetNodeId)
      }
    }
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(run)
      return
    }
    void Promise.resolve().then(run)
  }, [baseGraphData, canvasRunMode, draftGraphData, draftGraphDataRef])

  const {
    applyJsonToDraft,
    clearNodeOutputById,
    convertNodeToLoopById,
    duplicateNodeById,
    enableHandlesForAllInputs,
    patchNodePropertiesById,
    patchSelectedNodeProperties,
    removeNodeById,
    renameSchemaFieldIdByNodeId,
    setNodeLabelById,
    setNodePropertiesById,
    setNodeTypeById,
    setSelectedEdgeLabel,
    setSelectedNodeLabel,
    setSelectedNodeType,
    showNodeEditorHelp,
    validateNodeById,
  } = useFlowEditorNodeDraftActions({
    active,
    draftGraphData,
    draftGraphDataRef,
    baseGraphData,
    selectedNodeId,
    selectedEdgeId,
    documentStructureBaselineLock,
    schema,
    setSchema,
    addNode,
    updateNode,
    updateEdge,
    selectNode,
    selectEdge,
    setSelectionSource: setSelectionSourceForActions,
    setGraphDataPreservingLayout,
    updateOpenWidgetNodeIds,
    onNodePropertiesCommittedForAutoRun: handleNodePropertiesCommittedForAutoRun,
    upsertUiToast,
    nodePropsJson,
    nodeMetaJson,
    edgePropsJson,
    edgeMetaJson,
    workflowMetaJson,
    workflowContextJson,
    setJsonError,
  })

  const { exportWorkflowBundle, runWorkflowNode } = useFlowEditorWorkflowActions({
    flowEditorViewActive,
    baseGraphKind,
    baseGraphData: (baseGraphData || null) as GraphData | null,
    draftGraphData,
    draftGraphDataRef,
    renderGraphDataOverride,
    markdownDocumentName,
    markdownDocumentSourceUrl,
    widgetRegistry,
    appendDraftNode,
    setDraftGraphData,
    updateNode,
    upsertUiToast,
    scheduleOverlayEdgeUpdate,
  })
  runWorkflowNodeRef.current = runWorkflowNode

  const { inspectorElement } = useFlowEditorInspectorSurface({
    active,
    baseGraphData,
    draftGraphData,
    selectedDraftNode,
    selectedDraftEdge,
    selectedNodeId,
    selectedNodeIds,
    collapsedGroupIds,
    inspectorTab,
    setInspectorTab,
    createUserSubgraph,
    updateUserSubgraph,
    removeUserSubgraph,
    addNodesToUserSubgraph,
    removeNodesFromUserSubgraph,
    toggleGroupCollapsed,
    setSelectionSource: setSelectionSourceForActions,
    selectNode,
    selectEdge,
    selectGroup,
    runWorkflowNode,
    exportWorkflowBundle,
    jsonError,
    nodePropsJson,
    setNodePropsJson,
    nodeMetaJson,
    setNodeMetaJson,
    edgePropsJson,
    setEdgePropsJson,
    edgeMetaJson,
    setEdgeMetaJson,
    workflowMetaJson,
    setWorkflowMetaJson,
    workflowContextJson,
    setWorkflowContextJson,
    setSelectedNodeLabel,
    patchSelectedNodeProperties,
    setSelectedNodeType,
    setSelectedEdgeLabel,
    applyJsonToDraft,
    upsertUiToast,
  })

  const {
    hasOverlayEditors,
    noGraphLoaded,
    overlayEditorElements,
    overlayEditorNodeIds,
    overlayOnlyActive,
    flowCanvasGraphDataOverride,
  } = useFlowEditorOverlaySurface({
    flowEditorSurfaceId,
    canEdit,
    flowEditorViewActive,
    flowEditorFrontmatterGraphAvailable,
    geospatialWidgetPanelMode,
    renderGraphDataOverride,
    draftGraphDataRef,
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
  })
  const overlayEditorNodeIdsKey = React.useMemo(() => {
    return hashSignatureParts(['overlay-editor-node-ids', ...overlayEditorNodeIds])
  }, [overlayEditorNodeIds])
  React.useEffect(() => {
    overlayEditorNodeIdsRef.current = overlayEditorNodeIds
  }, [overlayEditorNodeIds])
  const overlayEdgeHostActive = overlayOnlyActive || hasOverlayEditors || storyboardCardsMode
  React.useEffect(() => {
    overlayEdgesEnabledRef.current = overlayEdgeHostActive
    if (!overlayEdgeHostActive) return
    scheduleOverlayEdgeUpdate()
  }, [overlayEdgeHostActive, overlayEditorNodeIdsKey, overlayTopologyLayoutSignature, scheduleOverlayEdgeUpdate])
  const flowCanvasGraphDataWithPendingOverlays = React.useMemo(
    () => appendPendingOverlayNodesToGraphData(resolvePendingOverlayGraphDataBase({ baseGraphData, draftGraphData, flowCanvasGraphDataOverride, renderGraphDataOverride, storyboardCardsMode }), pendingOverlayNodesById),
    [baseGraphData, draftGraphData, flowCanvasGraphDataOverride, pendingOverlayNodesById, renderGraphDataOverride, storyboardCardsMode],
  )
  React.useEffect(() => {
    const pendingOverlayStillSelectedOrOpen = (id: string): boolean => {
      const selected = String(selectedNodeId || '').trim()
      if (selected && isCanonicalNodeIdEqual(selected, id)) return true
      const pendingSelectedId = String(pendingSelectNodeIdRef.current || '').trim()
      if (pendingSelectedId && isCanonicalNodeIdEqual(pendingSelectedId, id)) return true
      const pendingOpenId = String(pendingOpenWidgetNodeIdRef.current || '').trim()
      if (pendingOpenId && isCanonicalNodeIdEqual(pendingOpenId, id)) return true
      for (let i = 0; i < openWidgetNodeIds.length; i += 1) {
        if (isCanonicalNodeIdEqual(openWidgetNodeIds[i], id)) return true
      }
      return false
    }
    setPendingOverlayNodesById(prev => {
      let next: Record<string, GraphNode> | null = null
      for (const id of Object.keys(prev)) {
        if (!resolveGraphNodeByCanonicalId(baseGraphData, id) && pendingOverlayStillSelectedOrOpen(id)) continue
        if (!next) next = { ...prev }
        delete next[id]
      }
      return next || prev
    })
    const pendingId = String(pendingOverlayNodeIdRef.current || '').trim()
    if (!pendingId) return
    if (!resolveGraphNodeByCanonicalId(baseGraphData, pendingId) && (pendingOverlayNode || pendingOverlayStillSelectedOrOpen(pendingId))) return
    pendingOverlayNodeIdRef.current = null
    setPendingOverlayNode(null)
  }, [baseGraphData, openWidgetNodeIds, pendingOverlayNode, selectedNodeId, storyboardCardsMode])
  const storyboardCanvasGraphDataOverride = React.useMemo((): GraphData | null => {
    if (!storyboardCardsMode) return flowCanvasGraphDataWithPendingOverlays
    return flowCanvasGraphDataWithPendingOverlays
      || flowCanvasGraphDataOverride
      || renderGraphDataOverride
      || draftGraphData
      || baseGraphData
      || { context: '', type: 'Graph', nodes: [], edges: [] }
  }, [
    baseGraphData,
    draftGraphData,
    flowCanvasGraphDataOverride,
    flowCanvasGraphDataWithPendingOverlays,
    renderGraphDataOverride,
    storyboardCardsMode,
  ])
  const storyboardRuntimeGraphSignature = React.useMemo(() => {
    return [
      String(storyboardCardsMode),
      String(Array.isArray(baseGraphData?.nodes) ? baseGraphData.nodes.length : 0),
      String(Array.isArray(draftGraphData?.nodes) ? draftGraphData.nodes.length : 0),
      String(Array.isArray(renderGraphDataOverride?.nodes) ? renderGraphDataOverride.nodes.length : 0),
      String(Array.isArray(flowCanvasGraphDataOverride?.nodes) ? flowCanvasGraphDataOverride.nodes.length : 0),
      String(Object.keys(pendingOverlayNodesById).length),
      String(Array.isArray(flowCanvasGraphDataWithPendingOverlays?.nodes) ? flowCanvasGraphDataWithPendingOverlays.nodes.length : 0),
      String(Array.isArray(storyboardCanvasGraphDataOverride?.nodes) ? storyboardCanvasGraphDataOverride.nodes.length : 0),
    ].join('::')
  }, [
    baseGraphData,
    draftGraphData,
    flowCanvasGraphDataOverride,
    flowCanvasGraphDataWithPendingOverlays,
    pendingOverlayNodesById,
    renderGraphDataOverride,
    storyboardCanvasGraphDataOverride,
    storyboardCardsMode,
  ])
  const reportedStoryboardRuntimeGraphSignatureRef = React.useRef('')
  React.useEffect(() => {
    if (!storyboardCardsMode) return
    if (!storyboardRuntimeGraphSignature || reportedStoryboardRuntimeGraphSignatureRef.current === storyboardRuntimeGraphSignature) return
    reportedStoryboardRuntimeGraphSignatureRef.current = storyboardRuntimeGraphSignature
    // #region debug-point B:runtime-storyboard-graph-handoff
    reportStoryboardMediaPanelLoopRuntimeDebug({
      hypothesisId: 'D',
      location: 'FlowEditorCanvas.runtime.tsx:storyboard-source-graph',
      msg: 'runtime prepared storyboard source graph override',
      data: {
        baseGraphNodeCount: Array.isArray(baseGraphData?.nodes) ? baseGraphData.nodes.length : 0,
        draftGraphNodeCount: Array.isArray(draftGraphData?.nodes) ? draftGraphData.nodes.length : 0,
        renderGraphNodeCount: Array.isArray(renderGraphDataOverride?.nodes) ? renderGraphDataOverride.nodes.length : 0,
        flowCanvasGraphNodeCount: Array.isArray(flowCanvasGraphDataOverride?.nodes) ? flowCanvasGraphDataOverride.nodes.length : 0,
        pendingOverlayNodeIds: Object.keys(pendingOverlayNodesById),
        flowCanvasGraphWithPendingNodeCount: Array.isArray(flowCanvasGraphDataWithPendingOverlays?.nodes)
          ? flowCanvasGraphDataWithPendingOverlays.nodes.length
          : 0,
        storyboardSourceGraphNodeCount: Array.isArray(storyboardCanvasGraphDataOverride?.nodes)
          ? storyboardCanvasGraphDataOverride.nodes.length
          : 0,
      },
    })
    // #endregion
  }, [
    baseGraphData,
    draftGraphData,
    flowCanvasGraphDataOverride,
    flowCanvasGraphDataWithPendingOverlays,
    pendingOverlayNodesById,
    renderGraphDataOverride,
    storyboardCanvasGraphDataOverride,
    storyboardCardsMode,
    storyboardRuntimeGraphSignature,
  ])
  const surfaceNoGraphLoaded = storyboardCardsMode ? false : noGraphLoaded

  if (widgetDropBridgeOnly) {
    return <section ref={rootRef} className="absolute inset-0 pointer-events-none opacity-0" aria-hidden="true" />
  }

  return (
    <FlowEditorCanvasSurface
      rootRef={rootRef}
      flowEditorSurfaceId={flowEditorSurfaceId}
      active={active}
      canInteract={canInteract}
      canEdit={canEdit}
      geospatialWidgetPanelMode={geospatialWidgetPanelMode}
      storyboardCardsMode={storyboardCardsMode}
      storyboardSourceGraphData={storyboardCanvasGraphDataOverride}
      renderGraphDataOverride={flowCanvasGraphDataOverride}
      flowEditorViewActive={flowEditorViewActive}
      draftGraphDataRevision={draftGraphDataRevision}
      baseGraphDataRevision={baseGraphDataRevision}
      flowRuntimeRefRef={flowRuntimeRefRef}
      hasOverlayEditors={overlayEdgeHostActive}
      emitFlowEditorInteractionFrame={emitFlowEditorInteractionFrame}
      overlayOnlyActive={overlayOnlyActive}
      overlayEdgesSvgRef={overlayEdgesSvgRef}
      overlayEditorElements={overlayEditorElements as unknown as React.ReactNode}
      noGraphLoaded={surfaceNoGraphLoaded}
      toolMode={toolMode}
      pendingEdgeSourceId={pendingEdgeSourceId}
      beginAddEdgeFromNode={beginAddEdgeFromNode} cancelPendingEdge={cancelPendingEdge} finalizePendingEdge={finalizePendingEdge}
      inspectorPortalHost={inspectorPortalHost}
      inspectorElement={inspectorElement}
      widgetRegistry={widgetRegistry}
      shouldDedupeWidgetDrop={shouldDedupeWidgetDrop}
      setCanvasWindowOffsetFromRect={setCanvasWindowOffsetFromRect}
      getLiveZoomTransform={getLiveZoomTransform}
      zoomViewKeyRef={zoomViewKeyRef}
      addNodeFromRegistryAtWorld={addNodeFromRegistryAtWorld}
      addRichMediaPanelFromMediaAtWorld={addRichMediaPanelFromMediaAtWorld}
      upsertUiToast={upsertUiToast}
      createPortal={createPortal}
    />
  )
}
