import React from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'

import {
  EMPTY_WIDGET_REGISTRY,
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
import FlowEditorCanvasSurface from '@/components/FlowEditorCanvas/runtime/FlowEditorCanvasSurface'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { resolveCanvasViewportMeasureElement } from '@/lib/canvas/viewportMeasureElement'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'
import { hashSignatureParts } from '@/lib/hash/signature'

const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_BOOL_RECORD: Record<string, boolean> = {}

export default function FlowEditorCanvasRuntime(
  {
    active = true,
    widgetDropCaptureEnabled = false,
    geospatialWidgetPanelMode = false,
  }: {
    active?: boolean
    widgetDropCaptureEnabled?: boolean
    geospatialWidgetPanelMode?: boolean
  },
) {
  const flowEditorSurfaceIdRef = React.useRef<string>('')
  if (!flowEditorSurfaceIdRef.current) {
    flowEditorSurfaceIdRef.current = `kgfe-${Math.random().toString(36).slice(2, 10)}`
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

  const baseGraphData = useGraphStore(s => s.graphData)
  const baseGraphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const graphContentRevision = useGraphStore(s => s.graphContentRevision || 0)
  const resolvedThemeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const {
    canvasRenderMode,
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    renderMediaAsNodes,
    mediaPanelDensity,
    collapsedGroupIds,
    markdownDocumentName,
    markdownDocumentSourceUrl,
  } = useGraphStore(
    useShallow(s => ({
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      documentSemanticMode: s.documentSemanticMode,
      frontmatterModeEnabled: s.frontmatterModeEnabled,
      renderMediaAsNodes: s.renderMediaAsNodes,
      mediaPanelDensity: s.mediaPanelDensity,
      collapsedGroupIds: s.collapsedGroupIds,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentSourceUrl: s.markdownDocumentSourceUrl,
    })),
  )
  const selectedNodeId = useGraphStore(s => (typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null))
  const selectedNodeIds = useGraphStore(s => (Array.isArray(s.selectedNodeIds) ? s.selectedNodeIds : EMPTY_STRING_ARRAY))
  const selectedEdgeId = useGraphStore(s => (typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null))
  const flowWidgetPinnedByNodeId = useGraphStore(s => s.flowWidgetPinnedByNodeId ?? EMPTY_BOOL_RECORD)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const selectGroup = useGraphStore(s => s.selectGroup)
  const setGraphDataPreservingLayout = useGraphStore(s => s.setGraphDataPreservingLayout)
  const addNode = useGraphStore(s => s.addNode)
  const updateNode = useGraphStore(s => s.updateNode)
  const updateEdge = useGraphStore(s => s.updateEdge)
  const addEdge = useGraphStore(s => s.addEdge)
  const createUserSubgraph = useGraphStore(s => s.createUserSubgraph)
  const updateUserSubgraph = useGraphStore(s => s.updateUserSubgraph)
  const removeUserSubgraph = useGraphStore(s => s.removeUserSubgraph)
  const addNodesToUserSubgraph = useGraphStore(s => s.addNodesToUserSubgraph)
  const removeNodesFromUserSubgraph = useGraphStore(s => s.removeNodesFromUserSubgraph)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)
  const documentStructureBaselineLock = useGraphStore(s => s.documentStructureBaselineLock === true)
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)
  const toggleGroupCollapsed = useGraphStore(s => s.toggleGroupCollapsed)
  const setSelectionSourceForActions = React.useCallback(
    (source: 'canvas' | 'menu' | 'toolbar' | 'editor' | 'unknown' | 'system') => {
      setSelectionSource(source === 'canvas' || source === 'toolbar' ? source : 'editor')
    },
    [setSelectionSource],
  )

  const baseGraphKind = React.useMemo(() => {
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
  const activeDocumentKey = React.useMemo(() => {
    const name = typeof markdownDocumentName === 'string' ? markdownDocumentName.trim() : ''
    const sourceUrl = typeof markdownDocumentSourceUrl === 'string' ? markdownDocumentSourceUrl.trim() : ''
    return `${name}::${sourceUrl}`
  }, [markdownDocumentName, markdownDocumentSourceUrl])
  const flowEditorViewActive = editorRuntimeActive
  const workspaceMutationBlocked = useGraphStore(s => isWorkspaceGraphMutationBlocked(s))
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

  const documentWidgetRegistry = useGraphStore(s =>
    Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : EMPTY_WIDGET_REGISTRY,
  )
  const effectiveWidgetRegistry = useGraphStore(s =>
    Array.isArray(s.effectiveWidgetRegistry) ? s.effectiveWidgetRegistry : EMPTY_WIDGET_REGISTRY,
  )
  const baseWidgetRegistry = useGraphStore(s =>
    Array.isArray(s.widgetRegistry) ? s.widgetRegistry : EMPTY_WIDGET_REGISTRY,
  )
  const widgetRegistry = React.useMemo(
    () => buildDataflowWidgetRegistry({ documentWidgetRegistry, effectiveWidgetRegistry, widgetRegistry: baseWidgetRegistry }),
    [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry],
  )
  const widgetRegistryRef = React.useRef(widgetRegistry)
  const lastWidgetDropRef = React.useRef<{ key: string; ts: number } | null>(null)
  const lastDroppedWidgetNodeIdRef = React.useRef<string | null>(null)
  const [lastDroppedWidgetToken, setLastDroppedWidgetToken] = React.useState<number>(0)

  const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds ?? EMPTY_STRING_ARRAY)
  const openWidgetNodeIdsRef = React.useRef(openWidgetNodeIds)
  const overlayEditorNodeIdsRef = React.useRef<string[]>([])
  const updateOpenWidgetNodeIds = useGraphStore(s => s.updateOpenWidgetNodeIds)
  const setOpenWidgetNodeIds = useGraphStore(s => s.setOpenWidgetNodeIds)

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
  const pendingOverlayNodeIdRef = React.useRef<string | null>(null)
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
    selectedEdgeId,
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

  const { appendDraftNode, beginAddEdgeFromNode, finalizePendingEdge } = useFlowEditorGraphActions({
    active,
    draftGraphData,
    baseGraphData: (baseGraphData || null) as GraphData | null,
    schema,
    selectedNodeId,
    toolMode,
    pendingEdgeSourceId,
    pendingEdgeSourcePortKey,
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

  const { addNodeFromRegistryAtWorld } = useFlowEditorWidgetDropBridge({
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
    setPendingOverlayNode,
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

  const {
    applyJsonToDraft,
    clearNodeOutputById,
    convertNodeToLoopById,
    duplicateNodeById,
    enableHandlesForAllInputs,
    patchNodePropertiesById,
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
    canInteract,
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
  })
  const overlayEditorNodeIdsKey = React.useMemo(() => {
    return hashSignatureParts(['overlay-editor-node-ids', ...overlayEditorNodeIds])
  }, [overlayEditorNodeIds])
  React.useEffect(() => {
    overlayEditorNodeIdsRef.current = overlayEditorNodeIds
  }, [overlayEditorNodeIds])
  React.useEffect(() => {
    overlayEdgesEnabledRef.current = overlayOnlyActive
    if (!overlayOnlyActive) return
    scheduleOverlayEdgeUpdate()
  }, [overlayEditorNodeIdsKey, overlayOnlyActive, overlayTopologyLayoutSignature, scheduleOverlayEdgeUpdate])

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
      renderGraphDataOverride={flowCanvasGraphDataOverride}
      flowEditorViewActive={flowEditorViewActive}
      draftGraphDataRevision={draftGraphDataRevision}
      baseGraphDataRevision={baseGraphDataRevision}
      flowRuntimeRefRef={flowRuntimeRefRef}
      hasOverlayEditors={hasOverlayEditors}
      emitFlowEditorInteractionFrame={emitFlowEditorInteractionFrame}
      overlayOnlyActive={overlayOnlyActive}
      overlayEdgesSvgRef={overlayEdgesSvgRef}
      overlayEditorElements={overlayEditorElements as unknown as React.ReactNode}
      noGraphLoaded={noGraphLoaded}
      toolMode={toolMode}
      pendingEdgeSourceId={pendingEdgeSourceId}
      inspectorPortalHost={inspectorPortalHost}
      inspectorElement={inspectorElement}
      widgetRegistry={widgetRegistry}
      shouldDedupeWidgetDrop={shouldDedupeWidgetDrop}
      setCanvasWindowOffsetFromRect={setCanvasWindowOffsetFromRect}
      getLiveZoomTransform={getLiveZoomTransform}
      zoomViewKeyRef={zoomViewKeyRef}
      addNodeFromRegistryAtWorld={addNodeFromRegistryAtWorld}
      upsertUiToast={upsertUiToast}
      createPortal={createPortal}
    />
  )
}
