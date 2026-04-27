import React from 'react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'

import FlowCanvas from '@/components/FlowCanvas'
import FlowEditorInspector, { type InspectorTab } from '@/components/FlowEditor/FlowEditorInspector'
import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { computeFlowGroupAabb } from '@/components/FlowCanvas/nativeRuntime'
import { coerceJsonObject, safeJsonStringify, tryParseJson } from '@/components/FlowEditor/flowEditorJson'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import { createUniqueId } from '@/lib/ids'
import { normalizeGraphData } from '@/lib/graph/normalize'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { WORKFLOW_RUN_ALL_EVENT } from '@/features/canvas/utils'
import { parseCanonicalNodeIds, resolveGraphNodeByCanonicalId, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import {
  FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID,
  FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS,
  FLOW_IMAGE_GENERATION_NODE_LABEL,
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
  FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
  FLOW_TEXT_GENERATION_NODE_LABEL,
  FLOW_TEXT_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  FLOW_WIDGET_REGISTRY_METADATA_KEY,
  LS_KEYS,
  UI_COPY,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { screenToWorld, viewportCenterToWorld, worldToScreen } from '@/lib/zoom/viewport'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { getZoomStateForKey } from '@/lib/canvas/zoom-effective'
import {
  convertNodeToLoopInGraphData,
  enableHandlesForAllInputsInSchema,
  isHandlesForAllInputsEnabled,
} from '@/lib/flowEditor/flowEditorActions'
import {
  computeFlowConnectedValuesBySchemaPath,
  type FlowConnectedValuesBySchemaPath,
} from '@/lib/flowEditor/flowDataflow'
import { getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers'
import { FLOW_RUN_ALL_PHASES, buildFlowRunAllNodeSequence } from '@/lib/flowEditor/runAllSequenceSsot'
import { buildDataflowWidgetRegistry } from '@/lib/flowEditor/widgetRegistryDataflow'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  FLOW_EDGE_DISPLAY_LABEL_KEY,
  FLOW_SCHEMA_FIELDS_PROPERTY_KEY,
  buildSchemaFieldPortKey,
  buildFlowEdgeDisplayLabelFromPorts,
  pickDefaultFlowPortKey,
  readSchemaFieldSpecs,
} from '@/lib/graph/flowPorts'
import { readFrontmatterFlowRenderSettings } from '@/lib/graph/frontmatterFlowSettings'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { buildFlowWidgetEligibleNodeIdSet, filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'
import { isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import { canAddEdge } from '@/features/schema/validation'
import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'
import { FLOW_WIDGET_FORM_ID_KEY, FLOW_WIDGET_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { resolveWidgetRegistryEntry } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import {
  clearActiveFlowWidgetPointerDragSession,
  hasFlowWidgetDragType,
  readActiveFlowWidgetPointerDragSession,
  readFlowWidgetDragPayloadFromDataTransfer,
} from '@/lib/flowEditor/widgetDrag'
import { buildSelectionSubgraph, exportWidgetBundleAsJson } from '@/lib/graph/file'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { Z_INDEX_FLOATING_PANEL_DEFAULT } from '@/lib/ui/zIndex'
import { computeWidgetScale, computeWidgetScaledSize } from '@/components/FlowEditor/widgetZoom'
import { computeWidgetMaxAnchorShiftPx } from '@/components/FlowEditor/widgetLayout'
import { placeWidgetsCenteredInGroupBounds } from '@/components/FlowEditor/seedGroupSpread'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { readFlowLayoutKnobs } from '@/lib/graph/layoutDefaults'
import { relaxOverlayPanelsWithCollision } from '@/components/FlowCanvas/relaxOverlayPanels'
import { buildFlowHandleId, computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT, FLOW_EDITOR_OVERLAY_ROOT_SELECTOR } from '@/lib/canvas/flow-editor-overlay-proxy'
import { readSubgraphs, subgraphGroupId } from '@/lib/graph/subgraphs'
import { buildEdgePathD, readEdgePathCurveOptions, readGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'
import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect'
import { ensureEditorCanvasLandingForDuration } from '@/lib/toolbar/workspaceLandingGuard'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { getWorkspaceFs } from '@/features/workspace-fs/workspaceFs'
import { isKgcWorkspaceCompanionPath, toCanonicalKgcWorkspacePath } from '@/features/chat/chatHistoryWorkspace.paths'
import { emitKgcRunOutput } from '@/features/chat/kgcRunOutput'
import {
  buildTextWidgetOutputPatch,
  buildRichMediaWidgetOutputPatch,
  clearRichMediaOutputProperties,
  resolveRichMediaWidgetKind,
  runRichMediaWidgetGeneration,
} from '@/features/chat/richMediaRun'
import {
  CHAT_BYTEPLUS_IMAGE_MODEL_DEFAULT,
  CHAT_BYTEPLUS_VIDEO_MODEL_DEFAULT,
  CHAT_PROVIDER_BYTEPLUS,
  getChatDefaultEndpointUrlForProvider,
  normalizeChatProviderId,
} from '@/lib/chatEndpoint'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { generateRunMarkdownWithProvider } from '@/features/chat/byteplusRunGeneration'
import {
  inferTextGenerationProviderFamily,
  getWidgetRegistryEntryLabel,
  resolveEffectiveTextGenerationWidgetProperties,
  resolveTextGenerationGlobalDefaultsForProviderFamily,
} from '@/features/flow-editor-manager/registryTemplates'
import { buildBytePlusImageWidgetSeedProperties } from '@/features/integrations/byteplusImageGenerationDefaults'
import { buildBytePlusVideoWidgetSeedProperties } from '@/features/integrations/byteplusVideoGenerationDefaults'
import {
  FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID,
  readGrabMapsDiscoveryWidgetProperties,
} from '@/features/flow-editor-manager/grabMapsDiscoveryWidget'
import { requestGeospatialCurrentLocation, setGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { readGeospatialCursorLngLat } from '@/lib/gympgrph/api'

type ToolMode = 'select' | 'addEdge'

const OVERLAY_NODE_OVERRIDE_LOCK_MS = 4000
const WIDGET_DROP_DEDUPE_WINDOW_MS = 250
const FORCE_SELECT_TICK_MS = 30
const FORCE_SELECT_MAX_TICKS = 80
const EMPTY_WIDGET_REGISTRY: WidgetRegistryEntry[] = []

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function pickFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const parsed = Number(v)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function readFiniteGeoLatLng(properties: Record<string, unknown>): { lat: number; lng: number } | null {
  const geoRaw = isRecord(properties.geo) ? properties.geo : null
  const lat = pickFiniteNumber(geoRaw?.lat)
  const lng = pickFiniteNumber(geoRaw?.lng)
  if (lat == null || lng == null) return null
  return { lat, lng }
}

function isCanonicalFrontmatterBuiltInWidgetNode(node: Pick<GraphNode, 'id' | 'type'> | null | undefined): boolean {
  const nodeType = String(node?.type || '').trim()
  return nodeType === FLOW_TEXT_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_IMAGE_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_VIDEO_GENERATION_NODE_TYPE_ID
    || nodeType === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
}

function resolveGraphNodeIdByCanonicalId(graph: GraphData | null | undefined, rawId: unknown): string {
  return String(resolveGraphNodeByCanonicalId(graph, rawId)?.id || '').trim()
}

function snapToGridPx(value: number, stepPx: number): number {
  if (!Number.isFinite(value)) return 0
  const step = Number.isFinite(stepPx) ? Math.max(1, Math.floor(stepPx)) : 1
  if (step <= 1) return value
  return Math.round(value / step) * step
}

function readWidgetGridLayoutSettings(schema: unknown): { gridEnabled: boolean; stepPx: number; gapPx: number } {
  const behavior =
    schema && typeof schema === 'object' && !Array.isArray(schema)
      ? ((schema as { behavior?: unknown }).behavior as Record<string, unknown> | undefined)
      : undefined
  const snapGrid =
    behavior && typeof behavior.snapGrid === 'object' && behavior.snapGrid !== null
      ? (behavior.snapGrid as Record<string, unknown>)
      : null
  const canvasGrid =
    behavior && typeof behavior.canvasGrid === 'object' && behavior.canvasGrid !== null
      ? (behavior.canvasGrid as Record<string, unknown>)
      : null
  const snapEnabled = snapGrid?.enabled === true
  const canvasEnabled = canvasGrid?.enabled === true
  const gridEnabled = snapEnabled || canvasEnabled
  const snapSizeRaw = typeof snapGrid?.size === 'number' && Number.isFinite(snapGrid.size) ? snapGrid.size : 20
  const snapSize = Math.max(6, Math.min(160, Math.floor(snapSizeRaw)))
  const majorEveryRaw = typeof canvasGrid?.majorEvery === 'number' && Number.isFinite(canvasGrid.majorEvery) ? canvasGrid.majorEvery : 5
  const majorEvery = Math.max(2, Math.min(20, Math.floor(majorEveryRaw)))
  const stepPx = gridEnabled ? (snapEnabled ? snapSize : Math.max(8, Math.min(200, snapSize * majorEvery))) : 1
  const gapPx = gridEnabled ? Math.max(12, Math.min(80, Math.round(stepPx * 0.8))) : 12
  return { gridEnabled, stepPx, gapPx }
}

function deriveFlowEditorViewGraph(args: {
  graphData: GraphData | null
  collapsedGroupIds: string[]
  forceFrontmatterFlow?: boolean
}): GraphData | null {
  const base = args.graphData
  if (!base) return null
  const filtered = args.forceFrontmatterFlow === true ? filterGraphToFlowWidgetEligible(base) : base
  if (!Array.isArray(args.collapsedGroupIds) || args.collapsedGroupIds.length === 0) return filtered
  return deriveGraphDataWithGroupCollapse({
    graphData: filtered,
    collapsedGroupIds: args.collapsedGroupIds,
  })
}

const FlowEditorWidgetOverlay = React.memo(function FlowEditorWidgetOverlay(args: {
  visible?: boolean
  active: boolean
  node: GraphNode
  graphMetaKind?: string | null
  edges: ReadonlyArray<GraphEdge>
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  zoomViewKey: string | null
  autoRevealKey?: number
  forcePinnedToCanvas?: boolean
  stackIndex?: number
  getLiveNodeWorldPos?: (nodeId: string) => { x: number; y: number } | null
  getLiveZoomTransform?: () => { k: number; x: number; y: number } | null
  getLiveContainmentGroupAabbForNode?: (nodeId: string) => { groupId: string; minX: number; minY: number; maxX: number; maxY: number } | null
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  onBeginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode: (nodeId: string, portKey?: string | null) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
  onRun: () => void
  onDuplicate: () => void
  onRemove: () => void
  onClearOutput: () => void
  onHelp: () => void
  onConvertToLoopNode: () => void
  onEnableHandlesForAllInputs: () => void
  onPinnedInCanvasChange: (pinnedInCanvas: boolean) => void
  onRenameSchemaFieldId?: (args: { prevId: string; nextId: string }) => void
}) {
  return (
    <NodeOverlayEditor
      visible={args.visible}
      active={args.active}
      node={args.node}
      graphMetaKind={args.graphMetaKind}
      edges={args.edges}
      connectedValuesBySchemaPath={args.connectedValuesBySchemaPath}
      toolMode={args.toolMode}
      pendingEdgeSourceId={args.pendingEdgeSourceId}
      zoomViewKey={args.zoomViewKey}
      onBeginAddEdgeFromNode={args.onBeginAddEdgeFromNode}
      onFinalizeAddEdgeToNode={args.onFinalizeAddEdgeToNode}
      viewportW={args.viewportW}
      viewportH={args.viewportH}
      canvasWindowOffset={args.canvasWindowOffset}
      autoRevealKey={args.autoRevealKey}
      forcePinnedToCanvas={args.forcePinnedToCanvas}
      stackIndex={args.stackIndex}
      getLiveNodeWorldPos={args.getLiveNodeWorldPos}
      getLiveZoomTransform={args.getLiveZoomTransform}
      getLiveContainmentGroupAabbForNode={args.getLiveContainmentGroupAabbForNode}
      onSetLabel={args.onSetLabel}
      onSetType={args.onSetType}
      onPatchProperties={args.onPatchProperties}
      onSetProperties={args.onSetProperties}
      onValidate={args.onValidate}
      onRun={args.onRun}
      onDuplicate={args.onDuplicate}
      onRemove={args.onRemove}
      onClearOutput={args.onClearOutput}
      onHelp={args.onHelp}
      onConvertToLoopNode={args.onConvertToLoopNode}
      onEnableHandlesForAllInputs={args.onEnableHandlesForAllInputs}
      onPinnedInCanvasChange={args.onPinnedInCanvasChange}
      onRenameSchemaFieldId={args.onRenameSchemaFieldId}
    />
  )
})

export default function FlowEditorCanvas(
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
  const editorRuntimeActive = active || geospatialWidgetPanelMode
  const widgetDropBridgeOnly = widgetDropCaptureEnabled && !active && !geospatialWidgetPanelMode
  const rootRef = React.useRef<HTMLElement | null>(null)
  const { width, height, left: containerLeft, top: containerTop } = useContainerDims(rootRef)
  const viewportW = Math.max(1, Math.floor(width))
  const viewportH = Math.max(1, Math.floor(height))

  const [canvasWindowOffset, setCanvasWindowOffset] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const canvasWindowOffsetRef = React.useRef(canvasWindowOffset)
  React.useEffect(() => {
    canvasWindowOffsetRef.current = canvasWindowOffset
  }, [canvasWindowOffset])

  const setCanvasWindowOffsetFromRect = React.useCallback((rect: DOMRect) => {
    const left = Number.isFinite(rect.left) ? rect.left : 0
    const top = Number.isFinite(rect.top) ? rect.top : 0
    const prev = canvasWindowOffsetRef.current
    if (prev.left === left && prev.top === top) return
    setCanvasWindowOffset({ left, top })
  }, [])

  React.useEffect(() => {
    if (!editorRuntimeActive) return
    const left = Number.isFinite(containerLeft) ? containerLeft : 0
    const top = Number.isFinite(containerTop) ? containerTop : 0
    const prev = canvasWindowOffsetRef.current
    if (prev.left === left && prev.top === top) return
    setCanvasWindowOffset({ left, top })
  }, [containerLeft, containerTop, editorRuntimeActive])

  React.useEffect(() => {
    if (!editorRuntimeActive) return
    if (typeof window === 'undefined') return
    const measure = () => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const left = Number.isFinite(rect.left) ? rect.left : 0
      const top = Number.isFinite(rect.top) ? rect.top : 0
      const prev = canvasWindowOffsetRef.current
      if (prev.left === left && prev.top === top) return
      setCanvasWindowOffset({ left, top })
    }
    const onAny = () => {
      requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onAny, true)
    window.addEventListener('resize', onAny)
    return () => {
      window.removeEventListener('scroll', onAny, true)
      window.removeEventListener('resize', onAny)
    }
  }, [editorRuntimeActive])

  const baseGraphData = useGraphStore(s => s.graphData)
  const baseGraphDataRevision = useGraphStore(s => s.graphDataRevision || 0)
  const {
    canvasRenderMode,
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    renderMediaAsNodes,
    mediaPanelDensity,
    collapsedGroupIds,
    floatingPanelZIndex,
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
      floatingPanelZIndex: s.floatingPanelZIndex,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentSourceUrl: s.markdownDocumentSourceUrl,
    })),
  )
  const selectedNodeId = useGraphStore(s => (typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null))
  const selectedNodeIds = useGraphStore(s => (Array.isArray(s.selectedNodeIds) ? s.selectedNodeIds : []))
  const selectedEdgeId = useGraphStore(s => (typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null))
  const flowWidgetPinnedByNodeId = useGraphStore(s => s.flowWidgetPinnedByNodeId || {})
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

  const baseGraphKind = React.useMemo(() => {
    const meta = (baseGraphData?.metadata || {}) as Record<string, unknown>
    const byKind = String(meta.kind || '').trim()
    if (byKind) return byKind
    return String(baseGraphData?.context || '').trim()
  }, [baseGraphData])
  const flowEditorFrontmatterGraphAvailable = React.useMemo(() => {
    return baseGraphData ? isFrontmatterFlowGraph(baseGraphData as unknown as GraphData) : false
  }, [baseGraphData])
  const frontmatterOnlyPolicyActive = React.useMemo(() => {
    return isFrontmatterOnlyPolicyActive({ canvasRenderMode, canvas2dRenderer })
  }, [canvas2dRenderer, canvasRenderMode])
  const activeDocumentKey = React.useMemo(() => {
    const name = typeof markdownDocumentName === 'string' ? markdownDocumentName.trim() : ''
    const sourceUrl = typeof markdownDocumentSourceUrl === 'string' ? markdownDocumentSourceUrl.trim() : ''
    return `${name}::${sourceUrl}`
  }, [markdownDocumentName, markdownDocumentSourceUrl])
  const flowEditorViewActive = editorRuntimeActive
  const canEdit = editorRuntimeActive && !documentStructureBaselineLock
  const collapsedGroupIdsKey = React.useMemo(() => buildCollapsedGroupIdsKey(collapsedGroupIds), [collapsedGroupIds])
  const collapsedGroupIdsForView = React.useMemo(
    () => (collapsedGroupIdsKey ? collapsedGroupIdsKey.split('|').filter(Boolean) : []),
    [collapsedGroupIdsKey],
  )
  const zoomGraphData = React.useMemo((): GraphData | null => {
    return deriveFlowEditorViewGraph({
      graphData: (baseGraphData || null) as GraphData | null,
      collapsedGroupIds: collapsedGroupIdsForView,
      forceFrontmatterFlow: frontmatterOnlyPolicyActive,
    })
  }, [
    baseGraphData,
    collapsedGroupIdsForView,
    frontmatterOnlyPolicyActive,
  ])
  const flowEditorBaseGraphData = React.useMemo((): GraphData | null => {
    return deriveFlowEditorViewGraph({
      graphData: (baseGraphData || null) as GraphData | null,
      collapsedGroupIds: [],
      forceFrontmatterFlow: frontmatterOnlyPolicyActive,
    })
  }, [
    baseGraphData,
    frontmatterOnlyPolicyActive,
  ])

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
  const widgetRegistry = React.useMemo(() => {
    return buildDataflowWidgetRegistry({
      documentWidgetRegistry,
      effectiveWidgetRegistry,
      widgetRegistry: baseWidgetRegistry,
    })
  }, [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry])
  const widgetRegistryRef = React.useRef(widgetRegistry)
  const lastWidgetDropRef = React.useRef<{ key: string; ts: number } | null>(null)
  const lastDroppedWidgetNodeIdRef = React.useRef<string | null>(null)
  const [lastDroppedWidgetToken, setLastDroppedWidgetToken] = React.useState<number>(0)

  const openWidgetNodeIds = useGraphStore(s => s.openWidgetNodeIds || [])
  const openWidgetNodeIdsRef = React.useRef(openWidgetNodeIds)
  const updateOpenWidgetNodeIds = useGraphStore(s => s.updateOpenWidgetNodeIds)
  const setOpenWidgetNodeIds = useGraphStore(s => s.setOpenWidgetNodeIds)

  React.useEffect(() => {
    openWidgetNodeIdsRef.current = openWidgetNodeIds
  }, [openWidgetNodeIds])

  const flowRuntimeRefRef = React.useRef<React.MutableRefObject<import('@/components/FlowCanvas/nativeRuntime').FlowNativeRuntime | null> | null>(null)
  const getLiveNodeWorldPos = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    if (!runtime || runtime.positionsReady !== true) return null
    const n = runtime?.scene?.nodeById?.get(id) || null
    if (!n) return null
    const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
    const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
    if (x == null || y == null) return null
    return { x, y }
  }, [])

  const getLiveZoomTransform = React.useCallback(() => {
    const runtime = flowRuntimeRefRef.current?.current
    const t = runtime?.transform || null
    const k = typeof t?.k === 'number' && Number.isFinite(t.k) ? t.k : null
    const x = typeof t?.x === 'number' && Number.isFinite(t.x) ? t.x : null
    const y = typeof t?.y === 'number' && Number.isFinite(t.y) ? t.y : null
    if (k == null || x == null || y == null) return null
    return { k, x, y }
  }, [])
  const latestAutoSeedWorldPosByNodeIdRef = React.useRef<Record<string, { x: number; y: number }>>({})

  const getLiveContainmentGroupAabbForNode = React.useCallback((nodeId: string) => {
    const id = String(nodeId || '').trim()
    if (!id) return null
    const runtime = flowRuntimeRefRef.current?.current
    const scene = runtime?.scene
    if (!runtime || !scene) return null
    const groupIds = scene.groupIdsByNodeId?.get(id) || []
    if (!groupIds.length) return null
    const groups = Array.isArray(scene.groups) ? scene.groups : []
    if (groups.length === 0) return null

    const groupById = new Map<string, (typeof groups)[number]>()
    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const gid = String(g?.id || '').trim()
      if (gid && !groupById.has(gid)) groupById.set(gid, g)
    }

    const isContainmentGroup = (g: { id?: unknown; source?: unknown } | null): boolean => {
      if (!g) return false
      const src = String(g.source || '').trim()
      if (src === 'userSubgraph' || src === 'mermaidSubgraph' || src === 'layer' || src === 'community') return true
      const gid = String(g.id || '')
      if (gid.startsWith('subgraph:') || gid.startsWith('layer:') || gid.startsWith('community:')) return true
      return false
    }

    let bestId: string | null = null
    let bestDepth = -Infinity
    let bestSize = Infinity
    for (let i = 0; i < groupIds.length; i += 1) {
      const gid = String(groupIds[i] || '').trim()
      if (!gid) continue
      const g = groupById.get(gid) || null
      if (!isContainmentGroup(g)) continue
      const depthRaw = (g as unknown as { depth?: unknown })?.depth
      const depth = typeof depthRaw === 'number' && Number.isFinite(depthRaw) ? Math.max(0, Math.floor(depthRaw)) : 0
      const members = Array.isArray((g as unknown as { memberNodeIds?: unknown })?.memberNodeIds)
        ? ((g as unknown as { memberNodeIds: unknown[] }).memberNodeIds as unknown[])
        : []
      const size = members.length
      if (bestId == null || depth > bestDepth || (depth === bestDepth && size < bestSize) || (depth === bestDepth && size === bestSize && gid.localeCompare(bestId) < 0)) {
        bestId = gid
        bestDepth = depth
        bestSize = size
      }
    }
    if (!bestId) return null
    const best = groupById.get(bestId) || null
    if (!best) return null

    const st = useGraphStore.getState()
    const openIds = Array.isArray(st.openWidgetNodeIds) ? st.openWidgetNodeIds : []
    const worldById =
      (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}
    const autoSeedWorldById = latestAutoSeedWorldPosByNodeIdRef.current || {}
    const t =
      getLiveZoomTransform() ||
      getEffectiveZoomStateForKey({
        zoomViewKey: zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) ||
      { k: 1, x: 0, y: 0 }
    const zoomK = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
    const panelScale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
    const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
    const overlayAabbByNodeId: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {}
    for (let i = 0; i < openIds.length; i += 1) {
      const openId = String(openIds[i] || '').trim()
      if (!openId) continue
      const world = worldById[openId] || autoSeedWorldById[openId]
      if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
      overlayAabbByNodeId[openId] = {
        minX: world.x,
        minY: world.y,
        maxX: world.x + panelWorldW,
        maxY: world.y + panelWorldH,
      }
    }

    const cfg = runtime.presentation.groups
    const aabb = computeFlowGroupAabb({
      scene,
      group: best as never,
      paddingPx: cfg.paddingPx,
      labelTopExtraPx: cfg.labelTopExtraPx,
      overlayAabbByNodeId,
    })
    if (!aabb) return null
    return { groupId: bestId, ...aabb }
  }, [getLiveZoomTransform])

  const seededPinnedWidgetWorldPosKeyRef = React.useRef<string>('')
  const autoSeededPinnedWidgetSnapshotRef = React.useRef<{
    signature: string
    positions: Record<string, { x: number; y: number }>
  }>({ signature: '', positions: {} })
  useIsomorphicLayoutEffect(() => {
    if (!active) return
    const openIds = openWidgetNodeIds
    if (!Array.isArray(openIds) || openIds.length === 0) return

    const st = useGraphStore.getState()
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const worldById =
      (st as unknown as { flowWidgetWorldPosByNodeId?: Record<string, { x: number; y: number }> })
        .flowWidgetWorldPosByNodeId || {}

    const pendingRaw = openIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        const pinned = typeof v === 'boolean' ? v : true
        if (!pinned) return false
        const w = worldById[id]
        return !(w && Number.isFinite(w.x) && Number.isFinite(w.y))
      })

    const liveZoom = getLiveZoomTransform()
    const z =
      liveZoom ||
      getEffectiveZoomStateForKey({
        zoomViewKey: zoomViewKeyRef.current,
        zoomStateByKey: st.zoomStateByKey,
        zoomState: st.zoomState,
      }) ||
      { k: 1, x: 0, y: 0 }
    const zoomK = typeof z.k === 'number' && Number.isFinite(z.k) ? z.k : 1
    const panelScale = computeWidgetScale(zoomK, null, { mode: 'pinnedInCanvas' })
    const panelScreen = computeWidgetScaledSize(panelScale)
    const panelWorldW = panelScreen.width / Math.max(0.001, zoomK)
    const panelWorldH = panelScreen.height / Math.max(0.001, zoomK)
    const widgetGrid = readWidgetGridLayoutSettings(schema)

    const GAP_SCREEN_PX = Math.max(24, widgetGrid.gapPx)
    const gapWorld = GAP_SCREEN_PX / Math.max(0.001, zoomK)
    const cellW = (panelScreen.width + GAP_SCREEN_PX) / Math.max(0.001, zoomK)
    const cellH = (panelScreen.height + GAP_SCREEN_PX) / Math.max(0.001, zoomK)
    const worldStep = widgetGrid.gridEnabled ? Math.max(1, widgetGrid.stepPx) : 1
    const snapWorld = (v: number) => (worldStep > 1 ? snapToGridPx(v, worldStep) : v)

    const center = viewportCenterToWorld({ transform: z, viewportW, viewportH })
    const viewportHalfWorldW = viewportW / Math.max(0.001, zoomK) / 2
    const viewportHalfWorldH = viewportH / Math.max(0.001, zoomK) / 2
    const viewportBounds = {
      minX: center.x - viewportHalfWorldW,
      minY: center.y - viewportHalfWorldH,
      maxX: center.x + viewportHalfWorldW,
      maxY: center.y + viewportHalfWorldH,
    }
    const placeSpreadGridInBounds = (ids: string[], bounds: { minX: number; minY: number; maxX: number; maxY: number }) =>
      placeWidgetsCenteredInGroupBounds({
        ids,
        bounds,
        cellW,
        cellH,
        gapWorld,
        snapWorld,
      })

    const VIEWPORT_BUCKET_ID = '__viewport__'
    const pinnedOpenIds = openIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        return typeof v === 'boolean' ? v : true
      })
      .sort((a, b) => a.localeCompare(b))
    const allBoundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    allBoundsByBucket.set(VIEWPORT_BUCKET_ID, viewportBounds)
    for (let i = 0; i < pinnedOpenIds.length; i += 1) {
      const id = pinnedOpenIds[i]!
      const group = getLiveContainmentGroupAabbForNode(id)
      if (!group) continue
      allBoundsByBucket.set(`group:${group.groupId}`, { minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY })
    }

    const bucketSignature = Array.from(allBoundsByBucket.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucketId, bounds]) => {
        const minX = Math.round(bounds.minX * 1000) / 1000
        const minY = Math.round(bounds.minY * 1000) / 1000
        const maxX = Math.round(bounds.maxX * 1000) / 1000
        const maxY = Math.round(bounds.maxY * 1000) / 1000
        return `${bucketId}:${minX},${minY},${maxX},${maxY}`
      })
      .join('|')

    const snapshot = autoSeededPinnedWidgetSnapshotRef.current
    const isSameWorldPos = (a: { x: number; y: number } | null | undefined, b: { x: number; y: number } | null | undefined) => {
      if (!a || !b) return false
      return Math.abs(a.x - b.x) <= 0.0001 && Math.abs(a.y - b.y) <= 0.0001
    }
    const reseedEligible = openIds
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .filter(id => {
        const v = pinnedById[id]
        const pinned = typeof v === 'boolean' ? v : true
        if (!pinned) return false
        const current = worldById[id]
        if (!current || !Number.isFinite(current.x) || !Number.isFinite(current.y)) return false
        const currentLayoutSignature = `${baseGraphDataRevision}|${zoomViewKeyRef.current || ''}|${viewportW}x${viewportH}|${bucketSignature}`
        return snapshot.signature !== '' && snapshot.signature !== currentLayoutSignature && isSameWorldPos(current, snapshot.positions[id])
      })
    const overlapEligible = (() => {
      const idsByBucket = new Map<string, string[]>()
      for (let i = 0; i < pinnedOpenIds.length; i += 1) {
        const id = pinnedOpenIds[i]!
        const world = worldById[id]
        if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) continue
        const group = getLiveContainmentGroupAabbForNode(id)
        const bucketId = group ? `group:${group.groupId}` : VIEWPORT_BUCKET_ID
        const list = idsByBucket.get(bucketId) || []
        list.push(id)
        idsByBucket.set(bucketId, list)
      }
      const overlappingIds = new Set<string>()
      const hasOverlap = (aId: string, bId: string) => {
        const a = worldById[aId]
        const b = worldById[bId]
        if (!a || !b) return false
        const overlapX = a.x < b.x + panelWorldW && b.x < a.x + panelWorldW
        const overlapY = a.y < b.y + panelWorldH && b.y < a.y + panelWorldH
        return overlapX && overlapY
      }
      for (const ids of idsByBucket.values()) {
        for (let i = 0; i < ids.length; i += 1) {
          const a = ids[i]!
          for (let j = i + 1; j < ids.length; j += 1) {
            const b = ids[j]!
            if (!hasOverlap(a, b)) continue
            overlappingIds.add(a)
            overlappingIds.add(b)
          }
        }
      }
      return Array.from(overlappingIds)
    })()
    const pending = Array.from(new Set([...pendingRaw, ...reseedEligible, ...overlapEligible])).sort((a, b) => a.localeCompare(b))
    if (pending.length === 0) return

    const currentLayoutSignature = `${baseGraphDataRevision}|${zoomViewKeyRef.current || ''}|${viewportW}x${viewportH}|${bucketSignature}`
    const idsByBucket = new Map<string, string[]>()
    const boundsByBucket = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>()
    boundsByBucket.set(VIEWPORT_BUCKET_ID, viewportBounds)
    for (let i = 0; i < pending.length; i += 1) {
      const id = pending[i]!
      const group = getLiveContainmentGroupAabbForNode(id)
      const bucketId = group ? `group:${group.groupId}` : VIEWPORT_BUCKET_ID
      const list = idsByBucket.get(bucketId) || []
      list.push(id)
      idsByBucket.set(bucketId, list)
      if (group) boundsByBucket.set(bucketId, { minX: group.minX, minY: group.minY, maxX: group.maxX, maxY: group.maxY })
    }
    const bucketIds = Array.from(idsByBucket.keys()).sort((a, b) => a.localeCompare(b))
    const pendingSet = new Set(pending)
    const seedKey = `${pending.join(',')}|${currentLayoutSignature}`
    if (seededPinnedWidgetWorldPosKeyRef.current === seedKey) return
    seededPinnedWidgetWorldPosKeyRef.current = seedKey

    const nextWorld = { ...worldById }
    let changed = false
    const nextAutoSeedPositions: Record<string, { x: number; y: number }> = {}
    for (let i = 0; i < bucketIds.length; i += 1) {
      const bucketId = bucketIds[i]!
      const ids = (idsByBucket.get(bucketId) || [])
        .filter(id => pendingSet.has(id))
        .sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) continue
      const bounds = boundsByBucket.get(bucketId) || viewportBounds
      const placed = placeSpreadGridInBounds(ids, bounds)
      for (let j = 0; j < placed.length; j += 1) {
        const p = placed[j]!
        const prev = worldById[p.id]
        if (!prev || Math.abs(prev.x - p.x) > 0.0001 || Math.abs(prev.y - p.y) > 0.0001) changed = true
        nextWorld[p.id] = { x: p.x, y: p.y }
        nextAutoSeedPositions[p.id] = { x: p.x, y: p.y }
      }
    }
    autoSeededPinnedWidgetSnapshotRef.current = {
      signature: currentLayoutSignature,
      positions: nextAutoSeedPositions,
    }
    latestAutoSeedWorldPosByNodeIdRef.current = nextAutoSeedPositions
    if (!changed) return
    st.setFlowWidgetWorldPosByNodeId(nextWorld)
  }, [active, baseGraphDataRevision, getLiveZoomTransform, openWidgetNodeIds, schema, viewportH, viewportW])

  const emitFlowEditorInteractionFrame = React.useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.dispatchEvent(new CustomEvent(FLOW_EDITOR_INTERACTION_FRAME_EVENT))
    } catch {
      void 0
    }
  }, [])

  const [toolMode, setToolMode] = React.useState<ToolMode>('select')
  const [pendingEdgeSourceId, setPendingEdgeSourceId] = React.useState<string | null>(null)
  const [pendingEdgeSourcePortKey, setPendingEdgeSourcePortKey] = React.useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>('node')

  const [draftGraphData, setDraftGraphData] = React.useState<GraphData | null>(null)
  const draftGraphDataRef = React.useRef<GraphData | null>(null)
  const draftGraphDataRevision = React.useMemo(() => {
    const draft = draftGraphData
    if (!draft) return baseGraphDataRevision
    const meta = draft.metadata
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return baseGraphDataRevision
    const raw = (meta as Record<string, unknown>).graphDataRevision
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : baseGraphDataRevision
  }, [baseGraphDataRevision, draftGraphData])
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

  const [nodePropsJson, setNodePropsJson] = React.useState('')
  const [nodeMetaJson, setNodeMetaJson] = React.useState('')
  const [edgePropsJson, setEdgePropsJson] = React.useState('')
  const [edgeMetaJson, setEdgeMetaJson] = React.useState('')
  const [workflowMetaJson, setWorkflowMetaJson] = React.useState('')
  const [workflowContextJson, setWorkflowContextJson] = React.useState('')
  const [jsonError, setJsonError] = React.useState<string | null>(null)


  const [inspectorPortalHost, setInspectorPortalHost] = React.useState<HTMLElement | null>(null)

  const resolveInspectorPortalHost = React.useCallback(() => {
    if (!active) return null
    if (typeof document === 'undefined') return null
    try {
      const el = document.getElementById(FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID)
      if (!el) return null
      if (!(el instanceof HTMLElement)) return null
      if (!el.isConnected) return null
      return el
    } catch {
      return null
    }
  }, [active])

  React.useEffect(() => {
    if (!active) {
      setInspectorPortalHost(null)
      return
    }
    const resolved = resolveInspectorPortalHost()
    setInspectorPortalHost(prev => (prev === resolved ? prev : resolved))
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => {
      const nextResolved = resolveInspectorPortalHost()
      setInspectorPortalHost(prev => (prev === nextResolved ? prev : nextResolved))
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [active, resolveInspectorPortalHost])

  React.useLayoutEffect(() => {
    if (!editorRuntimeActive) {
      setDraftGraphData(null)
      return
    }
    const base = flowEditorBaseGraphData as GraphData | null
    setDraftGraphData(prev => (prev === base ? prev : base))
  }, [baseGraphDataRevision, editorRuntimeActive, flowEditorBaseGraphData])

  const rawRenderGraphDataOverride = React.useMemo((): GraphData | null => {
    const graphDataForRender = flowEditorViewActive ? draftGraphData : ((baseGraphData || null) as GraphData | null)
    return deriveFlowEditorViewGraph({
      graphData: graphDataForRender,
      collapsedGroupIds: collapsedGroupIdsForView,
      forceFrontmatterFlow: frontmatterOnlyPolicyActive,
    })
  }, [
    baseGraphData,
    collapsedGroupIdsForView,
    draftGraphData,
    frontmatterOnlyPolicyActive,
    flowEditorViewActive,
  ])
  const [stableRenderGraphOverride, setStableRenderGraphOverride] = React.useState<{
    documentKey: string
    graphData: GraphData | null
  } | null>(null)
  React.useLayoutEffect(() => {
    if (!active) {
      setStableRenderGraphOverride(null)
      return
    }
    const nextGraph = rawRenderGraphDataOverride
    const nextHasNodes = Array.isArray(nextGraph?.nodes) && nextGraph.nodes.length > 0
    if (nextHasNodes || !frontmatterOnlyPolicyActive) {
      setStableRenderGraphOverride(prev => {
        if (prev?.documentKey === activeDocumentKey && prev.graphData === nextGraph) return prev
        return { documentKey: activeDocumentKey, graphData: nextGraph }
      })
      return
    }
    setStableRenderGraphOverride(prev => {
      if (prev?.documentKey === activeDocumentKey) return prev
      return { documentKey: activeDocumentKey, graphData: nextGraph }
    })
  }, [active, activeDocumentKey, frontmatterOnlyPolicyActive, rawRenderGraphDataOverride])
  const renderGraphDataOverride = React.useMemo((): GraphData | null => {
    const nextGraph = rawRenderGraphDataOverride
    const nextHasNodes = Array.isArray(nextGraph?.nodes) && nextGraph.nodes.length > 0
    if (nextHasNodes) return nextGraph
    if (!frontmatterOnlyPolicyActive) return nextGraph
    if (stableRenderGraphOverride?.documentKey !== activeDocumentKey) return nextGraph
    const stableGraph = stableRenderGraphOverride?.graphData || null
    const stableHasNodes = Array.isArray(stableGraph?.nodes) && stableGraph.nodes.length > 0
    return stableHasNodes ? stableGraph : nextGraph
  }, [activeDocumentKey, frontmatterOnlyPolicyActive, rawRenderGraphDataOverride, stableRenderGraphOverride])
  const frontmatterFlowRenderSettings = React.useMemo(() => {
    return readFrontmatterFlowRenderSettings(renderGraphDataOverride)
  }, [renderGraphDataOverride])

  const overlayOnlyModeEnabled = React.useMemo(() => {
    return flowEditorViewActive
  }, [flowEditorViewActive])

  const overlayCollisionResolveRafRef = React.useRef<number | null>(null)
  const overlayCollisionResolveKeyRef = React.useRef<string>('')
  const overlayRectCacheRef = React.useRef<Map<string, { left: number; top: number; width: number; height: number }>>(new Map())
  const overlayCollisionIterKeyRef = React.useRef<string>('')
  const overlayCollisionIterCountRef = React.useRef<number>(0)
  const overlayCollisionWarmupStartedAtMsRef = React.useRef<number | null>(null)
  const overlayCollisionWarmupAttemptsRef = React.useRef<number>(0)

  const scheduleOverlayCollisionResolve = React.useCallback(() => {
    if (!editorRuntimeActive) return
    if (typeof document === 'undefined') return
    if (typeof window === 'undefined') return
    if (overlayCollisionResolveRafRef.current != null) return
    if (overlayCollisionWarmupStartedAtMsRef.current == null) overlayCollisionWarmupStartedAtMsRef.current = Date.now()

    overlayCollisionResolveRafRef.current = window.requestAnimationFrame(() => {
      overlayCollisionResolveRafRef.current = null
      if (!editorRuntimeActive) return

      const overlayEls = Array.from(document.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
      if (overlayEls.length < 2) {
        const st = useGraphStore.getState()
        const wantsResolve = (st.openWidgetNodeIds || []).length >= 2 || overlayOnlyModeEnabled
        overlayCollisionWarmupAttemptsRef.current += 1
        const startedAt = overlayCollisionWarmupStartedAtMsRef.current || Date.now()
        const elapsed = Date.now() - startedAt
        if (wantsResolve && overlayCollisionWarmupAttemptsRef.current < 60 && elapsed < 1600) {
          scheduleOverlayCollisionResolve()
          return
        }
        overlayCollisionWarmupStartedAtMsRef.current = null
        overlayCollisionWarmupAttemptsRef.current = 0
        return
      }
      overlayCollisionWarmupStartedAtMsRef.current = null
      overlayCollisionWarmupAttemptsRef.current = 0

      const graphKind = (() => {
        const meta = (renderGraphDataOverride?.metadata || null) as Record<string, unknown> | null
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return ''
        return String(meta.kind || '').trim()
      })()
      const isFrontmatterFlow = graphKind === 'frontmatter-flow'
      const nodeById = (() => {
        const nodes = Array.isArray(renderGraphDataOverride?.nodes) ? (renderGraphDataOverride?.nodes as GraphNode[]) : []
        const m = new Map<string, GraphNode>()
        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i]
          const id = String(n?.id || '').trim()
          if (!id || m.has(id)) continue
          m.set(id, n)
        }
        return m
      })()
      const readNum = (v: unknown): number => {
        const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
        return typeof n === 'number' && Number.isFinite(n) ? n : 0
      }
      const compareByVisualIndex = (aId: string, bId: string): number => {
        if (!aId || !bId) return String(aId || '').localeCompare(String(bId || ''))
        if (aId === bId) return 0
        const readKey = (id: string) => {
          const n = nodeById.get(id)
          const props = (n?.properties || {}) as Record<string, unknown>
          const z = readNum(props['visual:zIndex'] ?? props['visual:depth'] ?? props['visual:layer'])
          const y = readNum(props['visual:yIndex'])
          const x = readNum(props['visual:xIndex'])
          return { z, y, x, id }
        }
        const a = readKey(aId)
        const b = readKey(bId)
        if (a.z !== b.z) return a.z - b.z
        if (a.y !== b.y) return a.y - b.y
        if (a.x !== b.x) return a.x - b.x
        return a.id.localeCompare(b.id)
      }

      const overlayNodeIds = (() => {
        const next: string[] = []
        const seen = new Set<string>()
        for (let i = 0; i < overlayEls.length; i += 1) {
          const id = String(overlayEls[i]?.dataset?.kgWidget || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          next.push(id)
        }
        return isFrontmatterFlow ? next.sort(compareByVisualIndex) : next.sort((a, b) => a.localeCompare(b))
      })()
      if (overlayNodeIds.length < 2) return

      const st = useGraphStore.getState()
      if (st.flowWidgetDraggingNodeId) return
      const liveZoom = getLiveZoomTransform()
      const zoomKRaw =
        (liveZoom?.k ??
          getEffectiveZoomStateForKey({
            zoomViewKey: zoomViewKeyRef.current,
            zoomStateByKey: st.zoomStateByKey,
            zoomState: st.zoomState,
          })?.k) ?? null
      const zoomK = typeof zoomKRaw === 'number' && Number.isFinite(zoomKRaw) ? zoomKRaw : 1
      const zKey = String(Math.round(zoomK * 1000) / 1000)
      const overlayViewport = (() => {
        return { width: viewportW, height: viewportH }
      })()
      const key = `${overlayNodeIds.join(',')}|${zKey}|${overlayViewport.width}x${overlayViewport.height}|${overlayOnlyModeEnabled ? 1 : 0}`
      if (overlayCollisionResolveKeyRef.current === key) return
      overlayCollisionResolveKeyRef.current = key
      if (overlayCollisionIterKeyRef.current !== key) {
        overlayCollisionIterKeyRef.current = key
        overlayCollisionIterCountRef.current = 0
      }

      const schemaCur = schema
      const panelScale = computeWidgetScale(zoomK, null, { mode: 'floating' })
      const floatingScaled = computeWidgetScaledSize(panelScale)

      const pinnedById = st.flowWidgetPinnedByNodeId || {}
      const posById = st.flowWidgetPosByNodeId || {}

      const forcePinnedToCanvas = true
      const isPinnedInCanvas = (id: string): boolean => {
        if (forcePinnedToCanvas) return false
        const v = pinnedById[id]
        return typeof v === 'boolean' ? v : false
      }

      const rectByNodeId = (() => {
        const canvasOffset = canvasWindowOffsetRef.current
        const m = new Map<string, { left: number; top: number; width: number; height: number }>()
        for (let i = 0; i < overlayEls.length; i += 1) {
          const el = overlayEls[i]
          const id = String(el.dataset.kgWidget || '').trim()
          if (!id) continue
          const rect = el.getBoundingClientRect()
          const width = Number.isFinite(rect.width) ? rect.width : 0
          const height = Number.isFinite(rect.height) ? rect.height : 0
          const leftRaw = Number.isFinite(rect.left) ? rect.left : 0
          const topRaw = Number.isFinite(rect.top) ? rect.top : 0
          const left = leftRaw - (Number.isFinite(canvasOffset.left) ? canvasOffset.left : 0)
          const top = topRaw - (Number.isFinite(canvasOffset.top) ? canvasOffset.top : 0)
          if (width > 0 && height > 0) {
            const resolved = { left, top, width, height }
            overlayRectCacheRef.current.set(id, resolved)
            m.set(id, resolved)
            continue
          }
          const cached = overlayRectCacheRef.current.get(id) || null
          if (cached) {
            m.set(id, cached)
            continue
          }
          if (Number.isFinite(left) && Number.isFinite(top)) {
            m.set(id, { left, top, width: floatingScaled.width, height: floatingScaled.height })
          }
        }
        return m
      })()

      const typicalSize = (() => {
        let sumW = 0
        let sumH = 0
        let count = 0
        for (let i = 0; i < overlayNodeIds.length; i += 1) {
          const id = overlayNodeIds[i]
          const r = id ? rectByNodeId.get(id) : null
          if (!r) continue
          if (!(r.width > 0 && r.height > 0)) continue
          sumW += r.width
          sumH += r.height
          count += 1
        }
        if (count > 0) {
          const w = sumW / count
          const h = sumH / count
          return {
            width: Math.max(120, Math.min(floatingScaled.width, w)),
            height: Math.max(160, Math.min(floatingScaled.height, h)),
          }
        }
        return floatingScaled
      })()

      const gapPx = (() => {
        const flow = schemaCur?.layout?.flow
        const overlay = flow && typeof flow === 'object' ? (flow as { overlay?: { collisionGapPx?: unknown } }).overlay : null
        const raw = overlay ? overlay.collisionGapPx : null
        const base = typeof raw === 'number' && Number.isFinite(raw) ? raw : 12
        const widgetGrid = readWidgetGridLayoutSettings(schemaCur)
        const merged = widgetGrid.gridEnabled ? Math.max(base, widgetGrid.gapPx) : base
        return Math.max(0, Math.min(80, Math.floor(merged)))
      })()
      const widgetGrid = readWidgetGridLayoutSettings(schemaCur)
      const snapStepPx = widgetGrid.gridEnabled ? Math.max(1, widgetGrid.stepPx) : 1
      const snapScreen = (v: number): number => (snapStepPx > 1 ? snapToGridPx(v, snapStepPx) : v)

      const unpinnedCount = overlayNodeIds.reduce((acc, id) => {
        if (!id) return acc
        const locked = isPinnedInCanvas(id)
        return locked ? acc : acc + 1
      }, 0)

      const cellSize = {
        width: Math.max(1, snapScreen(typicalSize.width + gapPx)),
        height: Math.max(1, snapScreen(Math.round(typicalSize.height * 0.76) + gapPx)),
      }

      const marginLeft = isFrontmatterFlow ? Math.max(20, Math.floor(overlayViewport.width * 0.1)) : 20
      const marginRight = isFrontmatterFlow ? Math.max(20, Math.floor(overlayViewport.width * 0.1)) : 20
      const marginTop = isFrontmatterFlow ? Math.max(64, Math.floor(overlayViewport.height * 0.1)) : 96
      const marginBottom = isFrontmatterFlow ? Math.max(24, Math.floor(overlayViewport.height * 0.1)) : 24
      const usableW = Math.max(1, overlayViewport.width - marginLeft - marginRight)
      const usableH = Math.max(1, overlayViewport.height - marginTop - marginBottom)

      const rowsMaxFit = Math.max(1, Math.floor(usableH / Math.max(1, cellSize.height)))
      const colsMaxFit = Math.max(1, Math.floor(usableW / Math.max(1, cellSize.width)))
      let rowsMax = rowsMaxFit
      let dockCols = Math.max(1, Math.min(Math.max(1, Math.ceil(Math.max(1, unpinnedCount) / rowsMaxFit)), colsMaxFit))
      let dockWidth = dockCols * cellSize.width - gapPx
      let dockLeft = Math.max(marginLeft, overlayViewport.width - marginRight - dockWidth)
      let dockTop = marginTop

      if (isFrontmatterFlow || widgetGrid.gridEnabled) {
        const aspect = usableW / Math.max(1, usableH)
        let cols = Math.max(1, Math.min(colsMaxFit, Math.ceil(Math.sqrt(Math.max(1, unpinnedCount) * aspect))))
        let rows = Math.max(1, Math.ceil(Math.max(1, unpinnedCount) / cols))
        if (rows > rowsMaxFit) {
          cols = Math.max(1, Math.min(colsMaxFit, Math.ceil(Math.max(1, unpinnedCount) / rowsMaxFit)))
          rows = Math.max(1, Math.ceil(Math.max(1, unpinnedCount) / cols))
        }
        const usedW = cols * cellSize.width - gapPx
        const usedH = rows * cellSize.height - gapPx
        dockCols = cols
        rowsMax = rows
        dockWidth = usedW
        dockLeft = marginLeft + Math.max(0, Math.floor((usableW - usedW) / 2))
        dockTop = marginTop + Math.max(0, Math.floor((usableH - usedH) / 2))
      }

      const pinnedObstacles: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
      const items: Array<{ id: string; top: number; left: number; movable: boolean; width?: number; height?: number; pinnedInCanvas: boolean }> = []
      let stack = 0
      for (let i = 0; i < overlayNodeIds.length; i += 1) {
        const id = String(overlayNodeIds[i] || '').trim()
        if (!id) continue
        const pinnedInCanvas = isPinnedInCanvas(id)
        const rect = rectByNodeId.get(id) || null

        if (pinnedInCanvas) {
          if (!rect) continue
          pinnedObstacles.push({ id, left: rect.left, top: rect.top, width: rect.width, height: rect.height })
          continue
        }

        const stored = posById[id]
        const hasStored = Boolean(stored && Number.isFinite(stored.top) && Number.isFinite(stored.left))

        const rawCol = Math.floor(stack / rowsMax)
        const col = Math.min(rawCol, dockCols - 1)
        const row = rawCol < dockCols ? stack % rowsMax : stack - (dockCols - 1) * rowsMax
        stack += 1

        const fallback = { left: dockLeft + col * cellSize.width, top: dockTop + row * cellSize.height }
        const base = (() => {
          if (!hasStored) return fallback
          const left = (stored as { top: number; left: number }).left
          const top = (stored as { top: number; left: number }).top
          const okX = isFrontmatterFlow
            ? left >= -12 && left <= overlayViewport.width - 12
            : left >= marginLeft - 12 && left <= overlayViewport.width - marginRight - 12
          const okY = isFrontmatterFlow
            ? top >= -12 && top <= overlayViewport.height - 12
            : top >= marginTop - 12 && top <= overlayViewport.height - marginBottom - 12
          return okX && okY ? (stored as { top: number; left: number }) : fallback
        })()
        const snappedBase = snapStepPx > 1 ? { left: snapScreen(base.left), top: snapScreen(base.top) } : base
        const clamped = clampOverlayTopLeftFullyInViewport({
          pos: snappedBase,
          size: rect ? { width: rect.width, height: rect.height } : floatingScaled,
          viewport: { width: overlayViewport.width, height: overlayViewport.height },
          snapPx: 1,
        })
        items.push({
          id,
          top: clamped.top,
          left: clamped.left,
          movable: !hasStored,
          width: rect?.width,
          height: rect?.height,
          pinnedInCanvas: false,
        })
      }

      if (items.length === 0) return

      const pickLockedId = (candidates: Array<{ id: string }>) => {
        const sel = String(selectedNodeId || '').trim()
        if (sel && candidates.some(it => it.id === sel)) return sel
        if (overlayOnlyModeEnabled) return [...candidates].map(it => it.id).sort((a, b) => a.localeCompare(b))[0] || ''
        return candidates[0]?.id || ''
      }

      const shouldResolveItems = (
      candidates: Array<{ id: string; left: number; top: number; width?: number; height?: number }>,
      gapPx: number,
      ) => {
      for (let i = 0; i < candidates.length; i += 1) {
        const a = candidates[i]
        if (!a) continue
        const aw = a.width ?? floatingScaled.width
        const ah = a.height ?? floatingScaled.height
        for (let j = i + 1; j < candidates.length; j += 1) {
          const b = candidates[j]
          if (!b) continue
          const bw = b.width ?? floatingScaled.width
          const bh = b.height ?? floatingScaled.height
          const ax2 = a.left + aw + gapPx
          const ay2 = a.top + ah + gapPx
          const bx2 = b.left + bw + gapPx
          const by2 = b.top + bh + gapPx
          const overlapX = a.left < bx2 && b.left < ax2
          const overlapY = a.top < by2 && b.top < ay2
          if (overlapX && overlapY) return true
        }
      }
      return false
      }

      const shouldResolveItemsAgainstObstacles = (
        candidates: Array<{ id: string; left: number; top: number; width?: number; height?: number }>,
        obstacles: Array<{ id: string; left: number; top: number; width: number; height: number }>,
        gapPx: number,
      ) => {
        for (let i = 0; i < candidates.length; i += 1) {
          const a = candidates[i]
          if (!a) continue
          const aw = a.width ?? floatingScaled.width
          const ah = a.height ?? floatingScaled.height
          const ax2 = a.left + aw + gapPx
          const ay2 = a.top + ah + gapPx
          for (let j = 0; j < obstacles.length; j += 1) {
            const b = obstacles[j]
            if (!b) continue
            const bx2 = b.left + b.width + gapPx
            const by2 = b.top + b.height + gapPx
            const overlapX = a.left < bx2 && b.left < ax2
            const overlapY = a.top < by2 && b.top < ay2
            if (overlapX && overlapY) return true
          }
        }
        return false
      }

      const next = { ...posById }

      const fixedId = pickLockedId(items)

      const seedGridAroundFixed = (
        worldIn: Array<{ id: string; left: number; top: number; width: number; height: number; movable: boolean }>,
      ) => {
        const availW = Math.max(1, dockWidth)
        const availH = Math.max(1, viewportH - dockTop - marginBottom)
        const cols = Math.max(1, Math.min(dockCols, Math.floor(availW / Math.max(1, cellSize.width))))
        const marginLeft = dockLeft
        const marginTop = dockTop

        const rows = Math.max(1, Math.ceil(Math.max(worldIn.length, 1) / cols))
        const maxRows = Math.max(rows, Math.ceil(availH / Math.max(1, cellSize.height)))

        const fixed = worldIn.find(it => it.id === fixedId) || worldIn[0]
        const fixedLeft = fixed ? fixed.left : marginLeft
        const fixedTop = fixed ? fixed.top : marginTop
        const fixedCol = Math.max(0, Math.min(cols - 1, Math.round((fixedLeft - marginLeft) / cellSize.width)))
        const fixedRow = Math.max(0, Math.min(maxRows - 1, Math.round((fixedTop - marginTop) / cellSize.height)))
        const fixedIdx = fixedRow * cols + fixedCol

        const cellCount = Math.max(worldIn.length + 8, cols * maxRows)
        const cells: Array<{ idx: number; row: number; col: number; left: number; top: number }> = []
        for (let idx = 0; idx < cellCount; idx += 1) {
          const row = Math.floor(idx / cols)
          const col = idx % cols
          cells.push({ idx, row, col, left: marginLeft + col * cellSize.width, top: marginTop + row * cellSize.height })
        }

        const sortedCells = [...cells].sort((a, b) => {
          const da = Math.abs(a.row - fixedRow) + Math.abs(a.col - fixedCol)
          const db = Math.abs(b.row - fixedRow) + Math.abs(b.col - fixedCol)
          if (da !== db) return da - db
          if (a.row !== b.row) return a.row - b.row
          return a.col - b.col
        })

        const used = new Set<number>()
        const out: typeof worldIn = []
        const byId = new Map(worldIn.map(it => [it.id, it]))
        const fixedCell = cells[Math.max(0, Math.min(cells.length - 1, fixedIdx))]
        if (fixedCell) used.add(fixedCell.idx)

        const pickNextCell = () => {
          for (let i = 0; i < sortedCells.length; i += 1) {
            const c = sortedCells[i]
            if (!c) continue
            if (used.has(c.idx)) continue
            used.add(c.idx)
            return c
          }
          const idx = used.size
          const row = Math.floor(idx / cols)
          const col = idx % cols
          const c = { idx, row, col, left: marginLeft + col * cellSize.width, top: marginTop + row * cellSize.height }
          used.add(idx)
          return c
        }

        const orderedIds = [...byId.keys()].sort((a, b) => a.localeCompare(b))
        for (let i = 0; i < orderedIds.length; i += 1) {
          const id = orderedIds[i]
          const it = byId.get(id)
          if (!it) continue
          if (id === fixedId) {
            out.push(it)
            continue
          }
          const cell = pickNextCell()
          out.push({ ...it, left: cell.left, top: cell.top })
        }
        return out
      }

      const toWorld = (base: typeof items) => {
        return base.map(it => ({
          id: it.id,
          left: it.left,
          top: it.top,
          width: it.width ?? floatingScaled.width,
          height: it.height ?? floatingScaled.height,
          movable: it.id !== fixedId,
        }))
      }

      const clampWorld = (world: Array<{ id: string; left: number; top: number; width: number; height: number; movable: boolean }>) => {
        const out: Array<{ id: string; left: number; top: number; width: number; height: number; movable: boolean }> = []
        for (let i = 0; i < world.length; i += 1) {
          const it = world[i]
          const clamped0 = clampOverlayTopLeftFullyInViewport({
            pos: { top: it.top, left: it.left },
            size: { width: it.width, height: it.height },
            viewport: { width: overlayViewport.width, height: overlayViewport.height },
            snapPx: 1,
          })
          const snapped = snapStepPx > 1 ? { left: snapScreen(clamped0.left), top: snapScreen(clamped0.top) } : clamped0
          const clamped = snapStepPx > 1
            ? clampOverlayTopLeftFullyInViewport({
                pos: snapped,
                size: { width: it.width, height: it.height },
                viewport: { width: overlayViewport.width, height: overlayViewport.height },
                snapPx: 1,
              })
            : clamped0
          out.push({ ...it, left: clamped.left, top: clamped.top })
        }
        return out
      }

      let world = clampWorld(toWorld(items))
      const nodeObstacles = (() => {
        if (!schemaCur) return []
        const graph = draftGraphDataRef.current
        const rawNodes = Array.isArray(graph?.nodes) ? (graph.nodes as Array<{ id?: unknown; x?: unknown; y?: unknown }>) : []
        if (rawNodes.length === 0) return []
        const t =
          getLiveZoomTransform() ||
          getZoomStateForKey({ zoomViewKey: zoomViewKeyRef.current, zoomStateByKey: st.zoomStateByKey }) ||
          null
        const k = typeof t?.k === 'number' && Number.isFinite(t.k) ? t.k : 1
        const knobs = readFlowLayoutKnobs({ schema: schemaCur, rankdir: frontmatterFlowRenderSettings?.rankdir || 'TB' })
        const handleExtra = schemaCur.behavior?.portHandles?.enabled === true ? Math.max(0, knobs.handle.sizePx) : 0
        const nodeW = Math.max(1, Math.floor(knobs.node.widthPx + handleExtra * 2))
        const nodeH = Math.max(1, Math.floor(knobs.node.heightPx + handleExtra * 2))
        const out: Array<{ id: string; left: number; top: number; width: number; height: number }> = []
        for (let i = 0; i < rawNodes.length; i += 1) {
          const n = rawNodes[i]
          const id = String(n?.id || '').trim()
          if (!id) continue
          const live = getLiveNodeWorldPos(id)
          const x = live && typeof live.x === 'number' && Number.isFinite(live.x)
            ? live.x
            : (typeof n?.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : null)
          const y = live && typeof live.y === 'number' && Number.isFinite(live.y)
            ? live.y
            : (typeof n?.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : null)
          if (x == null || y == null) continue
          const s = worldToScreen({ transform: t, x, y })
          out.push({ id, left: s.sx, top: s.sy, width: nodeW * k, height: nodeH * k })
        }
        return out
      })()
      const obstacles = [...nodeObstacles, ...pinnedObstacles]
      const wantsResolve = shouldResolveItems(world, gapPx) || shouldResolveItemsAgainstObstacles(world, obstacles, gapPx)
      if (wantsResolve) {
        if (shouldResolveItems(world, gapPx)) {
          world = clampWorld(seedGridAroundFixed(world))
        }
        const resolved = schemaCur
          ? relaxOverlayPanelsWithCollision({
              schema: schemaCur,
              items: world,
              obstacles,
              gapPx,
              strength: 0.85,
              iterations: 12,
              steps: 14,
              anchorStrength: 0.08,
              maxAnchorShiftPx: computeWidgetMaxAnchorShiftPx(overlayViewport.width, overlayViewport.height),
              maxSpeedPxPerStep: 180,
            })
          : world.map(r => ({ id: r.id, left: r.left, top: r.top }))
        world = clampWorld(world.map(it => {
          const r = resolved.find(x => x.id === it.id)
          return r ? { ...it, left: r.left, top: r.top } : it
        }))

        if (shouldResolveItems(world, gapPx) || shouldResolveItemsAgainstObstacles(world, obstacles, gapPx)) {
          const pass2 = schemaCur
            ? relaxOverlayPanelsWithCollision({
                schema: schemaCur,
                items: world,
                obstacles,
                gapPx,
                strength: 0.78,
                iterations: 10,
                steps: 12,
                anchorStrength: 0.08,
                maxAnchorShiftPx: computeWidgetMaxAnchorShiftPx(overlayViewport.width, overlayViewport.height),
                maxSpeedPxPerStep: 180,
              })
            : world.map(r => ({ id: r.id, left: r.left, top: r.top }))
          world = clampWorld(world.map(it => {
            const r = pass2.find(x => x.id === it.id)
            return r ? { ...it, left: r.left, top: r.top } : it
          }))
        }
      }
      const finalById = new Map(world.map(it => [it.id, { left: it.left, top: it.top }]))
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        const p = finalById.get(item.id)
        if (!p) continue
        next[item.id] = { top: p.top, left: p.left }
      }

      let changed = false
      for (const it of items) {
        const prev = posById[it.id]
        const cur = next[it.id]
        if (!cur) continue
        if (!prev) {
          changed = true
          break
        }
        if (Math.abs(prev.top - cur.top) > 0.5 || Math.abs(prev.left - cur.left) > 0.5) {
          changed = true
          break
        }
      }
      if (!changed) return
      st.setFlowWidgetPosByNodeId(next)

      const stillOverlaps =
        shouldResolveItems(world.map(it => ({ id: it.id, left: it.left, top: it.top, width: it.width, height: it.height })), gapPx)
        || shouldResolveItemsAgainstObstacles(world.map(it => ({ id: it.id, left: it.left, top: it.top, width: it.width, height: it.height })), obstacles, gapPx)
      if (stillOverlaps) {
        overlayCollisionIterCountRef.current += 1
        if (overlayCollisionIterCountRef.current <= 10) {
          overlayCollisionResolveKeyRef.current = ''
          scheduleOverlayCollisionResolve()
        }
      }
    })
  }, [
    editorRuntimeActive,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    overlayOnlyModeEnabled,
    renderGraphDataOverride?.metadata,
    renderGraphDataOverride?.nodes,
    schema,
    selectedNodeId,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    if (!editorRuntimeActive) return
    scheduleOverlayCollisionResolve()
  }, [editorRuntimeActive, openWidgetNodeIds, overlayOnlyModeEnabled, scheduleOverlayCollisionResolve, viewportH, viewportW])

  React.useEffect(() => {
    return () => {
      if (overlayCollisionResolveRafRef.current != null) {
        try {
          cancelAnimationFrame(overlayCollisionResolveRafRef.current)
        } catch {
          void 0
        }
        overlayCollisionResolveRafRef.current = null
      }
    }
  }, [])

  const overlayEdgesSvgRef = React.useRef<SVGSVGElement | null>(null)
  const overlayEdgePathByIdRef = React.useRef<Map<string, SVGPathElement>>(new Map())
  const overlayPendingEdgePathRef = React.useRef<SVGPathElement | null>(null)
  const overlayEdgeRafRef = React.useRef<number | null>(null)
  const overlayElByNodeIdRef = React.useRef<Map<string, HTMLElement>>(new Map())
  const overlayEdgeSocketTypesRef = React.useRef<unknown>(null)
  const overlayEdgeSocketStyleByTypeRef = React.useRef<Map<string, { color: string; edgeWidthPx: number | null }>>(new Map())
  const overlayEdgeLayoutSigRef = React.useRef<string>('')
  const overlayEdgeAnchorCacheRef = React.useRef<Map<string, { x: number; y: number }>>(new Map())
  const overlayEdgeTopPctCacheRef = React.useRef<{
    key: string
    registry: ReadonlyArray<WidgetRegistryEntry> | null
    map: Map<string, Map<string, number>>
  } | null>(null)

  const pendingEdgePreviewRef = React.useRef<{ toolMode: ToolMode; sourceId: string | null; sourcePortKey: string | null }>({
    toolMode: 'select',
    sourceId: null,
    sourcePortKey: null,
  })
  const pendingEdgeCursorRef = React.useRef<null | { x: number; y: number; ts: number }>(null)

  React.useEffect(() => {
    pendingEdgePreviewRef.current = {
      toolMode,
      sourceId: pendingEdgeSourceId ? String(pendingEdgeSourceId || '').trim() : null,
      sourcePortKey: pendingEdgeSourcePortKey ? String(pendingEdgeSourcePortKey || '').trim() : null,
    }
  }, [pendingEdgeSourceId, pendingEdgeSourcePortKey, toolMode])

  const scheduleOverlayEdgeUpdate = React.useCallback(() => {
    if (!active) return
    if (!overlayOnlyModeEnabled) return
    if (overlayEdgeRafRef.current != null) return
    overlayEdgeRafRef.current = requestAnimationFrame(() => {
      overlayEdgeRafRef.current = null
      const root = rootRef.current
      if (!root) return
      const svg = overlayEdgesSvgRef.current
      if (!svg) return
      const graph = draftGraphDataRef.current
      if (!graph) {
        for (const el of overlayEdgePathByIdRef.current.values()) {
          try {
            el.remove()
          } catch {
            void 0
          }
        }
        overlayEdgePathByIdRef.current.clear()
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        if (overlayPendingEdgePathRef.current) {
          try {
            overlayPendingEdgePathRef.current.remove()
          } catch {
            void 0
          }
          overlayPendingEdgePathRef.current = null
        }
        return
      }

      const rawNodes = Array.isArray(graph.nodes) ? (graph.nodes as Array<{ id?: unknown; type?: unknown; properties?: unknown }>) : []
      const rawEdges = Array.isArray(graph.edges)
        ? (graph.edges as Array<{ id?: unknown; source?: unknown; target?: unknown; type?: unknown; properties?: unknown }>)
        : []

      const socketStyleByType = (() => {
        const meta = (graph.metadata || {}) as Record<string, unknown>
        const st = meta.socketTypes
        if (st === overlayEdgeSocketTypesRef.current) return overlayEdgeSocketStyleByTypeRef.current
        overlayEdgeSocketTypesRef.current = st
        const next = new Map<string, { color: string; edgeWidthPx: number | null }>()
        if (!isRecord(st)) {
          overlayEdgeSocketStyleByTypeRef.current = next
          return next
        }
        for (const k of Object.keys(st)) {
          const spec = st[k]
          if (!isRecord(spec)) continue
          const color = pickString(spec.color)
          if (!color) continue
          const edgeWidthPx = typeof spec.edgeWidthPx === 'number' && Number.isFinite(spec.edgeWidthPx) ? spec.edgeWidthPx : null
          next.set(String(k || ''), { color, edgeWidthPx })
        }
        overlayEdgeSocketStyleByTypeRef.current = next
        return next
      })()

      const overlayIdSet = (() => {
        const ids = Array.isArray(openWidgetNodeIdsRef.current) ? openWidgetNodeIdsRef.current : []
        const sel = String(pendingOverlayNodeIdRef.current || '').trim()
        const set = new Set<string>()
        for (let i = 0; i < ids.length; i += 1) {
          const id = String(ids[i] || '').trim()
          if (id) set.add(id)
        }
        if (sel) set.add(sel)
        return set
      })()
      if (overlayIdSet.size === 0) {
        for (const el of overlayEdgePathByIdRef.current.values()) {
          try {
            el.remove()
          } catch {
            void 0
          }
        }
        overlayEdgePathByIdRef.current.clear()
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        return
      }

      const nodeIds = new Set<string>()
      const nodes: Array<{ id: unknown; type?: unknown; properties?: unknown }> = []
      for (let i = 0; i < rawNodes.length; i += 1) {
        const id = String(rawNodes[i]?.id || '').trim()
        if (!id || !overlayIdSet.has(id)) continue
        nodeIds.add(id)
        nodes.push({ id, type: rawNodes[i]?.type, properties: rawNodes[i]?.properties })
      }

      const firstSchemaPortKeyByNodeId = (() => {
        const m = new Map<string, string>()
        for (let i = 0; i < nodes.length; i += 1) {
          const id = String(nodes[i]?.id || '').trim()
          if (!id) continue
          const fields = readSchemaFieldSpecs({ properties: nodes[i]?.properties as never }).map(f => f.id).filter(Boolean)
          const first = fields[0]
          if (!first) continue
          m.set(id, buildSchemaFieldPortKey(first))
        }
        return m
      })()

      const readPropString = (props: unknown, key: string): string => {
        if (!props || typeof props !== 'object' || Array.isArray(props)) return ''
        const raw = (props as Record<string, unknown>)[key]
        return typeof raw === 'string' ? raw.trim() : ''
      }
      const endpointNodeId = (raw: unknown): string => {
        if (!raw) return ''
        if (typeof raw === 'string') {
          const s = raw.trim()
          if (!s) return ''
          const dot = s.indexOf('.')
          return dot > 0 ? s.slice(0, dot).trim() : s
        }
        if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : ''
        if (typeof raw === 'object' && !Array.isArray(raw) && 'id' in (raw as Record<string, unknown>)) {
          const idRaw = (raw as Record<string, unknown>).id
          const id = typeof idRaw === 'string' ? idRaw.trim() : typeof idRaw === 'number' && Number.isFinite(idRaw) ? String(idRaw) : ''
          if (!id) return ''
          const dot = id.indexOf('.')
          return dot > 0 ? id.slice(0, dot).trim() : id
        }
        return ''
      }

      const edges: Array<{
        id: string
        source: string
        target: string
        sourcePortKey: string
        targetPortKey: string
        stroke: string
        strokeWidth: string
      }> = []
      for (let i = 0; i < rawEdges.length; i += 1) {
        const id = String(rawEdges[i]?.id || '').trim()
        const source = endpointNodeId(rawEdges[i]?.source)
        const target = endpointNodeId(rawEdges[i]?.target)
        if (!id || !source || !target) continue
        if (!overlayIdSet.has(source) || !overlayIdSet.has(target)) continue
        const props = rawEdges[i]?.properties
        const sourcePortKeyRaw = readPropString(props, FLOW_EDGE_SOURCE_PORT_KEY)
        const targetPortKeyRaw = readPropString(props, FLOW_EDGE_TARGET_PORT_KEY)
        const sourcePortKey = sourcePortKeyRaw || firstSchemaPortKeyByNodeId.get(source) || id
        const targetPortKey = targetPortKeyRaw || firstSchemaPortKeyByNodeId.get(target) || id
        const edgeTypeFromEdge = pickString(rawEdges[i]?.type)
        const edgeTypeFromProps = readPropString(props, 'flow:socketType')
        const edgeSocketType = edgeTypeFromEdge || edgeTypeFromProps
        const style = edgeSocketType ? socketStyleByType.get(edgeSocketType) || null : null
        const stroke = style?.color || 'currentColor'
        const strokeWidth = style?.edgeWidthPx != null ? String(style.edgeWidthPx) : '1.5'
        edges.push({ id, source, target, sourcePortKey, targetPortKey, stroke, strokeWidth })
      }

      if (nodeIds.size === 0 || edges.length === 0) {
        for (const el of overlayEdgePathByIdRef.current.values()) {
          try {
            el.remove()
          } catch {
            void 0
          }
        }
        overlayEdgePathByIdRef.current.clear()
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        return
      }

      const overlayRectsByNodeId = (() => {
        if (typeof document === 'undefined') return new Map<string, DOMRect>()
        const m = new Map<string, DOMRect>()
        const elById = new Map<string, HTMLElement>()
        const els = Array.from(document.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
        for (let i = 0; i < els.length; i += 1) {
          const el = els[i]
          const id = String(el?.dataset?.kgWidget || '').trim()
          if (!id || !nodeIds.has(id)) continue
          m.set(id, el.getBoundingClientRect())
          elById.set(id, el)
        }
        overlayElByNodeIdRef.current = elById
        return m
      })()

      if (overlayRectsByNodeId.size === 0) {
        for (const el of overlayEdgePathByIdRef.current.values()) {
          try {
            el.remove()
          } catch {
            void 0
          }
        }
        overlayEdgePathByIdRef.current.clear()
        overlayEdgeLayoutSigRef.current = ''
        overlayEdgeAnchorCacheRef.current.clear()
        return
      }

      const topPctByNodeAndHandle = (() => {
        const overlayNodeIds = nodes.map(n => String(n.id || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
        const overlayEdgeKeyParts: string[] = []
        for (let i = 0; i < edges.length; i += 1) {
          const e = edges[i]
          overlayEdgeKeyParts.push(`${e.id}:${e.source}->${e.target}:${e.sourcePortKey}|${e.targetPortKey}`)
        }
        overlayEdgeKeyParts.sort((a, b) => a.localeCompare(b))
        const reg = Array.isArray(widgetRegistryRef.current) ? (widgetRegistryRef.current as ReadonlyArray<WidgetRegistryEntry>) : null
        const cacheKey = `${overlayNodeIds.join(',')}|${overlayEdgeKeyParts.join(',')}`
        const cached = overlayEdgeTopPctCacheRef.current
        if (cached && cached.key === cacheKey && cached.registry === reg) return cached.map

        const handlesByNodeId = computeFlowHandlesByNode({
          nodes,
          edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, properties: { [FLOW_EDGE_SOURCE_PORT_KEY]: e.sourcePortKey, [FLOW_EDGE_TARGET_PORT_KEY]: e.targetPortKey } })),
          widgetRegistry: reg,
        })
        const map = new Map<string, Map<string, number>>()
        for (const [id, handles] of Object.entries(handlesByNodeId)) {
          const hm = new Map<string, number>()
          for (let i = 0; i < (handles.in || []).length; i += 1) hm.set(handles.in[i].id, handles.in[i].topPct)
          for (let i = 0; i < (handles.out || []).length; i += 1) hm.set(handles.out[i].id, handles.out[i].topPct)
          map.set(id, hm)
        }
        overlayEdgeTopPctCacheRef.current = { key: cacheKey, registry: reg, map }
        return map
      })()

      const rootRect = root.getBoundingClientRect()
      const baseLeft = Number.isFinite(rootRect.left) ? rootRect.left : null
      const baseTop = Number.isFinite(rootRect.top) ? rootRect.top : null
      if (baseLeft == null || baseTop == null) return
      const round2 = (value: number): number => Math.round(value * 100) / 100
      const globalEdgeType = readGlobalEdgeType(schema)
      const layoutSig = (() => {
        const nodeIdsSorted = Array.from(overlayRectsByNodeId.keys()).sort((a, b) => a.localeCompare(b))
        const nodeParts: string[] = []
        for (let i = 0; i < nodeIdsSorted.length; i += 1) {
          const nodeId = nodeIdsSorted[i]
          const rect = overlayRectsByNodeId.get(nodeId)
          if (!rect) continue
          const overlayEl = overlayElByNodeIdRef.current.get(nodeId) || null
          const scrollTop = overlayEl && Number.isFinite(overlayEl.scrollTop) ? round2(overlayEl.scrollTop) : 0
          const scrollLeft = overlayEl && Number.isFinite(overlayEl.scrollLeft) ? round2(overlayEl.scrollLeft) : 0
          nodeParts.push(
            `${nodeId}:${round2(rect.left)}:${round2(rect.top)}:${round2(rect.width)}:${round2(rect.height)}:${scrollLeft}:${scrollTop}`,
          )
        }
        const edgeParts = edges
          .map(e => {
            const stroke = getEdgeBaseStroke(e as GraphEdge, schema)
            const strokeWidth = getEdgeStrokeWidth(e as GraphEdge, schema)
            return `${e.id}:${e.source}->${e.target}:${e.sourcePortKey}|${e.targetPortKey}:${stroke}:${strokeWidth}`
          })
          .sort((a, b) => a.localeCompare(b))
        const pending = pendingEdgePreviewRef.current
        const cursor = pendingEdgeCursorRef.current
        const pendingSig =
          pending.toolMode === 'addEdge' && pending.sourceId && cursor
            ? `${pending.toolMode}:${pending.sourceId}:${String(pending.sourcePortKey || '')}:${round2(cursor.x)}:${round2(cursor.y)}`
            : ''
        return `${round2(rootRect.left)}:${round2(rootRect.top)}:${round2(rootRect.width)}:${round2(rootRect.height)}|${nodeParts.join(',')}|${edgeParts.join(',')}|${pendingSig}`
      })()
      if (overlayEdgeLayoutSigRef.current === layoutSig) return
      overlayEdgeLayoutSigRef.current = layoutSig
      const keep = new Set<string>()

      const overlayElByNodeId = overlayElByNodeIdRef.current
      const esc = (s: string) => {
        const v = String(s || '')
        const c = (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS
        if (c?.escape) return c.escape(v)
        return v.replace(/[^a-zA-Z0-9_\-]/g, ch => `\\${ch}`)
      }
      const readAnchor = (args: {
        nodeId: string
        dir: 'in' | 'out'
        portKey: string
        fallbackRect: DOMRect
        fallbackPct: number
      }): { x: number; y: number } | null => {
        const el = overlayElByNodeId.get(args.nodeId)
        const portKey = String(args.portKey || '').trim()
        const anchorCacheKey = `${args.nodeId}|${args.dir}|${portKey}`
        if (el && portKey) {
          const baseSel = `[data-kg-port-handle="1"][data-kg-port-dir="${args.dir}"][data-kg-port-key="${esc(portKey)}"]`
          const dotBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="dot"]`) as HTMLElement | null
          const railBtn = el.querySelector(`button${baseSel}[data-kg-port-handle-kind="rail"]`) as HTMLElement | null
          const fallbackBtn = el.querySelector(`button${baseSel}`) as HTMLElement | null
          const resolveFromButton = (btn: HTMLElement | null): { x: number; y: number } | null => {
            if (!btn) return null
            const dotEl = btn.querySelector('span') as HTMLElement | null
            const r = dotEl ? dotEl.getBoundingClientRect() : btn.getBoundingClientRect()
            const x = Number.isFinite(r.left) && Number.isFinite(r.width)
              ? r.left + r.width / 2
              : args.dir === 'out'
                ? r.right
                : r.left
            const y = r.top + r.height / 2
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null
            return { x, y }
          }
          const panelRect = el.getBoundingClientRect()
          const dotAnchor = resolveFromButton(dotBtn)
          const dotVisible = !!(
            dotAnchor
            && Number.isFinite(panelRect.top)
            && Number.isFinite(panelRect.bottom)
            && dotAnchor.y >= panelRect.top
            && dotAnchor.y <= panelRect.bottom
          )
          const railAnchor = resolveFromButton(railBtn)
          const fallbackAnchor = resolveFromButton(fallbackBtn)
          const nextAnchor = (dotVisible ? dotAnchor : null) || railAnchor || dotAnchor || fallbackAnchor
          if (nextAnchor) {
            const clampedY = Number.isFinite(args.fallbackRect.top) && Number.isFinite(args.fallbackRect.height) && args.fallbackRect.height > 0
              ? Math.max(args.fallbackRect.top, Math.min(args.fallbackRect.top + args.fallbackRect.height, nextAnchor.y))
              : nextAnchor.y
            const resolved = { x: nextAnchor.x, y: clampedY }
            if (Number.isFinite(resolved.x) && Number.isFinite(resolved.y)) {
              overlayEdgeAnchorCacheRef.current.set(anchorCacheKey, resolved)
              return resolved
            }
          }
        }
        const cached = overlayEdgeAnchorCacheRef.current.get(anchorCacheKey)
        if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) return cached
        const rect = args.fallbackRect
        const top = Number.isFinite(rect.top) ? rect.top : null
        const left = Number.isFinite(rect.left) ? rect.left : null
        const right = Number.isFinite(rect.right) ? rect.right : null
        const height = Number.isFinite(rect.height) ? rect.height : null
        if (top == null || left == null || right == null || height == null || height <= 0) return null
        const pct = Math.max(0, Math.min(100, args.fallbackPct)) / 100
        return {
          x: args.dir === 'out' ? right : left,
          y: top + pct * height,
        }
      }

      {
        const pending = pendingEdgePreviewRef.current
        const cursor = pendingEdgeCursorRef.current
        const wants = pending.toolMode === 'addEdge' && !!pending.sourceId && !!cursor && Date.now() - cursor.ts < 4_000
        if (!wants) {
          const prev = overlayPendingEdgePathRef.current
          if (prev) {
            try {
              prev.remove()
            } catch {
              void 0
            }
            overlayPendingEdgePathRef.current = null
          }
        } else {
          const sourceId = String(pending.sourceId || '').trim()
          const sRect = sourceId ? overlayRectsByNodeId.get(sourceId) : null
          const sTop = sRect && Number.isFinite(sRect.top) ? sRect.top : null
          const sRight = sRect && Number.isFinite(sRect.right) ? sRect.right : null
          const sHeight = sRect && Number.isFinite(sRect.height) ? sRect.height : null
          if (sTop != null && sRight != null && sHeight != null && sHeight > 0 && cursor) {
            const handleKey = String(pending.sourcePortKey || firstSchemaPortKeyByNodeId.get(sourceId) || '__flow_default_handle__').trim()
            const outHandleId = buildFlowHandleId({ dir: 'out', edgeId: handleKey })
            const sPct = topPctByNodeAndHandle.get(sourceId)?.get(outHandleId) ?? 50
            const a = readAnchor({ nodeId: sourceId, dir: 'out', portKey: handleKey, fallbackRect: sRect as never, fallbackPct: sPct })
            const sx = a ? a.x - baseLeft : sRight - baseLeft
            const sy = a ? a.y - baseTop : sTop - baseTop + (Math.max(0, Math.min(100, sPct)) / 100) * sHeight
            const tx = cursor.x
            const ty = cursor.y
            if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(tx) && Number.isFinite(ty)) {
              const d = buildEdgePathD({ edgeType: globalEdgeType, sx, sy, tx, ty, rankdir: frontmatterFlowRenderSettings?.rankdir || 'LR' })
              const existing = overlayPendingEdgePathRef.current
              const pathEl = existing || document.createElementNS('http://www.w3.org/2000/svg', 'path')
              if (!existing) {
                pathEl.setAttribute('fill', 'none')
                pathEl.setAttribute('stroke', 'currentColor')
                pathEl.setAttribute('stroke-width', '1.5')
                pathEl.setAttribute('stroke-linejoin', 'round')
                pathEl.setAttribute('stroke-linecap', 'round')
                pathEl.setAttribute('stroke-dasharray', '4 4')
                pathEl.setAttribute('opacity', '0.75')
                pathEl.setAttribute('pointer-events', 'none')
                svg.appendChild(pathEl)
                overlayPendingEdgePathRef.current = pathEl
              }
              if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d)
            }
          }
        }
      }

      for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i]
        const edgeId = String(e?.id || '').trim()
        const source = String(e?.source || '').trim()
        const target = String(e?.target || '').trim()
        if (!edgeId || !source || !target) continue

        const sRect = overlayRectsByNodeId.get(source)
        const tRect = overlayRectsByNodeId.get(target)
        if (!sRect || !tRect) continue
        const outHandleId = buildFlowHandleId({ dir: 'out', edgeId: e.sourcePortKey || edgeId })
        const inHandleId = buildFlowHandleId({ dir: 'in', edgeId: e.targetPortKey || edgeId })
        const sPct = topPctByNodeAndHandle.get(source)?.get(outHandleId) ?? 50
        const tPct = topPctByNodeAndHandle.get(target)?.get(inHandleId) ?? 50

        const sTop = Number.isFinite(sRect.top) ? sRect.top : null
        const tTop = Number.isFinite(tRect.top) ? tRect.top : null
        const sRight = Number.isFinite(sRect.right) ? sRect.right : null
        const tLeft = Number.isFinite(tRect.left) ? tRect.left : null
        const sHeight = Number.isFinite(sRect.height) ? sRect.height : null
        const tHeight = Number.isFinite(tRect.height) ? tRect.height : null
        if (sTop == null || tTop == null || sRight == null || tLeft == null || sHeight == null || tHeight == null) continue
        if (sHeight <= 0 || tHeight <= 0) continue

        const sAnchor = readAnchor({ nodeId: source, dir: 'out', portKey: e.sourcePortKey || edgeId, fallbackRect: sRect as never, fallbackPct: sPct })
        const tAnchor = readAnchor({ nodeId: target, dir: 'in', portKey: e.targetPortKey || edgeId, fallbackRect: tRect as never, fallbackPct: tPct })
        const sx = (sAnchor ? sAnchor.x : sRight) - baseLeft
        const tx = (tAnchor ? tAnchor.x : tLeft) - baseLeft
        const sy = (sAnchor ? sAnchor.y : sTop + (Math.max(0, Math.min(100, sPct)) / 100) * sHeight) - baseTop
        const ty = (tAnchor ? tAnchor.y : tTop + (Math.max(0, Math.min(100, tPct)) / 100) * tHeight) - baseTop
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue

        const d = buildEdgePathD({
          edgeType: globalEdgeType,
          sx,
          sy,
          tx,
          ty,
          rankdir: frontmatterFlowRenderSettings?.rankdir || 'LR',
          curve: readEdgePathCurveOptions(e as unknown as GraphEdge, schema),
        })
        keep.add(edgeId)
        const existing = overlayEdgePathByIdRef.current.get(edgeId) || null
        const pathEl = existing || document.createElementNS('http://www.w3.org/2000/svg', 'path')
        const stroke = getEdgeBaseStroke(e as GraphEdge, schema)
        const strokeWidth = String(getEdgeStrokeWidth(e as GraphEdge, schema))
        if (!existing) {
          pathEl.setAttribute('fill', 'none')
          pathEl.setAttribute('stroke', stroke)
          pathEl.setAttribute('stroke-width', strokeWidth)
          pathEl.setAttribute('stroke-linejoin', 'round')
          pathEl.setAttribute('stroke-linecap', 'round')
          svg.appendChild(pathEl)
          overlayEdgePathByIdRef.current.set(edgeId, pathEl)
        }
        if (pathEl.getAttribute('stroke') !== stroke) pathEl.setAttribute('stroke', stroke)
        if (pathEl.getAttribute('stroke-width') !== strokeWidth) pathEl.setAttribute('stroke-width', strokeWidth)
        if (pathEl.getAttribute('d') !== d) pathEl.setAttribute('d', d)
      }
      for (const [id, el] of overlayEdgePathByIdRef.current.entries()) {
        if (keep.has(id)) continue
        try {
          el.remove()
        } catch {
          void 0
        }
        overlayEdgePathByIdRef.current.delete(id)
      }
      if (keep.size === 0) overlayEdgeLayoutSigRef.current = ''
    })
  }, [active, overlayOnlyModeEnabled])

  React.useEffect(() => {
    if (!active) return
    if (!overlayOnlyModeEnabled) return
    const onMove = (e: MouseEvent) => {
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const baseLeft = Number.isFinite(rect.left) ? rect.left : null
      const baseTop = Number.isFinite(rect.top) ? rect.top : null
      if (baseLeft == null || baseTop == null) return
      const cx = typeof e.clientX === 'number' && Number.isFinite(e.clientX) ? e.clientX : baseLeft
      const cy = typeof e.clientY === 'number' && Number.isFinite(e.clientY) ? e.clientY : baseTop
      pendingEdgeCursorRef.current = { x: cx - baseLeft, y: cy - baseTop, ts: Date.now() }
      scheduleOverlayEdgeUpdate()
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      try {
        window.removeEventListener('mousemove', onMove)
      } catch {
        void 0
      }
    }
  }, [active, overlayOnlyModeEnabled, scheduleOverlayEdgeUpdate])

  React.useEffect(() => {
    if (!active) return
    if (!overlayOnlyModeEnabled) return
    scheduleOverlayEdgeUpdate()
    const onInteractionFrame = () => {
      overlayEdgeLayoutSigRef.current = ''
      overlayEdgeAnchorCacheRef.current.clear()
      scheduleOverlayEdgeUpdate()
    }
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)

    const onAny = () => {
      overlayEdgeLayoutSigRef.current = ''
      overlayEdgeAnchorCacheRef.current.clear()
      scheduleOverlayEdgeUpdate()
    }
    const root = rootRef.current
    window.addEventListener('resize', onAny)
    window.addEventListener('scroll', onAny, true)
    document.addEventListener('scroll', onAny, true)
    document.addEventListener('wheel', onAny, { capture: true, passive: true })
    root?.addEventListener('scroll', onAny, true)
    root?.addEventListener('wheel', onAny, { capture: true, passive: true })

    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)
      } catch {
        void 0
      }
      window.removeEventListener('resize', onAny)
      window.removeEventListener('scroll', onAny, true)
      document.removeEventListener('scroll', onAny, true)
      document.removeEventListener('wheel', onAny, true)
      root?.removeEventListener('scroll', onAny, true)
      root?.removeEventListener('wheel', onAny, true)
      for (const el of overlayEdgePathByIdRef.current.values()) {
        try {
          el.remove()
        } catch {
          void 0
        }
      }
      overlayEdgePathByIdRef.current.clear()
      overlayEdgeLayoutSigRef.current = ''
      overlayEdgeAnchorCacheRef.current.clear()
      if (overlayPendingEdgePathRef.current) {
        try {
          overlayPendingEdgePathRef.current.remove()
        } catch {
          void 0
        }
        overlayPendingEdgePathRef.current = null
      }
    }
  }, [active, overlayOnlyModeEnabled, scheduleOverlayEdgeUpdate])


  React.useEffect(() => {
    if (!editorRuntimeActive) return
    if (!overlayOnlyModeEnabled) return
    if (!draftGraphData) return
    if (flowEditorFrontmatterGraphAvailable) return
    if (isFrontmatterFlowGraph(draftGraphData as unknown as GraphData)) return
    const nodes = Array.isArray(draftGraphData.nodes) ? (draftGraphData.nodes as GraphNode[]) : []
    const eligible = buildFlowWidgetEligibleNodeIdSet(nodes)
    const ids = Array.from(eligible)
    if (ids.length === 0) return
    if (ids.length > 120) return
    setOpenWidgetNodeIds(ids)
  }, [draftGraphData, editorRuntimeActive, flowEditorFrontmatterGraphAvailable, overlayOnlyModeEnabled, setOpenWidgetNodeIds])

  React.useEffect(() => {
    if (!editorRuntimeActive) return
    if (!flowEditorViewActive) return
    if (!draftGraphData) return
    const nodes = Array.isArray(draftGraphData?.nodes) ? draftGraphData?.nodes : []
    const idSet = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
    const eligible = buildFlowWidgetEligibleNodeIdSet(nodes as any)
    updateOpenWidgetNodeIds(prev => prev.filter(id => {
      const s = String(id || '')
      return idSet.has(s) && (eligible.size === 0 || eligible.has(s))
    }))
  }, [draftGraphData, editorRuntimeActive, flowEditorViewActive, updateOpenWidgetNodeIds])

  React.useEffect(() => {
    widgetRegistryRef.current = widgetRegistry
  }, [widgetRegistry])

  const shouldDedupeWidgetDrop = React.useCallback((key: string): boolean => {
    const now = Date.now()
    const last = lastWidgetDropRef.current
    if (last && last.key === key && now - last.ts <= WIDGET_DROP_DEDUPE_WINDOW_MS) return true
    lastWidgetDropRef.current = { key, ts: now }
    return false
  }, [])

  React.useEffect(() => {
    draftGraphDataRef.current = draftGraphData
  }, [draftGraphData])

  const scheduleForceSelect = React.useCallback((id: string, opts?: { minHoldMs?: number }) => {
    const nodeId = String(id || '').trim()
    if (!nodeId) return
    const now = Date.now()
    const minHoldMs = typeof opts?.minHoldMs === 'number' && Number.isFinite(opts.minHoldMs) ? Math.max(0, opts.minHoldMs) : 0
    const nextUntil = now + minHoldMs
    const existing = forceSelectRef.current
    if (!existing || existing.id !== nodeId) {
      forceSelectRef.current = { id: nodeId, remaining: FORCE_SELECT_MAX_TICKS, untilMs: nextUntil }
    } else if (nextUntil > existing.untilMs) {
      existing.untilMs = nextUntil
    }
    if (forceSelectTimerRef.current != null) return

    const tick = () => {
      forceSelectTimerRef.current = null
      const cur = forceSelectRef.current
      if (!cur) return
      if (cur.remaining <= 0) {
        forceSelectRef.current = null
        return
      }
      cur.remaining -= 1
      const st = useGraphStore.getState()
      const selected = String(st.selectedNodeId || '')
      const matches = selected === cur.id
      if (!matches) {
        useGraphStore.setState({
          selectionSource: 'canvas',
          selectedNodeId: cur.id,
          selectedEdgeId: null,
          selectedGroupId: null,
          selectedNodeIds: [cur.id],
          selectedEdgeIds: [],
          selectedGroupIds: [],
        })
      }
      const now = Date.now()
      if (matches && now >= cur.untilMs) {
        forceSelectRef.current = null
        return
      }
      forceSelectTimerRef.current = setTimeout(tick, FORCE_SELECT_TICK_MS) as unknown as number
    }

    forceSelectTimerRef.current = setTimeout(tick, FORCE_SELECT_TICK_MS) as unknown as number
  }, [])

  React.useEffect(() => {
    return () => {
      if (forceSelectTimerRef.current != null) {
        try {
          clearTimeout(forceSelectTimerRef.current)
        } catch {
          void 0
        }
        forceSelectTimerRef.current = null
      }
      forceSelectRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const pending = pendingSelectNodeIdRef.current
    if (!pending) return
    const nodes = Array.isArray(draftGraphData?.nodes) ? draftGraphData?.nodes : []
    const found = nodes.find(n => String(n.id || '') === pending) || null
    if (!found) return
    pendingSelectNodeIdRef.current = null
    reservedNodeIdsRef.current.delete(pending)
    setOverlayNodeIdOverride(pending)
    overlayNodeIdOverrideWasSelectedRef.current = false
    overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
    useGraphStore.setState({
      selectionSource: 'canvas',
      selectedNodeId: pending,
      selectedEdgeId: null,
      selectedGroupId: null,
      selectedNodeIds: [pending],
      selectedEdgeIds: [],
      selectedGroupIds: [],
    })
    scheduleForceSelect(pending, { minHoldMs: 250 })
  }, [draftGraphData, scheduleForceSelect])

  React.useEffect(() => {
    const pending = String(pendingOpenWidgetNodeIdRef.current || '').trim()
    if (!pending) return
    const nodes = Array.isArray(renderGraphDataOverride?.nodes) ? (renderGraphDataOverride.nodes as GraphNode[]) : []
    const resolvedPending = resolveGraphNodeIdByCanonicalId(renderGraphDataOverride as GraphData | null, pending) || pending
    const found = nodes.find(n => {
      const nodeId = String(n.id || '').trim()
      return !!nodeId && (nodeId === pending || nodeId === resolvedPending)
    }) || null
    if (!found) return
    pendingOpenWidgetNodeIdRef.current = null
    const openId = String(found.id || resolvedPending || pending).trim()
    if (!openId) return
    updateOpenWidgetNodeIds(prev => (prev.includes(openId) ? prev : [...prev, openId]))
  }, [renderGraphDataOverride, updateOpenWidgetNodeIds])

  React.useEffect(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return
    const selected = String(selectedNodeId || '').trim()
    if (selected && selected === override) overlayNodeIdOverrideWasSelectedRef.current = true
  }, [overlayNodeIdOverride, selectedNodeId])

  React.useEffect(() => {
    if (!active) return
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return
    const now = Date.now()
    if (now > overlayNodeIdOverrideUntilMsRef.current) return
    const selected = String(selectedNodeId || '').trim()
    if (selected === override) return
    useGraphStore.setState({
      selectionSource: 'canvas',
      selectedNodeId: override,
      selectedEdgeId: null,
      selectedGroupId: null,
      selectedNodeIds: [override],
      selectedEdgeIds: [],
      selectedGroupIds: [],
    })
  }, [active, overlayNodeIdOverride, selectedNodeId])

  React.useEffect(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return
    const now = Date.now()
    const selected = String(selectedNodeId || '').trim()
    if (overlayNodeIdOverrideWasSelectedRef.current && selected && selected !== override && now > overlayNodeIdOverrideUntilMsRef.current) {
      setOverlayNodeIdOverride(null)
      return
    }
    if (now <= overlayNodeIdOverrideUntilMsRef.current) return
    const nodes = Array.isArray(draftGraphData?.nodes) ? draftGraphData?.nodes : []
    const found = nodes.find(n => String(n.id || '') === override) || null
    if (!found) setOverlayNodeIdOverride(null)
  }, [draftGraphData, overlayNodeIdOverride, selectedNodeId])

  const beginAddEdgeFromNode = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!active) return
      if (!draftGraphData) return
      const nodeIds = new Set((draftGraphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      const nodeById = new Map((draftGraphData.nodes || []).map(n => [String(n.id || ''), n] as const))
      const node = nodeById.get(id) || null
      const explicit = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const defaultPortKey = explicit || pickDefaultFlowPortKey(node, 'out') || null
      setSelectionSource('canvas')
      selectEdge(null)
      selectNode(id)
      setToolMode('addEdge')
      setPendingEdgeSourceId(id)
      setPendingEdgeSourcePortKey(defaultPortKey)
    },
    [active, draftGraphData, selectEdge, selectNode, setSelectionSource],
  )

  const finalizePendingEdge = React.useCallback(
    (nodeId: string, portKey?: string | null) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!active) return
      if (toolMode !== 'addEdge') return
      if (!draftGraphData) return
      const nodeIds = new Set((draftGraphData.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      if (!nodeIds.has(id)) return
      if (!pendingEdgeSourceId) {
        setPendingEdgeSourceId(id)
        setPendingEdgeSourcePortKey(null)
        return
      }
      if (pendingEdgeSourceId === id) return

      const nodeById = new Map((draftGraphData.nodes || []).map(n => [String(n.id || ''), n] as const))
      const sourceNode = nodeById.get(pendingEdgeSourceId) || null
      const targetNode = nodeById.get(id) || null
      const explicitSource =
        typeof pendingEdgeSourcePortKey === 'string' && pendingEdgeSourcePortKey.trim() ? pendingEdgeSourcePortKey.trim() : null
      const sourcePort = explicitSource || pickDefaultFlowPortKey(sourceNode, 'out') || null
      const explicitTarget = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const targetPort = explicitTarget || pickDefaultFlowPortKey(targetNode, 'in') || null

      const result = finalizeEdgeAuthoring({
        mode: 'create',
        data: draftGraphData,
        schema,
        label: 'linksTo',
        selectedEdgeId: null,
        from: { nodeId: pendingEdgeSourceId, portKey: sourcePort },
        to: { nodeId: id, portKey: targetPort },
      })

      if (result.kind === 'blocked') {
        const message =
          result.reason === 'socket'
            ? `Incompatible port types: ${result.outType || '∅'} → ${result.inType || '∅'}.`
            : result.reason === 'schema'
              ? 'Edge blocked by schema rules.'
              : null
        if (message) {
          upsertUiToast({ id: 'flow-editor-edge-denied', kind: 'warning', message, ttlMs: 2200 })
        }
        return
      }

      if (result.kind === 'select-existing') {
        setSelectionSource('canvas')
        selectEdge(String(result.edgeId || ''))
        selectNode(null)
        setPendingEdgeSourceId(null)
        setPendingEdgeSourcePortKey(null)
        setToolMode('select')
        return
      }

      if (result.kind === 'create') {
        addEdge(result.edge)
        setPendingEdgeSourceId(null)
        setPendingEdgeSourcePortKey(null)
        setToolMode('select')
      }
    },
    [active, addEdge, draftGraphData, pendingEdgeSourceId, pendingEdgeSourcePortKey, schema, selectEdge, selectNode, setSelectionSource, toolMode, upsertUiToast],
  )

  React.useEffect(() => {
    if (!active) return
    if (toolMode !== 'addEdge') return
    if (!selectedNodeId) return
    finalizePendingEdge(selectedNodeId)
  }, [active, finalizePendingEdge, selectedNodeId, toolMode])

  const appendDraftNode = React.useCallback(
    (args: { id?: string | null; type: string; label?: string | null; x: number; y: number; properties?: Record<string, unknown> }) => {
      const base: GraphData = (draftGraphData || (baseGraphData as GraphData | null) || {
        context: '',
        type: 'Graph',
        nodes: [],
        edges: [],
      }) as GraphData
      const used = new Set<string>((base.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      const requested = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : ''
      const id = requested && !used.has(requested) ? requested : createUniqueId('n', used)

      const x = Number.isFinite(args.x) ? args.x : 0
      const y = Number.isFinite(args.y) ? args.y : 0
      const type = String(args.type || '').trim() || 'Node'
      const label = String(args.label || '').trim() || id
      const nextNode: GraphNode = {
        id,
        label,
        type,
        x,
        y,
        properties: (args.properties || {}) as never,
      }
      const beforeIds = new Set<string>((useGraphStore.getState().graphData?.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      addNode(nextNode)
      const committedGraph = useGraphStore.getState().graphData as GraphData | null
      const committedNodes = Array.isArray(committedGraph?.nodes) ? (committedGraph!.nodes as GraphNode[]) : []
      const exactId = committedNodes.find(n => String(n.id || '') === id)?.id
      const composedId = committedNodes.find(n => String(n.id || '').endsWith(`::${id}`))?.id
      const insertedId = committedNodes.find(n => {
        const nodeId = String(n.id || '')
        if (!nodeId || beforeIds.has(nodeId)) return false
        return String(n.type || '').trim() === type && String(n.label || '').trim() === label
      })?.id
      const actualId = String(exactId || composedId || insertedId || id).trim() || id
      pendingSelectNodeIdRef.current = actualId
      return actualId
    },
    [addNode, baseGraphData, draftGraphData],
  )

  const syncGrabMapsDiscoveryGeoFromDropCursor = React.useCallback(
    (args: { id: string; properties: Record<string, unknown> }) => {
      if (!widgetDropBridgeOnly) return
      if (typeof window === 'undefined') return
      let cancelled = false
      let attempts = 0
      const trySync = () => {
        if (cancelled) return
        attempts += 1
        const cursor = readGeospatialCursorLngLat()
        const lat = cursor ? Number(cursor.lat) : Number.NaN
        const lng = cursor ? Number(cursor.lng) : Number.NaN
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          const baseGeo = isRecord(args.properties.geo) ? args.properties.geo : {}
          const nextProperties = {
            ...args.properties,
            geo: {
              ...baseGeo,
              lat,
              lng,
            },
          }
          updateNode(args.id, { properties: nextProperties as never })
          setPendingOverlayNode(prev => {
            if (!prev || String(prev.id || '') !== args.id) return prev
            const prevProps = isRecord(prev.properties) ? prev.properties : {}
            const prevGeo = isRecord(prevProps.geo) ? prevProps.geo : {}
            return {
              ...prev,
              properties: {
                ...prevProps,
                geo: {
                  ...prevGeo,
                  lat,
                  lng,
                },
              } as never,
            }
          })
          void requestGeospatialCurrentLocation({ lat, lng }).catch(() => void 0)
          return
        }
        if (attempts >= 4) return
        window.setTimeout(() => {
          window.requestAnimationFrame(trySync)
        }, attempts === 1 ? 0 : 32)
      }
      window.requestAnimationFrame(trySync)
      window.setTimeout(() => {
        cancelled = true
      }, 240)
    },
    [updateNode, widgetDropBridgeOnly],
  )

  const addNodeFromRegistryAtWorld = React.useCallback(
    (args: { entry: WidgetRegistryEntry; x: number; y: number }) => {
      const entry = args.entry
      const x = Number.isFinite(args.x) ? args.x : 0
      const y = Number.isFinite(args.y) ? args.y : 0
      const label = getWidgetRegistryEntryLabel({
        nodeTypeId: entry.nodeTypeId,
        widgetTypeId: entry.widgetTypeId,
        formId: entry.formId,
      })
      const properties: Record<string, unknown> = {
        [FLOW_WIDGET_TYPE_ID_KEY]: entry.widgetTypeId,
        [FLOW_WIDGET_FORM_ID_KEY]: entry.formId,
      }
      if (entry.nodeTypeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) {
        Object.assign(properties, buildBytePlusImageWidgetSeedProperties({
          prompt: 'Generate an image responsive to the active request.',
        }))
        properties.imageUrl = ''
      }
      if (entry.nodeTypeId === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
        const store = useGraphStore.getState()
        const providerFamily = inferTextGenerationProviderFamily({
          provider: store.chatProvider,
          widgetTypeId: entry.widgetTypeId,
          formId: entry.formId,
        })
        const nextTextProperties = resolveTextGenerationGlobalDefaultsForProviderFamily({
          providerFamily,
          globalProperties: {
            chatProvider: store.chatProvider,
            chatAuthMode: store.chatAuthMode,
            chatEndpointUrl: store.chatEndpointUrl,
            chatModel: store.chatModel,
            chatTemperature: store.chatTemperature,
            chatMaxCompletionTokens: store.chatMaxCompletionTokens,
            chatServiceTier: store.chatServiceTier,
            chatStream: store.chatStream,
            chatMessagesJson: store.chatMessagesJson,
            chatReasoningEffort: store.chatReasoningEffort,
            chatThinkingType: store.chatThinkingType,
            chatThinkingJson: store.chatThinkingJson,
            chatFrequencyPenalty: store.chatFrequencyPenalty,
            chatPresencePenalty: store.chatPresencePenalty,
            chatTopP: store.chatTopP,
            chatLogprobs: store.chatLogprobs,
            chatTopLogprobs: store.chatTopLogprobs,
            chatParallelToolCalls: store.chatParallelToolCalls,
            chatStopJson: store.chatStopJson,
            chatStreamOptionsJson: store.chatStreamOptionsJson,
            chatResponseFormatJson: store.chatResponseFormatJson,
            chatLogitBiasJson: store.chatLogitBiasJson,
            chatToolsJson: store.chatToolsJson,
            chatToolChoiceJson: store.chatToolChoiceJson,
          },
        })
        Object.assign(properties, {
          ...nextTextProperties,
          prompt: 'Generate a text response for the active request.',
          output: '',
        })
      }
      if (entry.nodeTypeId === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
        Object.assign(properties, {
          output: '',
          imageUrl: '',
          videoUrl: '',
          outputSrcDoc: '',
        })
      }
      if (entry.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
        Object.assign(properties, buildBytePlusVideoWidgetSeedProperties({
          prompt: 'Generate a video responsive to the active request.',
        }))
        properties.reference_image = ''
        properties.videoUrl = ''
      }
      if (entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID) {
        Object.assign(properties, readGrabMapsDiscoveryWidgetProperties())
        if (!geospatialWidgetPanelMode) {
          const cursorLngLat = widgetDropBridgeOnly ? readGeospatialCursorLngLat() : null
          const cursorLat = cursorLngLat ? Number(cursorLngLat.lat) : Number.NaN
          const cursorLng = cursorLngLat ? Number(cursorLngLat.lng) : Number.NaN
          const nearLat = pickFiniteNumber(properties.nearbyLat)
          const nearLon = pickFiniteNumber(properties.nearbyLon)
          const searchLat = pickFiniteNumber(properties.searchLat)
          const searchLon = pickFiniteNumber(properties.searchLon)
          const geoLat = Number.isFinite(cursorLat) ? cursorLat : (nearLat ?? searchLat)
          const geoLng = Number.isFinite(cursorLng) ? cursorLng : (nearLon ?? searchLon)
          if (geoLat != null && geoLng != null) {
            const geoRaw = isRecord(properties.geo) ? properties.geo : {}
            properties.geo = {
              ...geoRaw,
              lat: geoLat,
              lng: geoLng,
            }
          }
        }
      }
      const base: GraphData =
        draftGraphDataRef.current
        || ((baseGraphData as GraphData | null) || {
          context: '',
          type: 'Graph',
          nodes: [],
          edges: [],
        }) as GraphData
      const used = new Set<string>((base.nodes || []).map(n => String(n.id || '')).filter(Boolean))
      for (const rid of reservedNodeIdsRef.current) used.add(rid)
      const requestedId = createUniqueId('n', used)
      reservedNodeIdsRef.current.add(requestedId)
      const actualId = appendDraftNode({ id: requestedId, type: entry.nodeTypeId, label, x, y, properties })
      reservedNodeIdsRef.current.add(actualId)
      if (geospatialWidgetPanelMode) {
        const st = useGraphStore.getState()
        const pinnedMap = st.flowWidgetPinnedByNodeId || {}
        if (pinnedMap[actualId] !== false) {
          st.setFlowWidgetPinnedByNodeId({ ...pinnedMap, [actualId]: false })
        }
      }
      setOverlayNodeIdOverride(actualId)
      pendingOverlayNodeIdRef.current = actualId
      overlayNodeIdOverrideWasSelectedRef.current = false
      overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
      lastDroppedWidgetNodeIdRef.current = actualId
      setLastDroppedWidgetToken(Date.now())
      useGraphStore.setState({
        selectionSource: 'canvas',
        selectedNodeId: actualId,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [actualId],
        selectedEdgeIds: [],
        selectedGroupIds: [],
      })
      scheduleForceSelect(actualId, { minHoldMs: 700 })
      setPendingOverlayNode({ id: actualId, type: entry.nodeTypeId, label, x, y, properties: properties as never })
      pendingOpenWidgetNodeIdRef.current = actualId
      if (entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID && !geospatialWidgetPanelMode) {
        syncGrabMapsDiscoveryGeoFromDropCursor({ id: actualId, properties })
      }
      if (entry.nodeTypeId === FLOW_GRABMAPS_DISCOVERY_NODE_TYPE_ID) {
        void setGeospatialModeEnabled(true).catch(() => void 0)
        if (!geospatialWidgetPanelMode) {
          const dropGeo = readFiniteGeoLatLng(properties)
          if (dropGeo) {
            void requestGeospatialCurrentLocation(dropGeo).catch(() => void 0)
          }
        }
      }
      try {
        setTimeout(() => {
          if (pendingOverlayNodeIdRef.current !== actualId) return
          pendingOverlayNodeIdRef.current = null
          setPendingOverlayNode(null)
        }, 2000)
      } catch {
        void 0
      }
    },
    [appendDraftNode, baseGraphData, geospatialWidgetPanelMode, scheduleForceSelect, syncGrabMapsDiscoveryGeoFromDropCursor, updateOpenWidgetNodeIds, upsertUiToast],
  )

  React.useEffect(() => {
    if (!(active || widgetDropCaptureEnabled)) return
    if (typeof document === 'undefined') return
    const readDropRect = (): DOMRect | null => {
      if (widgetDropBridgeOnly) {
        const w = typeof window !== 'undefined' ? window.innerWidth : 0
        const h = typeof window !== 'undefined' ? window.innerHeight : 0
        if (!(Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0)) return null
        return {
          left: 0,
          top: 0,
          right: w,
          bottom: h,
          width: w,
          height: h,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect
      }
      const el = rootRef.current
      return el ? el.getBoundingClientRect() : null
    }
    const onDragOverCapture = (ev: DragEvent) => {
      const dt = ev.dataTransfer
      if (!dt) return
      if (!hasFlowWidgetDragType(dt)) return
      const rect = readDropRect()
      if (!rect) return
      const x = ev.clientX
      const y = ev.clientY
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return
      try {
        ev.preventDefault()
      } catch {
        void 0
      }
      try {
        dt.dropEffect = 'copy'
      } catch {
        void 0
      }
    }

    const onDropCapture = (ev: DragEvent) => {
      const dt = ev.dataTransfer
      if (!dt) return
      const payload = readFlowWidgetDragPayloadFromDataTransfer({ getData: mime => dt.getData(mime) })
      if (!payload) return
      const rect = readDropRect()
      if (!rect) return
      setCanvasWindowOffsetFromRect(rect)
      const sx = ev.clientX - rect.left
      const sy = ev.clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
      const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
      if (shouldDedupeWidgetDrop(dropKey)) {
        try {
          ev.preventDefault()
        } catch {
          void 0
        }
        try {
          ev.stopPropagation()
        } catch {
          void 0
        }
        try {
          ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
        } catch {
          void 0
        }
        return
      }
      const entry = (widgetRegistryRef.current || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
      if (!entry) return
      const st = useGraphStore.getState()
      const liveZoom = getLiveZoomTransform()
      const pos = screenToWorld({
        transform:
          liveZoom ||
          getEffectiveZoomStateForKey({
            zoomViewKey: zoomViewKeyRef.current,
            zoomStateByKey: st.zoomStateByKey,
            zoomState: st.zoomState,
          }),
        sx,
        sy,
      })
      addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
      upsertUiToast({
        id: 'flow-editor-drop-widget',
        kind: 'neutral',
        message: `Created ${entry.nodeTypeId} node.`,
        ttlMs: 1500,
      })
      try {
        ev.preventDefault()
      } catch {
        void 0
      }
      try {
        ev.stopPropagation()
      } catch {
        void 0
      }
      try {
        ;(ev as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
      } catch {
        void 0
      }
    }

    document.addEventListener('dragover', onDragOverCapture, true)
    document.addEventListener('drop', onDropCapture, true)
    return () => {
      document.removeEventListener('dragover', onDragOverCapture, true)
      document.removeEventListener('drop', onDropCapture, true)
    }
  }, [
    active,
    addNodeFromRegistryAtWorld,
    getLiveZoomTransform,
    setCanvasWindowOffsetFromRect,
    shouldDedupeWidgetDrop,
    upsertUiToast,
    widgetDropCaptureEnabled,
    widgetDropBridgeOnly,
  ])

  React.useEffect(() => {
    if (!(active || widgetDropCaptureEnabled)) return
    if (typeof document === 'undefined') return
    const MIN_POINTER_DRAG_DISTANCE_PX = 6
    const onPointerUpCapture = (ev: PointerEvent) => {
      const session = readActiveFlowWidgetPointerDragSession()
      if (!session) return
      if (session.pointerId !== ev.pointerId) return
      try {
        clearActiveFlowWidgetPointerDragSession(ev.pointerId)
      } catch {
        void 0
      }
      if (session.nativeDragStarted) return
      const dx = ev.clientX - session.startClientX
      const dy = ev.clientY - session.startClientY
      if (Math.hypot(dx, dy) < MIN_POINTER_DRAG_DISTANCE_PX) return
      const el = rootRef.current
      const rect = el ? el.getBoundingClientRect() : null
      if (!rect) return
      const sx = ev.clientX - rect.left
      const sy = ev.clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
      const entry = (widgetRegistryRef.current || []).find(e => e && e.isEnabled && e.id === session.registryEntryId) || null
      if (!entry) return
      const dropKey = `${session.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
      if (shouldDedupeWidgetDrop(dropKey)) return
      setCanvasWindowOffsetFromRect(rect)
      const st = useGraphStore.getState()
      const liveZoom = getLiveZoomTransform()
      const pos = screenToWorld({
        transform:
          liveZoom ||
          getEffectiveZoomStateForKey({
            zoomViewKey: zoomViewKeyRef.current,
            zoomStateByKey: st.zoomStateByKey,
            zoomState: st.zoomState,
          }),
        sx,
        sy,
      })
      addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
      upsertUiToast({
        id: 'flow-editor-drop-widget',
        kind: 'neutral',
        message: `Created ${entry.nodeTypeId} node.`,
        ttlMs: 1500,
      })
    }
    document.addEventListener('pointerup', onPointerUpCapture, true)
    return () => {
      document.removeEventListener('pointerup', onPointerUpCapture, true)
    }
  }, [
    active,
    addNodeFromRegistryAtWorld,
    getLiveZoomTransform,
    setCanvasWindowOffsetFromRect,
    shouldDedupeWidgetDrop,
    upsertUiToast,
    widgetDropCaptureEnabled,
  ])

  if (widgetDropBridgeOnly) {
    return <section ref={rootRef} className="absolute inset-0 pointer-events-none opacity-0" aria-hidden="true" />
  }

  const removeNodeById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!draftGraphData) return
      const nodeIdSet = new Set([id])
      const nextNodes = (draftGraphData.nodes || []).filter(n => !nodeIdSet.has(String(n.id || '')))
      const nextEdges = (draftGraphData.edges || []).filter(e => {
        const src = readEdgeEndpointId(e.source)
        const tgt = readEdgeEndpointId(e.target)
        if (!src || !tgt) return false
        if (nodeIdSet.has(src) || nodeIdSet.has(tgt)) return false
        return true
      })
      const next: GraphData = normalizeGraphData({
        ...draftGraphData,
        nodes: nextNodes,
        edges: nextEdges,
      })
      setGraphDataPreservingLayout(next)
      updateOpenWidgetNodeIds(prev => prev.filter(x => String(x || '') !== id))
      const selected = String(useGraphStore.getState().selectedNodeId || '')
      if (selected === id) {
        setSelectionSource('canvas')
        selectNode(null)
        selectEdge(null)
      }
    },
    [draftGraphData, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource, updateOpenWidgetNodeIds],
  )

  const clearNodeOutputById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      const draft = (draftGraphDataRef.current || draftGraphData) as GraphData | null
      const node = (draft?.nodes || []).find(n => String(n.id || '') === id) || null
      if (!node) return
      const kind = resolveRichMediaWidgetKind(node)
      if (kind) {
        updateNode(id, {
          properties: clearRichMediaOutputProperties((node.properties || {}) as Record<string, unknown>) as never,
        })
        upsertUiToast({
          id: `flow-editor-clear-output-${id}`,
          kind: 'neutral',
          message: `Cleared ${kind} output.`,
          ttlMs: 2200,
        })
        return
      }
      if (String(node.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID) {
        updateNode(id, {
          properties: clearRichMediaOutputProperties((node.properties || {}) as Record<string, unknown>) as never,
        })
        upsertUiToast({
          id: `flow-editor-clear-output-${id}`,
          kind: 'neutral',
          message: 'Cleared rich media panel output.',
          ttlMs: 2200,
        })
        return
      }
      if (String(node.type || '').trim() === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
        updateNode(id, {
          properties: {
            ...((node.properties || {}) as Record<string, unknown>),
            output: '',
          } as never,
        })
        upsertUiToast({
          id: `flow-editor-clear-output-${id}`,
          kind: 'neutral',
          message: 'Cleared text output.',
          ttlMs: 2200,
        })
        return
      }
      upsertUiToast({
        id: `flow-editor-clear-output-${id}`,
        kind: 'neutral',
        message: 'Clear output is not implemented in MVP.',
        ttlMs: 2200,
      })
    },
    [draftGraphData, updateNode, upsertUiToast],
  )

  const selectedDraftNode = React.useMemo(() => {
    if (!draftGraphData || !selectedNodeId) return null
    return resolveGraphNodeByCanonicalId(draftGraphData, selectedNodeId)
  }, [draftGraphData, selectedNodeId])

  const overlayDraftNode = React.useMemo(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return selectedDraftNode
    if (!draftGraphData) {
      const pending = pendingOverlayNodeIdRef.current
      if (pending && pending === override) return pendingOverlayNode
      return selectedDraftNode
    }
    const found = resolveGraphNodeByCanonicalId(draftGraphData, override)
    if (found) return found
    const pending = pendingOverlayNodeIdRef.current
    if (pending && pending === override) return pendingOverlayNode
    return selectedDraftNode
  }, [draftGraphData, overlayNodeIdOverride, pendingOverlayNode, selectedDraftNode])

  const selectedDraftEdge = React.useMemo(() => {
    if (!draftGraphData || !selectedEdgeId) return null
    const edges = Array.isArray(draftGraphData.edges) ? draftGraphData.edges : []
    return edges.find(e => String(e.id || '') === selectedEdgeId) || null
  }, [draftGraphData, selectedEdgeId])

  React.useEffect(() => {
    if (!active) return
    setJsonError(null)
    setNodePropsJson(safeJsonStringify(selectedDraftNode?.properties || {}))
    setNodeMetaJson(safeJsonStringify(selectedDraftNode?.metadata || {}))
    setEdgePropsJson(safeJsonStringify(selectedDraftEdge?.properties || {}))
    setEdgeMetaJson(safeJsonStringify(selectedDraftEdge?.metadata || {}))
    setWorkflowMetaJson(safeJsonStringify(draftGraphData?.metadata || {}))
    setWorkflowContextJson(safeJsonStringify(draftGraphData?.context ?? null))
  }, [active, draftGraphData, selectedDraftEdge, selectedDraftNode])

  const setNodeLabelById = React.useCallback(
    (nodeId: string, label: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      const trimmed = String(label || '')
      updateNode(id, { label: trimmed })
    },
    [updateNode],
  )

  const setSelectedNodeLabel = React.useCallback(
    (label: string) => {
      if (!selectedNodeId) return
      setNodeLabelById(selectedNodeId, label)
    },
    [selectedNodeId, setNodeLabelById],
  )

  const setNodeTypeById = React.useCallback(
    (nodeId: string, type: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      const trimmed = String(type || '').trim() || 'Node'
      updateNode(id, { type: trimmed })
    },
    [updateNode],
  )

  const setSelectedNodeType = React.useCallback(
    (type: string) => {
      if (!selectedNodeId) return
      setNodeTypeById(selectedNodeId, type)
    },
    [selectedNodeId, setNodeTypeById],
  )

  const patchNodePropertiesById = React.useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      const cur = useGraphStore.getState().graphData
      const node = cur?.nodes?.find(n => String(n.id || '') === id) || null
      if (!node) return
      const prevProps = (node.properties || {}) as Record<string, unknown>
      const nextProps: Record<string, unknown> = { ...prevProps }
      for (const [key, value] of Object.entries(patch)) {
        if (typeof value === 'undefined') delete nextProps[key]
        else nextProps[key] = value as unknown
      }
      updateNode(id, { properties: nextProps as never })
    },
    [updateNode],
  )

  const renameSchemaFieldIdByNodeId = React.useCallback(
    (nodeId: string, prevId: string, nextId: string) => {
      const id = String(nodeId || '').trim()
      const from = String(prevId || '').trim()
      const to = String(nextId || '').trim()
      if (!id || !from || !to || from === to) return
      if (!draftGraphData) return

      const prevPort = buildSchemaFieldPortKey(from)
      const nextPort = buildSchemaFieldPortKey(to)

      const nodeById = new Map((draftGraphData.nodes || []).map(n => [String(n.id || ''), n] as const))
      const rawNode = nodeById.get(id) || null
      const rawProps = (rawNode?.properties || {}) as Record<string, JSONValue>
      const rawFields = rawProps[FLOW_SCHEMA_FIELDS_PROPERTY_KEY]
      const patchedFields = Array.isArray(rawFields)
        ? rawFields.map(item => {
            if (typeof item === 'string') return (item === from ? to : item) as JSONValue
            if (!item || typeof item !== 'object' || Array.isArray(item)) return item as JSONValue
            const rec = item as Record<string, JSONValue>
            const nextRec: Record<string, JSONValue> = { ...rec }
            if (typeof nextRec.id === 'string' && nextRec.id.trim() === from) nextRec.id = to
            if (typeof nextRec.title === 'string' && nextRec.title.trim() === from) nextRec.title = to
            return nextRec as unknown as JSONValue
          })
        : rawFields
      const patchedNodeForLabel: Pick<GraphNode, 'properties'> | null = rawNode
        ? { properties: { ...rawProps, [FLOW_SCHEMA_FIELDS_PROPERTY_KEY]: patchedFields as JSONValue } }
        : null

      let anyEdgeUpdated = false
      const nextEdges = (draftGraphData.edges || []).map(edge => {
        const isSource = String(edge.source || '') === id
        const isTarget = String(edge.target || '') === id
        if (!isSource && !isTarget) return edge

        const prevProps = (edge.properties || {}) as Record<string, unknown>
        const curSourcePort = String(prevProps[FLOW_EDGE_SOURCE_PORT_KEY] || '')
        const curTargetPort = String(prevProps[FLOW_EDGE_TARGET_PORT_KEY] || '')
        const nextSourcePort = isSource && curSourcePort === prevPort ? nextPort : curSourcePort
        const nextTargetPort = isTarget && curTargetPort === prevPort ? nextPort : curTargetPort
        if (nextSourcePort === curSourcePort && nextTargetPort === curTargetPort) return edge
        anyEdgeUpdated = true

        const nextProps: Record<string, unknown> = { ...prevProps }
        nextProps[FLOW_EDGE_SOURCE_PORT_KEY] = nextSourcePort
        nextProps[FLOW_EDGE_TARGET_PORT_KEY] = nextTargetPort

        const sourceNode = String(edge.source || '') === id ? patchedNodeForLabel : nodeById.get(String(edge.source || '')) || null
        const targetNode = String(edge.target || '') === id ? patchedNodeForLabel : nodeById.get(String(edge.target || '')) || null
        const displayLabel = buildFlowEdgeDisplayLabelFromPorts({
          sourceNode,
          targetNode,
          sourcePortKey: nextSourcePort,
          targetPortKey: nextTargetPort,
        })
        if (displayLabel) nextProps[FLOW_EDGE_DISPLAY_LABEL_KEY] = displayLabel
        else delete nextProps[FLOW_EDGE_DISPLAY_LABEL_KEY]

        return { ...edge, properties: nextProps as never }
      })

      if (!anyEdgeUpdated) return
      setGraphDataPreservingLayout(normalizeGraphData({ ...draftGraphData, edges: nextEdges }))
    },
    [draftGraphData, setGraphDataPreservingLayout],
  )

  const setNodePropertiesById = React.useCallback(
    (nodeId: string, properties: Record<string, unknown>) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      updateNode(id, { properties: (properties || {}) as never })
    },
    [updateNode],
  )

  const validateNodeById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!draftGraphData) return
      const nodes = Array.isArray(draftGraphData.nodes) ? draftGraphData.nodes : []
      const node = nodes.find(n => String(n.id || '') === id) || null
      if (!node) return
      const props = (node.properties || {}) as Record<string, unknown>
      const missing: string[] = []
      for (const key of FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS) {
        const v = props[key]
        if (key === 'duration') {
          if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) missing.push(String(key))
          continue
        }
        if (typeof v === 'string') {
          if (v.trim().length === 0) missing.push(String(key))
          continue
        }
        if (typeof v === 'undefined' || v === null) {
          missing.push(String(key))
          continue
        }
      }
      if (missing.length > 0) {
        upsertUiToast({
          id: `flow-editor-node-validate-${id}`,
          kind: 'warning',
          message: `Missing required fields: ${missing.join(', ')}`,
          ttlMs: 4500,
        })
        return
      }
      upsertUiToast({
        id: `flow-editor-node-validate-${id}`,
        kind: 'success',
        message: 'Node validated.',
        ttlMs: 2500,
      })
    },
    [draftGraphData, upsertUiToast],
  )

  const duplicateNodeById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!draftGraphData) return
      const nodes = Array.isArray(draftGraphData.nodes) ? draftGraphData.nodes : []
      const source = nodes.find(n => String(n.id || '') === id) || null
      if (!source) return
      const nodeIds = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
      const nextId = createUniqueId('n', nodeIds)
      const baseLabel = String(source.label || source.id || nextId)
      const nextNode: GraphNode = {
        ...source,
        id: nextId,
        label: `${baseLabel} copy`,
        x: (Number.isFinite(source.x) ? source.x : 0) + 40,
        y: (Number.isFinite(source.y) ? source.y : 0) + 40,
      }
      const next: GraphData = {
        ...draftGraphData,
        nodes: [...nodes, nextNode],
      }
      setGraphDataPreservingLayout(normalizeGraphData(next))
      updateOpenWidgetNodeIds(prev => (prev.includes(nextId) ? prev : [...prev, nextId]))
      setSelectionSource('canvas')
      selectEdge(null)
      selectNode(nextId)
    },
    [draftGraphData, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource, updateOpenWidgetNodeIds],
  )

  const showNodeEditorHelp = React.useCallback(() => {
    upsertUiToast({
      id: 'flow-editor-node-editor-help',
      kind: 'neutral',
      message: UI_COPY.flowWidgetHelpToast,
      ttlMs: 2800,
    })
  }, [upsertUiToast])

  const enableHandlesForAllInputs = React.useCallback(() => {
    if (documentStructureBaselineLock === true) {
      upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }

    if (isHandlesForAllInputsEnabled(schema)) {
      upsertUiToast({
        id: 'flow-editor-enable-handles',
        kind: 'neutral',
        message: UI_COPY.flowWidgetEnableHandlesAlreadyOnToast,
        ttlMs: 2200,
      })
      return
    }

    const next = enableHandlesForAllInputsInSchema(schema)
    if (next.changed) setSchema(next.schema)
    upsertUiToast({
      id: 'flow-editor-enable-handles',
      kind: 'success',
      message: UI_COPY.flowWidgetEnableHandlesToast,
      ttlMs: 2600,
    })
  }, [documentStructureBaselineLock, schema, setSchema, upsertUiToast])

  const convertNodeToLoopById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!draftGraphData) return
      const converted = convertNodeToLoopInGraphData(draftGraphData, id)
      if (!converted.changed) {
        upsertUiToast({
          id: 'flow-editor-convert-loop',
          kind: 'neutral',
          message: UI_COPY.flowWidgetConvertToLoopAlreadyLoopToast,
          ttlMs: 2200,
        })
        return
      }
      setGraphDataPreservingLayout(converted.graphData)
      upsertUiToast({
        id: 'flow-editor-convert-loop',
        kind: 'success',
        message: UI_COPY.flowWidgetConvertToLoopToast,
        ttlMs: 2600,
      })
    },
    [draftGraphData, setGraphDataPreservingLayout, upsertUiToast],
  )

  const setSelectedEdgeLabel = React.useCallback(
    (label: string) => {
      if (!selectedEdgeId) return
      const trimmed = String(label || '').trim() || 'linksTo'
      updateEdge(selectedEdgeId, { label: trimmed })
    },
    [selectedEdgeId, updateEdge],
  )

  const applyJsonToDraft = React.useCallback(
    (args: { target: 'nodeProps' | 'nodeMeta' | 'edgeProps' | 'edgeMeta' | 'workflowMeta' | 'workflowContext' }) => {
      if (!draftGraphData) return
      setJsonError(null)
      const apply = (next: GraphData) => {
        setGraphDataPreservingLayout(normalizeGraphData(next))
      }

      if (args.target === 'workflowContext') {
        const parsed = tryParseJson(workflowContextJson)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        apply({ ...draftGraphData, context: parsed.value as never })
        return
      }

      if (args.target === 'workflowMeta') {
        const parsed = tryParseJson(workflowMetaJson)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        const record = coerceJsonObject(parsed.value)
        if (!record) {
          setJsonError('Workflow metadata must be a JSON object.')
          return
        }
        apply({ ...draftGraphData, metadata: record as never })
        return
      }

      if (args.target === 'nodeProps' || args.target === 'nodeMeta') {
        if (!selectedNodeId) return
        const text = args.target === 'nodeProps' ? nodePropsJson : nodeMetaJson
        const parsed = tryParseJson(text)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        const record = coerceJsonObject(parsed.value)
        if (!record) {
          setJsonError('Node value must be a JSON object.')
          return
        }
        updateNode(selectedNodeId, args.target === 'nodeProps' ? { properties: record as never } : { metadata: record as never })
        return
      }

      if (args.target === 'edgeProps' || args.target === 'edgeMeta') {
        if (!selectedEdgeId) return
        const text = args.target === 'edgeProps' ? edgePropsJson : edgeMetaJson
        const parsed = tryParseJson(text)
        if (parsed.ok === false) {
          setJsonError(parsed.error)
          return
        }
        const record = coerceJsonObject(parsed.value)
        if (!record) {
          setJsonError('Edge value must be a JSON object.')
          return
        }
        updateEdge(selectedEdgeId, args.target === 'edgeProps' ? { properties: record as never } : { metadata: record as never })
      }
    },
    [draftGraphData, edgeMetaJson, edgePropsJson, nodeMetaJson, nodePropsJson, selectedEdgeId, selectedNodeId, setGraphDataPreservingLayout, updateEdge, updateNode, workflowContextJson, workflowMetaJson],
  )

  const runWorkflowNode = React.useCallback(
    async (nodeId: string) => {
      try {
        const id = String(nodeId || '').trim()
        if (!id) return
        const activeWorkspacePath = typeof markdownDocumentName === 'string' ? markdownDocumentName.trim() : ''
        if (activeWorkspacePath && isKgcWorkspaceCompanionPath(activeWorkspacePath)) {
          const canonicalPath = toCanonicalKgcWorkspacePath(activeWorkspacePath)
          const fs = await getWorkspaceFs()
          await fs.ensureSeed()
          const canonicalText = String(await fs.readFileText(canonicalPath) || '')
          if (canonicalText.trim()) {
            useMarkdownExplorerStore.getState().setActivePath(canonicalPath)
            ensureEditorCanvasLandingForDuration(1500)
            const state = useGraphStore.getState()
            if (state.markdownDocumentName !== canonicalPath || state.markdownDocumentText !== canonicalText) {
              void state.setActiveMarkdownDocument({
                name: canonicalPath,
                text: canonicalText,
                normalizeMermaidMmd: false,
                autoEnableFrontmatter: false,
                sourceUrl: typeof markdownDocumentSourceUrl === 'string' ? markdownDocumentSourceUrl : null,
              })
            }
            const ok = await state.applyMarkdownDocumentToGraph(canonicalPath, canonicalText, { force: true })
            const outputResult = ok
              ? await emitKgcRunOutput({
                  canonicalPath,
                  canonicalText,
                  generationConfig: {
                    provider: state.chatProvider,
                    endpointUrl: state.chatEndpointUrl,
                    apiKey: state.chatAuthMode === 'byok' ? state.chatApiKey : '',
                    chatModel: state.chatModel,
                  },
                  getStore: () => ({
                    captureCanvasPngSnapshot: () => useGraphStore.getState().captureCanvasPngSnapshot(),
                    captureCanvasSvgSnapshot: () => useGraphStore.getState().captureCanvasSvgSnapshot(),
                  }),
                })
              : { path: null, kind: 'markdown' as const, degraded: false }
            const outputName = outputResult.path ? canonicalPath.split('/').pop() : ''
            const generatedName = outputResult.path ? outputResult.path.split('/').pop() : ''
            upsertUiToast({
              id: `flow-editor-run-${id}`,
              kind: 'neutral',
              message: ok
                ? generatedName
                  ? outputResult.degraded
                    ? `Ran ${outputName || 'KGC document'} and generated ${generatedName} as a markdown fallback for video output.`
                    : `Ran ${outputName || 'KGC document'} and generated ${generatedName}.`
                  : `Ran ${outputName || 'KGC document'}.`
                : `Opened ${canonicalPath.split('/').pop() || 'KGC document'}.`,
              ttlMs: 2200,
            })
            return
          }
        }
        const draft = (draftGraphDataRef.current || draftGraphData) as GraphData | null
        if (!draft) {
          upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
          return
        }
        const resolveNodeAndGraph = (): { graph: GraphData; node: GraphNode } | null => {
          const candidates = [draft, renderGraphDataOverride as unknown as GraphData | null, baseGraphData]
            .filter(Boolean) as GraphData[]
          for (const graph of candidates) {
            const node = (graph.nodes || []).find(n => String(n.id || '') === id) || null
            if (node) return { graph, node }
          }
          return null
        }
        const resolved = resolveNodeAndGraph()
        const node = resolved?.node || null
        if (!node) {
          upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNodeNotFoundToast(id), ttlMs: 2400 })
          return
        }
        const graphForRun = resolved?.graph || draft
        const resolvedNodeId = String(node.id || id)
        const pickWritableNodeId = (): string => {
          const draftNodes = Array.isArray(draft.nodes) ? draft.nodes : []
          const requested = splitComposedNodeId(id)
          const resolvedId = splitComposedNodeId(resolvedNodeId)
          const targetInners = new Set([requested.inner, resolvedId.inner].filter(Boolean))
          const exactRequested = draftNodes.find(n => String(n.id || '').trim() === requested.full)
          if (exactRequested) return String(exactRequested.id || '')
          const exactResolved = draftNodes.find(n => String(n.id || '').trim() === resolvedId.full)
          if (exactResolved) return String(exactResolved.id || '')
          const innerMatches = draftNodes.filter(n => targetInners.has(splitComposedNodeId(n.id).inner))
          if (innerMatches.length === 1) return String(innerMatches[0]?.id || '')
          return resolvedNodeId
        }
        const writableNodeId = pickWritableNodeId() || resolvedNodeId
        const store = useGraphStore.getState()
        const resolveNodeByIdAcrossGraphs = (candidateId: string): GraphNode | null => {
          const cid = String(candidateId || '').trim()
          if (!cid) return null
          const candidates = [
            draftGraphDataRef.current || draftGraphData,
            store.renderGraphDataOverride as GraphData | null,
            store.graphData as GraphData | null,
            graphForRun,
          ].filter(Boolean) as GraphData[]
          for (let i = 0; i < candidates.length; i += 1) {
            const graph = candidates[i]
            const hit = (graph.nodes || []).find(n => String(n.id || '').trim() === cid) || null
            if (hit) return hit
          }
          return null
        }
        const updateRunOutputForKnownNodeIds = (buildPatch: (nodeProps: Record<string, unknown>) => Record<string, unknown>) => {
          const candidateIds = new Set<string>()
          for (const next of parseCanonicalNodeIds(writableNodeId)) candidateIds.add(next)
          for (const next of parseCanonicalNodeIds(resolvedNodeId)) candidateIds.add(next)
          for (const next of parseCanonicalNodeIds(id)) candidateIds.add(next)
          for (const next of parseCanonicalNodeIds(node.id)) candidateIds.add(next)

          setDraftGraphData(prev => {
            if (!prev || !Array.isArray(prev.nodes) || prev.nodes.length === 0) return prev
            let changed = false
            const nextNodes = prev.nodes.map(existing => {
              const existingId = String(existing?.id || '').trim()
              if (!existingId || !candidateIds.has(existingId)) return existing
              const nodeProps = (existing.properties || {}) as Record<string, unknown>
              const nextProps = buildPatch(nodeProps)
              changed = true
              return { ...existing, properties: nextProps as never }
            })
            if (!changed) return prev
            const nextDraft = { ...prev, nodes: nextNodes }
            draftGraphDataRef.current = nextDraft
            return nextDraft
          })

          let updated = false
          for (const candidateId of Array.from(candidateIds.values())) {
            const hit = resolveNodeByIdAcrossGraphs(candidateId)
            if (!hit) continue
            const nodeProps = (hit.properties || {}) as Record<string, unknown>
            updateNode(candidateId, { properties: buildPatch(nodeProps) as never })
            updated = true
          }
          if (!updated) {
            const fallbackProps = (node.properties || {}) as Record<string, unknown>
            updateNode(writableNodeId, { properties: buildPatch(fallbackProps) as never })
          }
        }
        const setRunLoadingStateForKnownNodeIds = (args: { loading: boolean; kind?: 'text' | 'image' | 'video' }) => {
          updateRunOutputForKnownNodeIds((nodeProps) => ({
            ...nodeProps,
            outputLoading: args.loading === true ? true : undefined,
            outputLoadingKind: args.loading === true ? (args.kind || undefined) : undefined,
          }))
        }
        const dataflowRegistry = buildDataflowWidgetRegistry({
          documentWidgetRegistry: Array.isArray(store.documentWidgetRegistry)
            ? (store.documentWidgetRegistry as WidgetRegistryEntry[])
            : [],
          effectiveWidgetRegistry: Array.isArray(store.effectiveWidgetRegistry)
            ? (store.effectiveWidgetRegistry as WidgetRegistryEntry[])
            : [],
          widgetRegistry: Array.isArray(store.widgetRegistry)
            ? (store.widgetRegistry as WidgetRegistryEntry[])
            : [],
        })
        const richMediaKind = resolveRichMediaWidgetKind(node)
        if (richMediaKind) {
          setRunLoadingStateForKnownNodeIds({ loading: true, kind: richMediaKind })
          try {
            const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({
              graphData: (renderGraphDataOverride as unknown as GraphData | null) || graphForRun,
              registry: dataflowRegistry,
              targetNodeIds: new Set([writableNodeId]),
            })
            const normalizedProvider = normalizeChatProviderId(store.chatProvider)
            const runProvider = CHAT_PROVIDER_BYTEPLUS
            const runAuthMode = store.chatAuthMode === 'byok' ? 'byok' : 'serverManaged'
            const runApiKey = runAuthMode === 'byok' ? store.chatApiKey : ''
            const runEndpointUrl = normalizedProvider === CHAT_PROVIDER_BYTEPLUS
              ? store.chatEndpointUrl
              : getChatDefaultEndpointUrlForProvider(CHAT_PROVIDER_BYTEPLUS)
            const richMediaResult = await runRichMediaWidgetGeneration({
              node,
              connectedValuesBySchemaPath: connectedValuesByNodeId.get(writableNodeId),
              markdownDocumentText: typeof store.markdownDocumentText === 'string' ? store.markdownDocumentText : '',
              workspacePath: activeWorkspacePath || null,
              generationConfig: {
                provider: runProvider,
                endpointUrl: runEndpointUrl,
                apiKey: runApiKey,
                chatModel: store.chatModel,
              },
            })
            if (!richMediaResult) {
              upsertUiToast({
                id: `flow-editor-run-${id}`,
                kind: 'neutral',
                message: UI_COPY.flowEditorRunFailedToast,
                ttlMs: 2600,
              })
              return
            }
            updateRunOutputForKnownNodeIds((nodeProps) => ({
              ...clearRichMediaOutputProperties(nodeProps),
              ...buildRichMediaWidgetOutputPatch({
                kind: richMediaResult.kind,
                asset: richMediaResult.asset,
                outputPath: richMediaResult.outputPath,
              }),
            }))
            const generatedName = richMediaResult.outputPath
              ? richMediaResult.outputPath.split('/').pop()
              : richMediaResult.kind === 'video'
                ? 'video output'
                : 'image output'
            upsertUiToast({
              id: `flow-editor-run-${id}`,
              kind: 'neutral',
              message: `Generated ${generatedName}.`,
              ttlMs: 2400,
            })
          } finally {
            setRunLoadingStateForKnownNodeIds({ loading: false })
          }
          return
        }

        if (String(node.type || '').trim() === FLOW_TEXT_GENERATION_NODE_TYPE_ID) {
          const registry = dataflowRegistry
          const resolvedTextRegistryEntry = resolveWidgetRegistryEntry({
            node,
            registry,
            graphMetaKind: baseGraphKind,
          })
          const rawProperties = (node.properties || {}) as Record<string, unknown>
          const providerFamily = inferTextGenerationProviderFamily({
            provider: rawProperties.chatProvider,
            widgetTypeId: resolvedTextRegistryEntry?.widgetTypeId,
            formId: resolvedTextRegistryEntry?.formId || rawProperties[FLOW_WIDGET_FORM_ID_KEY],
          })
          const properties = resolveEffectiveTextGenerationWidgetProperties({
            providerFamily,
            localProperties: rawProperties,
            globalProperties: {
              chatProvider: store.chatProvider,
              chatAuthMode: store.chatAuthMode,
              chatEndpointUrl: store.chatEndpointUrl,
              chatModel: store.chatModel,
              chatTemperature: store.chatTemperature,
              chatMaxCompletionTokens: store.chatMaxCompletionTokens,
              chatServiceTier: store.chatServiceTier,
              chatStream: store.chatStream,
              chatMessagesJson: store.chatMessagesJson,
              chatReasoningEffort: store.chatReasoningEffort,
              chatThinkingType: store.chatThinkingType,
              chatThinkingJson: store.chatThinkingJson,
              chatFrequencyPenalty: store.chatFrequencyPenalty,
              chatPresencePenalty: store.chatPresencePenalty,
              chatTopP: store.chatTopP,
              chatLogprobs: store.chatLogprobs,
              chatTopLogprobs: store.chatTopLogprobs,
              chatParallelToolCalls: store.chatParallelToolCalls,
              chatStopJson: store.chatStopJson,
              chatStreamOptionsJson: store.chatStreamOptionsJson,
              chatResponseFormatJson: store.chatResponseFormatJson,
              chatLogitBiasJson: store.chatLogitBiasJson,
              chatToolsJson: store.chatToolsJson,
              chatToolChoiceJson: store.chatToolChoiceJson,
            },
          })
          const prompt = typeof properties.prompt === 'string' ? properties.prompt.trim() : ''
          if (!prompt) {
            upsertUiToast({
              id: `flow-editor-run-${id}`,
              kind: 'neutral',
              message: 'Add a prompt before running the Text Widget.',
              ttlMs: 2400,
            })
            return
          }
          setRunLoadingStateForKnownNodeIds({ loading: true, kind: 'text' })
          if (providerFamily === 'byteplus') {
            updateRunOutputForKnownNodeIds(nodeProps => ({
              ...clearRichMediaOutputProperties(nodeProps),
              outputLoading: true,
              outputLoadingKind: 'text',
            }))
          }
          let lastPublishedText = ''
          const resolveRichMediaPanelTargetNodeId = (): string | null => {
            const store = useGraphStore.getState()
            const graphs: GraphData[] = [
              (draftGraphDataRef.current || draftGraphData) as GraphData | null,
              store.renderGraphDataOverride as GraphData | null,
              graphForRun,
              store.graphData as GraphData | null,
            ].filter(Boolean) as GraphData[]
            const allNodes: GraphNode[] = []
            for (let i = 0; i < graphs.length; i += 1) {
              const nodes = Array.isArray(graphs[i]!.nodes) ? (graphs[i]!.nodes as GraphNode[]) : []
              for (let j = 0; j < nodes.length; j += 1) allNodes.push(nodes[j]!)
            }
            const panels = allNodes.filter(n => String(n.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
            if (panels.length === 0) return null
            const activePanel = panels.find(n => {
              const p = (n.properties || {}) as Record<string, unknown>
              return (typeof p.outputSrcDoc === 'string' && p.outputSrcDoc.trim()) || (typeof p.output === 'string' && p.output.trim())
            })
            return String((activePanel || panels[0])!.id || '').trim() || null
          }
          const ensureRichMediaPanelNodeId = (): string | null => {
            const existing = resolveRichMediaPanelTargetNodeId()
            if (existing) return existing
            if (!draftGraphData) return null
            const baseX = Number.isFinite(node.x) ? node.x : 0
            const baseY = Number.isFinite(node.y) ? node.y : 0
            const createdId = appendDraftNode({
              id: null,
              type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
              label: FLOW_RICH_MEDIA_PANEL_NODE_LABEL,
              x: baseX + 520,
              y: baseY,
              properties: { media_interactive: true },
            })
            return createdId
          }
          const publishTextRunOutputToRichMediaPanel = (outputText: string) => {
            const panelNodeId = ensureRichMediaPanelNodeId()
            if (!panelNodeId) return
            const nextOutput = String(outputText || '')
            const store = useGraphStore.getState()
            const updatePanelInDraft = (id: string, patch: Record<string, unknown>) => {
              setDraftGraphData(prev => {
                if (!prev || !Array.isArray(prev.nodes) || prev.nodes.length === 0) return prev
                let changed = false
                const nextNodes = prev.nodes.map(existing => {
                  const existingId = String(existing?.id || '').trim()
                  if (existingId !== id) return existing
                  const props = (existing.properties || {}) as Record<string, unknown>
                  changed = true
                  return { ...existing, properties: { ...props, ...patch } as never }
                })
                if (!changed) return prev
                const nextDraft = { ...prev, nodes: nextNodes }
                draftGraphDataRef.current = nextDraft
                return nextDraft
              })
            }
            const nodeTitle = node.label || FLOW_TEXT_GENERATION_NODE_LABEL
            const patch = {
              ...clearRichMediaOutputProperties({}),
              ...buildTextWidgetOutputPatch({
                output: nextOutput,
                title: nodeTitle,
                model: properties.chatModel || store.chatModel,
              }),
            }
            updatePanelInDraft(panelNodeId, patch)
            updateNode(panelNodeId, { properties: patch as never })
          }
          const publishTextRunOutput = (outputText: string, loading: boolean) => {
            const nextOutput = String(outputText || '')
            if (providerFamily === 'byteplus') {
              updateRunOutputForKnownNodeIds((nodeProps) => ({
                ...clearRichMediaOutputProperties(nodeProps),
                outputLoading: loading === true ? true : undefined,
                outputLoadingKind: loading === true ? 'text' : undefined,
              }))
              publishTextRunOutputToRichMediaPanel(nextOutput)
              return
            }

            updateRunOutputForKnownNodeIds(nodeProps => ({
              ...clearRichMediaOutputProperties(nodeProps),
              ...buildTextWidgetOutputPatch({
                output: nextOutput,
                title: node.label || FLOW_TEXT_GENERATION_NODE_LABEL,
                model: properties.chatModel || store.chatModel,
              }),
              outputLoading: loading === true ? true : undefined,
              outputLoadingKind: loading === true ? 'text' : undefined,
            }))
          }
          try {
            const result = await generateRunMarkdownWithProvider({
              config: {
                provider: properties.chatProvider || store.chatProvider,
                endpointUrl: properties.chatEndpointUrl || store.chatEndpointUrl,
                apiKey:
                  (properties.chatAuthMode || store.chatAuthMode) === 'byok'
                    ? store.chatApiKey
                    : '',
                chatModel: properties.chatModel || store.chatModel,
              },
              prompt,
              options: {
                chatTemperature: properties.chatTemperature ?? store.chatTemperature,
                chatMaxCompletionTokens: properties.chatMaxCompletionTokens ?? store.chatMaxCompletionTokens,
                chatServiceTier: properties.chatServiceTier ?? store.chatServiceTier,
                chatStream: properties.chatStream ?? store.chatStream,
                chatMessagesJson: properties.chatMessagesJson ?? store.chatMessagesJson,
                chatReasoningEffort: properties.chatReasoningEffort ?? store.chatReasoningEffort,
                chatThinkingType: properties.chatThinkingType ?? store.chatThinkingType,
                chatThinkingJson: properties.chatThinkingJson ?? store.chatThinkingJson,
                chatFrequencyPenalty: properties.chatFrequencyPenalty ?? store.chatFrequencyPenalty,
                chatPresencePenalty: properties.chatPresencePenalty ?? store.chatPresencePenalty,
                chatTopP: properties.chatTopP ?? store.chatTopP,
                chatLogprobs: properties.chatLogprobs ?? store.chatLogprobs,
                chatTopLogprobs: properties.chatTopLogprobs ?? store.chatTopLogprobs,
                chatParallelToolCalls: properties.chatParallelToolCalls ?? store.chatParallelToolCalls,
                chatStopJson: properties.chatStopJson ?? store.chatStopJson,
                chatStreamOptionsJson: properties.chatStreamOptionsJson ?? store.chatStreamOptionsJson,
                chatResponseFormatJson: properties.chatResponseFormatJson ?? store.chatResponseFormatJson,
                chatLogitBiasJson: properties.chatLogitBiasJson ?? store.chatLogitBiasJson,
                chatToolsJson: properties.chatToolsJson ?? store.chatToolsJson,
                chatToolChoiceJson: properties.chatToolChoiceJson ?? store.chatToolChoiceJson,
                onText: (nextText) => {
                  if (nextText === lastPublishedText) return
                  lastPublishedText = nextText
                  publishTextRunOutput(nextText, true)
                },
              },
            })
            if (!result) {
              upsertUiToast({
                id: `flow-editor-run-${id}`,
                kind: 'neutral',
                message: UI_COPY.flowEditorRunFailedToast,
                ttlMs: 2600,
              })
              return
            }
            publishTextRunOutput(result, false)
            upsertUiToast({
              id: `flow-editor-run-${id}`,
              kind: 'neutral',
              message: 'Generated text output.',
              ttlMs: 2400,
            })
          } finally {
            setRunLoadingStateForKnownNodeIds({ loading: false })
          }
          return
        }

        const subgraph = buildSelectionSubgraph(graphForRun, writableNodeId, null) || { ...graphForRun, nodes: [node], edges: [] }
        const registry = Array.isArray(store.widgetRegistry) ? store.widgetRegistry : []
        const nodeTypeIds = new Set((subgraph.nodes || []).map(n => String(n.type || '').trim()).filter(Boolean))
        const registryEntries = registry.filter(e => e && e.isEnabled && nodeTypeIds.has(String(e.nodeTypeId || '').trim()))
        const fallbackResolved = resolveWidgetRegistryEntry({ node, registry, graphMetaKind: baseGraphKind })
        const entries = registryEntries.length > 0 ? registryEntries : fallbackResolved ? [fallbackResolved] : []

        await exportWidgetBundleAsJson({
          graphData: subgraph,
          registryEntries: entries,
          suggestedName: `flow-node-${writableNodeId}.widget.bundle.json`,
        })
        upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunExportedToast, ttlMs: 2200 })
      } catch (error) {
        const detail =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: unknown }).message || '').trim()
            : ''
        upsertUiToast({
          id: `flow-editor-run-failed-${String(nodeId || '')}`,
          kind: 'error',
          message: detail || UI_COPY.flowEditorRunFailedToast,
          ttlMs: 4200,
        })
      }
    },
    [baseGraphData, draftGraphData, markdownDocumentName, markdownDocumentSourceUrl, renderGraphDataOverride, updateNode, upsertUiToast],
  )

  const runWorkflowAllInFlightRef = React.useRef(false)
  const runWorkflowAllNodes = React.useCallback(async () => {
    if (!flowEditorViewActive) {
      upsertUiToast({ id: 'flow-editor-run-all-not-active', kind: 'neutral', message: 'Open Flow Editor to run all.', ttlMs: 2200 })
      return
    }
    if (runWorkflowAllInFlightRef.current) return
    runWorkflowAllInFlightRef.current = true
    try {
      const draft = (draftGraphDataRef.current || draftGraphData) as GraphData | null
      const nodes = Array.isArray(draft?.nodes) ? (draft!.nodes as GraphNode[]) : []
      if (!draft || nodes.length === 0) {
        upsertUiToast({ id: 'flow-editor-run-all-missing', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const eligible = buildFlowWidgetEligibleNodeIdSet(nodes)
      const ordered = buildFlowRunAllNodeSequence({
        graphData: draft,
        eligibleNodeIds: eligible,
      })
      const ids = ordered.orderedNodeIds
      if (ids.length === 0) {
        upsertUiToast({ id: 'flow-editor-run-all-empty', kind: 'neutral', message: 'No runnable workflow nodes found.', ttlMs: 2400 })
        return
      }
      const phaseSummary = FLOW_RUN_ALL_PHASES
        .map(phase => `${phase.label}: ${ordered.phaseCounts[phase.id] || 0}`)
        .join(' · ')
      upsertUiToast({ id: 'flow-editor-run-all', kind: 'neutral', message: `Running ${ids.length} nodes in sequence. ${phaseSummary}`, ttlMs: 2600 })
      for (let i = 0; i < ids.length; i += 1) {
        await runWorkflowNode(ids[i])
        if (typeof requestAnimationFrame === 'function') {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
        }
      }
      upsertUiToast({ id: 'flow-editor-run-all-done', kind: 'neutral', message: `Ran ${ids.length} nodes.`, ttlMs: 2200 })
    } finally {
      runWorkflowAllInFlightRef.current = false
    }
  }, [draftGraphData, flowEditorViewActive, runWorkflowNode, upsertUiToast])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      void runWorkflowAllNodes()
    }
    window.addEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
    return () => {
      window.removeEventListener(WORKFLOW_RUN_ALL_EVENT, handler as EventListener)
    }
  }, [runWorkflowAllNodes])

  const exportWorkflowBundle = React.useCallback(async () => {
    try {
      const draft = (draftGraphDataRef.current || draftGraphData) as GraphData | null
      if (!draft) {
        upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const store = useGraphStore.getState()
      const registry = Array.isArray(store.widgetRegistry) ? store.widgetRegistry : []
      await exportWidgetBundleAsJson({
        graphData: draft,
        registryEntries: registry,
        suggestedName: 'flow-workflow.widget.bundle.json',
      })
      upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorRunExportedToast, ttlMs: 2200 })
    } catch {
      upsertUiToast({ id: 'flow-editor-export-bundle-failed', kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
    }
  }, [draftGraphData, upsertUiToast])

  const subgraphs = React.useMemo(() => readSubgraphs(baseGraphData), [baseGraphData])

  const createSubgraphFromSelection = React.useCallback(
    (args: { label?: string; kind?: 'subgraph' | 'cluster' }) => {
      const nodeIds = (selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
      const res = createUserSubgraph({
        label: args?.label,
        kind: args?.kind,
        memberNodeIds: nodeIds,
      })
      if (res.ok === false) {
        upsertUiToast({ id: 'flow-editor-subgraph-create-failed', kind: 'warning', message: res.message, ttlMs: 2500 })
        return
      }
      const gid = subgraphGroupId(res.id)
      if (gid) {
        setSelectionSource('canvas')
        selectNode(null)
        selectEdge(null)
        selectGroup(gid)
        setInspectorTab('groups')
      }
    },
    [createUserSubgraph, selectEdge, selectGroup, selectNode, selectedNodeIds, setSelectionSource, upsertUiToast],
  )

  const setSubgraphKind = React.useCallback(
    (id: string, kind: 'subgraph' | 'cluster') => {
      const res = updateUserSubgraph(id, { kind })
      if (res.ok === false) {
        upsertUiToast({ id: `flow-editor-subgraph-kind-failed-${String(id || '')}`, kind: 'warning', message: res.message, ttlMs: 2500 })
      }
    },
    [updateUserSubgraph, upsertUiToast],
  )

  const renameSubgraph = React.useCallback(
    (id: string, label: string) => {
      const res = updateUserSubgraph(id, { label })
      if (res.ok === false) {
        upsertUiToast({ id: `flow-editor-subgraph-rename-failed-${String(id || '')}`, kind: 'warning', message: res.message, ttlMs: 2500 })
      }
    },
    [updateUserSubgraph, upsertUiToast],
  )

  const setSubgraphParent = React.useCallback(
    (id: string, parentId: string | null) => {
      const res = updateUserSubgraph(id, { parentId })
      if (res.ok === false) {
        upsertUiToast({ id: `flow-editor-subgraph-parent-failed-${String(id || '')}`, kind: 'warning', message: res.message, ttlMs: 2500 })
      }
    },
    [updateUserSubgraph, upsertUiToast],
  )

  const deleteSubgraph = React.useCallback(
    (id: string) => {
      removeUserSubgraph(id)
    },
    [removeUserSubgraph],
  )

  const addSelectionToSubgraph = React.useCallback(
    (id: string) => {
      const nodeIds = (selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
      const res = addNodesToUserSubgraph(id, nodeIds)
      if (res.ok === false) {
        upsertUiToast({ id: `flow-editor-subgraph-add-failed-${String(id || '')}`, kind: 'warning', message: res.message, ttlMs: 2500 })
      }
    },
    [addNodesToUserSubgraph, selectedNodeIds, upsertUiToast],
  )

  const removeSelectionFromSubgraph = React.useCallback(
    (id: string) => {
      const nodeIds = (selectedNodeIds || []).map(v => String(v || '').trim()).filter(Boolean)
      const res = removeNodesFromUserSubgraph(id, nodeIds)
      if (res.ok === false) {
        upsertUiToast({ id: `flow-editor-subgraph-remove-failed-${String(id || '')}`, kind: 'warning', message: res.message, ttlMs: 2500 })
      }
    },
    [removeNodesFromUserSubgraph, selectedNodeIds, upsertUiToast],
  )

  const toggleSubgraphCollapsed = React.useCallback(
    (id: string) => {
      const gid = subgraphGroupId(id)
      if (!gid) return
      toggleGroupCollapsed(gid)
    },
    [toggleGroupCollapsed],
  )

  const selectSubgraph = React.useCallback(
    (id: string) => {
      const gid = subgraphGroupId(id)
      if (!gid) return
      setSelectionSource('canvas')
      selectNode(null)
      selectEdge(null)
      selectGroup(gid)
    },
    [selectEdge, selectGroup, selectNode, setSelectionSource],
  )

  const inspectorElement = (
    <FlowEditorInspector
      active={active}
      tab={inspectorTab}
      setTab={setInspectorTab}
      selectedNode={selectedDraftNode}
      selectedEdge={selectedDraftEdge}
      subgraphs={subgraphs}
      selectedNodeIds={selectedNodeIds}
      collapsedGroupIds={collapsedGroupIds}
      onCreateSubgraphFromSelection={createSubgraphFromSelection}
      onSetSubgraphKind={setSubgraphKind}
      onRenameSubgraph={renameSubgraph}
      onDeleteSubgraph={deleteSubgraph}
      onSetSubgraphParent={setSubgraphParent}
      onAddSelectionToSubgraph={addSelectionToSubgraph}
      onRemoveSelectionFromSubgraph={removeSelectionFromSubgraph}
      onToggleSubgraphCollapsed={toggleSubgraphCollapsed}
      onSelectSubgraph={selectSubgraph}
      workflowNodes={draftGraphData?.nodes || []}
      workflowSelectedNodeId={selectedNodeId}
      onWorkflowSelectNode={id => {
        setInspectorTab('node')
        setSelectionSource('canvas')
        selectEdge(null)
        selectNode(id)
      }}
      onWorkflowRunNode={runWorkflowNode}
      onWorkflowExportBundle={exportWorkflowBundle}
      jsonError={jsonError}
      nodePropsJson={nodePropsJson}
      setNodePropsJson={setNodePropsJson}
      nodeMetaJson={nodeMetaJson}
      setNodeMetaJson={setNodeMetaJson}
      edgePropsJson={edgePropsJson}
      setEdgePropsJson={setEdgePropsJson}
      edgeMetaJson={edgeMetaJson}
      setEdgeMetaJson={setEdgeMetaJson}
      workflowMetaJson={workflowMetaJson}
      setWorkflowMetaJson={setWorkflowMetaJson}
      workflowContextJson={workflowContextJson}
      setWorkflowContextJson={setWorkflowContextJson}
      onSetNodeLabel={setSelectedNodeLabel}
      onSetNodeType={setSelectedNodeType}
      onSetEdgeLabel={setSelectedEdgeLabel}
      onApplyJson={target => applyJsonToDraft({ target })}
    />
  )

  const lastStableOverlayEditorNodeIdsRef = React.useRef<string[]>([])
  React.useEffect(() => {
    if (!flowEditorViewActive) lastStableOverlayEditorNodeIdsRef.current = []
  }, [flowEditorViewActive])

  const overlayEditorNodeIds = React.useMemo(() => {
    if (!flowEditorViewActive) return []
    const isFrontmatterFlow = renderGraphDataOverride
      ? isFrontmatterFlowGraph(renderGraphDataOverride as unknown as GraphData)
      : false
    const metadata = ((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>)
    const nodes = Array.isArray(renderGraphDataOverride?.nodes) ? (renderGraphDataOverride?.nodes as GraphNode[]) : []
    const eligibleIds = buildFlowWidgetEligibleNodeIdSet(nodes)
    const nodeById = (() => {
      const m = new Map<string, GraphNode>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n?.id || '').trim()
        if (!id || m.has(id)) continue
        m.set(id, n)
      }
      return m
    })()
    const readNum = (v: unknown): number => {
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
      return typeof n === 'number' && Number.isFinite(n) ? n : 0
    }
    const compareByVisualIndex = (aId: string, bId: string): number => {
      if (!aId || !bId) return String(aId || '').localeCompare(String(bId || ''))
      if (aId === bId) return 0
      const readKey = (id: string) => {
        const n = nodeById.get(id)
        const props = (n?.properties || {}) as Record<string, unknown>
        const z = readNum(props['visual:zIndex'] ?? props['visual:depth'] ?? props['visual:layer'])
        const y = readNum(props['visual:yIndex'])
        const x = readNum(props['visual:xIndex'])
        return { z, y, x, id }
      }
      const a = readKey(aId)
      const b = readKey(bId)
      if (a.z !== b.z) return a.z - b.z
      if (a.y !== b.y) return a.y - b.y
      if (a.x !== b.x) return a.x - b.x
      return a.id.localeCompare(b.id)
    }
    if (isFrontmatterFlow && nodes.length > 0) {
      const registryRaw = metadata[FLOW_WIDGET_REGISTRY_METADATA_KEY]
      const registry = Array.isArray(registryRaw) ? (registryRaw as Array<Record<string, unknown>>) : []
      const allowedFlowNodeIds = new Set<string>()
      for (let i = 0; i < registry.length; i += 1) {
        const entry = registry[i]
        const formId = typeof entry?.formId === 'string' ? String(entry.formId).trim() : ''
        if (!formId || !formId.startsWith('fm:')) continue
        const nodeId = formId.slice('fm:'.length).trim()
        if (!nodeId) continue
        allowedFlowNodeIds.add(nodeId)
      }
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n?.id || '').trim()
        if (!id || !isCanonicalFrontmatterBuiltInWidgetNode(n)) continue
        allowedFlowNodeIds.add(id)
      }
      if (allowedFlowNodeIds.size === 0) {
        for (const id of eligibleIds) allowedFlowNodeIds.add(id)
      }
      if (allowedFlowNodeIds.size === 0) return []
      const next: string[] = []
      const seen = new Set<string>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n?.id || '').trim()
        if (!id || seen.has(id)) continue
        if (String(n?.type || '') === 'Section') continue
        if (!allowedFlowNodeIds.has(id)) continue
        seen.add(id)
        next.push(id)
      }
      const sorted = next.sort(compareByVisualIndex)
      if (sorted.length > 0) {
        lastStableOverlayEditorNodeIdsRef.current = sorted
        return sorted
      }
      return lastStableOverlayEditorNodeIdsRef.current
    }
    if (flowEditorFrontmatterGraphAvailable) return []
    const next: string[] = []
    const seen = new Set<string>()
    for (const rawId of openWidgetNodeIds) {
      const resolvedId = resolveGraphNodeIdByCanonicalId(renderGraphDataOverride as GraphData | null, rawId)
      const s = resolvedId || String(rawId || '').trim()
      if (!s || seen.has(s)) continue
      if (eligibleIds.size > 0 && !eligibleIds.has(s)) continue
      if (String(nodeById.get(s)?.type || '') === 'Section') continue
      seen.add(s)
      next.push(s)
    }
    const sel = String(overlayDraftNode?.id || '').trim()
    if (
      sel
      && !seen.has(sel)
      && (eligibleIds.size === 0 || eligibleIds.has(sel))
      && String(nodeById.get(sel)?.type || '') !== 'Section'
    ) {
      next.push(sel)
    }
    if (next.length > 0) lastStableOverlayEditorNodeIdsRef.current = next
    return next
  }, [flowEditorFrontmatterGraphAvailable, flowEditorViewActive, openWidgetNodeIds, overlayDraftNode?.id, renderGraphDataOverride, renderGraphDataOverride?.metadata, renderGraphDataOverride?.nodes])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as Window & { localStorage?: Storage; __KG_FLOW_EDITOR_QE_TRACE__?: Array<Record<string, unknown>> }
    let enabled = false
    try {
      enabled = Boolean(w.localStorage && w.localStorage.getItem('kg:debug:flowEditorWidgetTrace') === '1')
    } catch {
      enabled = false
    }
    if (!enabled) return

    const graphNodes = Array.isArray(renderGraphDataOverride?.nodes) ? renderGraphDataOverride.nodes.length : 0
    const graphEdges = Array.isArray(renderGraphDataOverride?.edges) ? renderGraphDataOverride.edges.length : 0
    const entry: Record<string, unknown> = {
      ts: Date.now(),
      doc: activeDocumentKey,
      active: active ? 1 : 0,
      view: flowEditorViewActive ? 1 : 0,
      frontmatterOnlyPolicyActive: frontmatterOnlyPolicyActive ? 1 : 0,
      frontmatterGraph: flowEditorFrontmatterGraphAvailable ? 1 : 0,
      graphNodes,
      graphEdges,
      openWidgetCount: Array.isArray(openWidgetNodeIds) ? openWidgetNodeIds.length : 0,
      overlayCount: overlayEditorNodeIds.length,
      overlayIdsHead: overlayEditorNodeIds.slice(0, 8).join(','),
    }
    const buf = Array.isArray(w.__KG_FLOW_EDITOR_QE_TRACE__) ? w.__KG_FLOW_EDITOR_QE_TRACE__ : []
    buf.push(entry)
    if (buf.length > 150) buf.splice(0, buf.length - 150)
    w.__KG_FLOW_EDITOR_QE_TRACE__ = buf
  }, [
    active,
    activeDocumentKey,
    flowEditorFrontmatterGraphAvailable,
    flowEditorViewActive,
    frontmatterOnlyPolicyActive,
    openWidgetNodeIds,
    overlayEditorNodeIds,
    renderGraphDataOverride?.edges,
    renderGraphDataOverride?.nodes,
  ])

  const seededFrontmatterAutoWidgetsKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!editorRuntimeActive) return
    if (!renderGraphDataOverride) return
    if (!isFrontmatterFlowGraph(renderGraphDataOverride as unknown as GraphData)) return
    if (overlayEditorNodeIds.length === 0) return

    const st = useGraphStore.getState()
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const hasAnyExplicit = overlayEditorNodeIds.some(id => Object.prototype.hasOwnProperty.call(pinnedById, id))
    const seedKey = `${baseGraphDataRevision}|${overlayEditorNodeIds.join(',')}|${hasAnyExplicit ? 1 : 0}`
    if (seededFrontmatterAutoWidgetsKeyRef.current === seedKey) return
    seededFrontmatterAutoWidgetsKeyRef.current = seedKey
    if (hasAnyExplicit) return

    const nextPinned = { ...pinnedById }
    let changed = false
    for (let i = 0; i < overlayEditorNodeIds.length; i += 1) {
      const id = overlayEditorNodeIds[i]
      if (!id) continue
      if (Object.prototype.hasOwnProperty.call(nextPinned, id)) continue
      nextPinned[id] = false
      changed = true
    }
    if (!changed) return
    st.setFlowWidgetPinnedByNodeId(nextPinned)
    scheduleOverlayCollisionResolve()
  }, [baseGraphDataRevision, editorRuntimeActive, overlayEditorNodeIds, renderGraphDataOverride?.metadata, scheduleOverlayCollisionResolve])

  const seededGeospatialOverlayWidgetPinsKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!geospatialWidgetPanelMode) return
    if (overlayEditorNodeIds.length === 0) return
    const st = useGraphStore.getState()
    const pinnedById = st.flowWidgetPinnedByNodeId || {}
    const missingIds = overlayEditorNodeIds.filter(id => id && !Object.prototype.hasOwnProperty.call(pinnedById, id))
    const seedKey = `${overlayEditorNodeIds.join(',')}|${missingIds.join(',')}`
    if (seededGeospatialOverlayWidgetPinsKeyRef.current === seedKey) return
    seededGeospatialOverlayWidgetPinsKeyRef.current = seedKey
    if (missingIds.length === 0) return
    const nextPinned = { ...pinnedById }
    for (let i = 0; i < missingIds.length; i += 1) {
      nextPinned[missingIds[i]!] = false
    }
    st.setFlowWidgetPinnedByNodeId(nextPinned)
    scheduleOverlayCollisionResolve()
  }, [geospatialWidgetPanelMode, overlayEditorNodeIds, scheduleOverlayCollisionResolve])

  const connectedValuesByNodeId = React.useMemo(() => {
    const targetNodeIds = new Set(overlayEditorNodeIds)
    return computeFlowConnectedValuesBySchemaPath({
      graphData: renderGraphDataOverride,
      registry: Array.isArray(widgetRegistry) ? widgetRegistry : [],
      targetNodeIds,
    })
  }, [widgetRegistry, overlayEditorNodeIds, renderGraphDataOverride])

  const overlayEditorElements = React.useMemo(() => {
    if (!flowEditorViewActive) return []
    const edges = (renderGraphDataOverride?.edges || []) as GraphEdge[]
    const nodes = Array.isArray(renderGraphDataOverride?.nodes) ? (renderGraphDataOverride?.nodes as GraphNode[]) : []
    const nodeById = new Map<string, GraphNode>()
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const id = String(n?.id || '').trim()
      if (!id) continue
      if (!nodeById.has(id)) nodeById.set(id, n)
    }
    const graphMetaKind = String(((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim() || null
    const forcePinnedToCanvas = !geospatialWidgetPanelMode
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
        const connectedValuesBySchemaPath = connectedValuesByNodeId.get(id) || undefined
        return (
          <FlowEditorWidgetOverlay
            key={`qe-${id}`}
            visible={flowEditorViewActive}
            active={canEdit}
            node={node}
            graphMetaKind={graphMetaKind}
            edges={edges}
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
            forcePinnedToCanvas={forcePinnedToCanvas}
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
              void runWorkflowNode(id)
            }}
            onDuplicate={() => {
              const pinnedMap = flowWidgetPinnedByNodeId || {}
              const pinned = forcePinnedToCanvas === true || pinnedMap[id] === true
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
                graphMetaKind: graphMetaKindRef.current,
              })
              const widgetTypeId = typeof node.properties?.[FLOW_WIDGET_TYPE_ID_KEY] === 'string'
                ? String(node.properties[FLOW_WIDGET_TYPE_ID_KEY] || '').trim()
                : ''
              const formId = typeof node.properties?.[FLOW_WIDGET_FORM_ID_KEY] === 'string'
                ? String(node.properties[FLOW_WIDGET_FORM_ID_KEY] || '').trim()
                : ''
              const searchQuery = [
                String(resolvedWidgetRegistryEntry?.id || '').trim(),
                String(node.type || '').trim(),
                widgetTypeId,
                formId,
              ].filter(Boolean).join(' ')
              const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
              window.dispatchEvent(new CustomEventCtor(MAIN_PANEL_OPEN_EVENT, {
                detail: {
                  tab: 'workflowManager' as const,
                  workflowManagerTab: 'mapping' as const,
                  searchQuery,
                },
              }))
            }}
            onPinnedInCanvasChange={(pinnedInCanvas) => {
              void pinnedInCanvas
              scheduleOverlayCollisionResolve()
            }}
            onRenameSchemaFieldId={({ prevId, nextId }) => renameSchemaFieldIdByNodeId(id, prevId, nextId)}
          />
        )
      })
      .filter(Boolean)
  }, [
    canEdit,
    flowEditorViewActive,
    beginAddEdgeFromNode,
    canvasWindowOffset,
    clearNodeOutputById,
    convertNodeToLoopById,
    connectedValuesByNodeId,
    duplicateNodeById,
    enableHandlesForAllInputs,
    finalizePendingEdge,
    geospatialWidgetPanelMode,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    getLiveContainmentGroupAabbForNode,
    lastDroppedWidgetToken,
    overlayEditorNodeIds,
    patchNodePropertiesById,
    pendingEdgeSourceId,
    pendingOverlayNode,
    flowWidgetPinnedByNodeId,
    removeNodeById,
    renameSchemaFieldIdByNodeId,
    runWorkflowNode,
    scheduleOverlayCollisionResolve,
    setNodeLabelById,
    setNodePropertiesById,
    setNodeTypeById,
    showNodeEditorHelp,
    upsertUiToast,
    toolMode,
    validateNodeById,
    viewportH,
    viewportW,
    zoomViewKey,
    renderGraphDataOverride?.edges,
    renderGraphDataOverride?.nodes,
  ])

  const hasOverlayEditors = overlayEditorElements.length > 0
  const frontmatterOverlayHideSafety = React.useMemo(() => {
    const kind = String(((renderGraphDataOverride?.metadata || {}) as Record<string, unknown>).kind || '').trim()
    if (kind !== 'frontmatter-flow') {
      return { kind, visibleNodeIds: [] as string[], hasFullOverlayCoverageForVisibleNodes: true }
    }
    const display = deriveSceneDisplayGraph({ graphData: renderGraphDataOverride })
    const visibleNodeIds = Array.isArray(display?.displayNodes)
      ? display!.displayNodes
        .map(n => String(n?.id || '').trim())
        .filter(Boolean)
      : []
    const eligibleIds = buildFlowWidgetEligibleNodeIdSet(
      Array.isArray(renderGraphDataOverride?.nodes) ? (renderGraphDataOverride.nodes as GraphNode[]) : [],
    )
    const overlayIdSet = new Set(overlayEditorNodeIds)
    const visibleFlowNodeIds = visibleNodeIds.filter(id => eligibleIds.size === 0 || eligibleIds.has(id))
    const hasFullOverlayCoverageForVisibleNodes = visibleFlowNodeIds.every(id => overlayIdSet.has(id))
    return { kind, visibleNodeIds: visibleFlowNodeIds, hasFullOverlayCoverageForVisibleNodes }
  }, [overlayEditorNodeIds, renderGraphDataOverride])
  const overlayOnlySafeForCurrentView =
    frontmatterOverlayHideSafety.kind !== 'frontmatter-flow' || frontmatterOverlayHideSafety.hasFullOverlayCoverageForVisibleNodes
  const overlayOnlyActive = overlayOnlyModeEnabled && overlayOnlySafeForCurrentView && (hasOverlayEditors || geospatialWidgetPanelMode)
  const overlayOnlyHidePortHandleNodeIds = React.useMemo(() => {
    if (!overlayOnlyActive) return undefined
    const nodes = Array.isArray(renderGraphDataOverride?.nodes) ? renderGraphDataOverride?.nodes : []
    return nodes.map(n => String((n as { id?: unknown })?.id || '')).filter(Boolean)
  }, [overlayOnlyActive, renderGraphDataOverride?.nodes])
  const noGraphLoaded = !renderGraphDataOverride

  return (
    <section
      ref={rootRef}
      className={`absolute inset-0 z-0 ${geospatialWidgetPanelMode ? 'pointer-events-none' : ''}`}
      aria-label="Flow Editor"
      onDragOverCapture={(ev) => {
        if (geospatialWidgetPanelMode) return
        if (!canEdit) return
        ev.preventDefault()
        try {
          ev.dataTransfer.dropEffect = 'copy'
        } catch {
          void 0
        }
      }}
      onDropCapture={(ev) => {
        if (geospatialWidgetPanelMode) return
        if (!canEdit) return
        const payload = readFlowWidgetDragPayloadFromDataTransfer({ getData: mime => ev.dataTransfer.getData(mime) })
        if (!payload) return
        const entry = (widgetRegistry || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
        if (!entry) return
        const el = rootRef.current
        const rect = el ? el.getBoundingClientRect() : null
        if (!rect) return
        setCanvasWindowOffsetFromRect(rect)
        const sx = ev.clientX - rect.left
        const sy = ev.clientY - rect.top
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
        if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
        const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
        if (shouldDedupeWidgetDrop(dropKey)) {
          ev.preventDefault()
          ev.stopPropagation()
          return
        }
        const st = useGraphStore.getState()
        const liveZoom = getLiveZoomTransform()
        const pos = screenToWorld({
          transform:
            liveZoom ||
            getEffectiveZoomStateForKey({
              zoomViewKey: zoomViewKeyRef.current,
              zoomStateByKey: st.zoomStateByKey,
              zoomState: st.zoomState,
            }),
          sx,
          sy,
        })
        addNodeFromRegistryAtWorld({ entry, x: pos.x, y: pos.y })
        upsertUiToast({
          id: 'flow-editor-drop-widget',
          kind: 'neutral',
          message: `Created ${entry.nodeTypeId} node.`,
          ttlMs: 1500,
        })
        ev.preventDefault()
        ev.stopPropagation()
      }}
    >
      <FlowCanvas
        active={active}
        allowNodeDragOverride={canEdit}
        graphDataOverride={renderGraphDataOverride}
        graphDataRevisionOverride={flowEditorViewActive ? draftGraphDataRevision : baseGraphDataRevision}
        exposeRuntimeRef={ref => {
          flowRuntimeRefRef.current = ref
        }}
        onInteractionFrame={hasOverlayEditors ? emitFlowEditorInteractionFrame : undefined}
        renderEdges={overlayOnlyActive ? false : true}
        renderGroups={geospatialWidgetPanelMode ? false : true}
        renderNodes={overlayOnlyActive ? false : true}
        hidePortHandleNodeIds={overlayOnlyHidePortHandleNodeIds}
        excludeRichMediaOverlayNodeIds={overlayEditorNodeIds}
      />

      {overlayOnlyActive && (
        <svg
          ref={overlayEdgesSvgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 120, color: 'var(--kg-canvas-edge-stroke)', overflow: 'visible' }}
          aria-hidden={true}
        />
      )}

      {overlayEditorElements as unknown as React.ReactNode}

      {noGraphLoaded && !geospatialWidgetPanelMode && (
        <aside className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Status">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>No graph loaded.</p>
          </section>
        </aside>
      )}

      {!hasOverlayEditors && toolMode === 'addEdge' && canEdit && (
        <aside className="absolute top-16 left-3 z-[220]" aria-label="Add edge hint">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>
              {pendingEdgeSourceId ? `Select target node (from ${pendingEdgeSourceId}).` : 'Select source node.'}
            </p>
          </section>
        </aside>
      )}

      {inspectorPortalHost ? createPortal(inspectorElement, inspectorPortalHost) : null}
    </section>
  )
}
