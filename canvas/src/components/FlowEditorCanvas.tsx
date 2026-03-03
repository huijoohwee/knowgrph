import React from 'react'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useShallow } from 'zustand/react/shallow'

import FlowCanvas from '@/components/FlowCanvas'
import FlowEditorInspector, { type InspectorTab } from '@/components/FlowEditor/FlowEditorInspector'
import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { coerceJsonObject, safeJsonStringify, tryParseJson } from '@/components/FlowEditor/flowEditorJson'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import { createUniqueId } from '@/lib/ids'
import { normalizeGraphData } from '@/lib/graph/normalize'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import {
  FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID,
  FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  LS_KEYS,
  UI_COPY,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { screenToWorld, viewportCenterToWorld, worldToScreen } from '@/lib/zoom/viewport'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
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
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  FLOW_EDGE_DISPLAY_LABEL_KEY,
  FLOW_SCHEMA_FIELDS_PROPERTY_KEY,
  buildSchemaFieldPortKey,
  buildFlowEdgeDisplayLabelFromPorts,
  pickDefaultSchemaFieldPortKey,
} from '@/lib/graph/flowPorts'
import { resolveFlowSocketTypesForEdge } from '@/lib/graph/flowSocketTypes'
import { canAddEdge } from '@/features/schema/validation'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY, FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { hasFlowNodeQuickEditorDragType, readFlowNodeQuickEditorDragPayloadFromDataTransfer } from '@/lib/flowEditor/nodeQuickEditorDrag'
import { buildSelectionSubgraph, exportNodeQuickEditorBundleAsJson } from '@/lib/graph/file'
import { clampOverlayTopLeftFullyInViewport } from '@/lib/ui/overlayClamp'
import { Z_INDEX_FLOATING_PANEL_DEFAULT } from '@/lib/ui/zIndex'
import { computeNodeQuickEditorScale, computeNodeQuickEditorScaledSize } from '@/components/FlowEditor/nodeQuickEditorZoom'
import { computeNodeQuickEditorMaxAnchorShiftPx } from '@/components/FlowEditor/nodeQuickEditorLayout'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { readFlowLayoutKnobs } from '@/lib/graph/layoutDefaults'
import { relaxOverlayPanelsWithCollision } from '@/components/FlowCanvas/relaxOverlayPanels'
import { buildFlowHandleId, computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'
import { FLOW_EDITOR_INTERACTION_FRAME_EVENT, FLOW_EDITOR_OVERLAY_ROOT_SELECTOR } from '@/lib/canvas/flow-editor-overlay-proxy'
import { readSubgraphs, subgraphGroupId } from '@/lib/graph/subgraphs'

type ToolMode = 'select' | 'addEdge'

const OVERLAY_NODE_OVERRIDE_LOCK_MS = 4000
const QUICK_EDITOR_DROP_DEDUPE_WINDOW_MS = 250
const FORCE_SELECT_TICK_MS = 30
const FORCE_SELECT_MAX_TICKS = 80
const DROP_DEBUG_TOAST_TTL_MS = 3500

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

const FlowEditorNodeQuickEditorOverlay = React.memo(function FlowEditorNodeQuickEditorOverlay(args: {
  active: boolean
  node: GraphNode
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
  toolMode: ToolMode
  pendingEdgeSourceId: string | null
  onBeginAddEdgeFromNode: (nodeId: string, portKey?: string | null) => void
  onFinalizeAddEdgeToNode: (nodeId: string, portKey?: string | null) => void
  onSetLabel: (label: string) => void
  onSetType: (type: string) => void
  onPatchProperties: (patch: Record<string, unknown>) => void
  onSetProperties: (properties: Record<string, unknown>) => void
  onValidate: () => void
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
      active={args.active}
      node={args.node}
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
      onSetLabel={args.onSetLabel}
      onSetType={args.onSetType}
      onPatchProperties={args.onPatchProperties}
      onSetProperties={args.onSetProperties}
      onValidate={args.onValidate}
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

export default function FlowEditorCanvas({ active = true }: { active?: boolean }) {
  const rootRef = React.useRef<HTMLElement | null>(null)
  const { width, height } = useContainerDims(rootRef)
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
    if (!active) return
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
  }, [active])

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
    })),
  )
  const selectedNodeId = useGraphStore(s => (typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null))
  const selectedNodeIds = useGraphStore(s => (Array.isArray(s.selectedNodeIds) ? s.selectedNodeIds : []))
  const selectedEdgeId = useGraphStore(s => (typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null))
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const selectGroup = useGraphStore(s => s.selectGroup)
  const setGraphDataPreservingLayout = useGraphStore(s => s.setGraphDataPreservingLayout)
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

  const zoomViewKey = React.useMemo(() => {
    return buildActive2dZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schema,
      graphData: (baseGraphData || null) as GraphData | null,
      documentSemanticMode,
      frontmatterModeEnabled,
      documentStructureBaselineLock,
      renderMediaAsNodes,
      mediaPanelDensity,
      collapsedGroupIds,
    })
  }, [
    baseGraphData,
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    schema,
  ])

  const zoomViewKeyRef = React.useRef<string | null>(zoomViewKey)
  React.useEffect(() => {
    zoomViewKeyRef.current = zoomViewKey
  }, [zoomViewKey])

  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const nodeQuickEditorRegistry = useGraphStore(s => s.effectiveNodeQuickEditorRegistry || [])
  const nodeQuickEditorRegistryRef = React.useRef(nodeQuickEditorRegistry)
  const lastQuickEditorDropRef = React.useRef<{ key: string; ts: number } | null>(null)
  const lastDroppedQuickEditorNodeIdRef = React.useRef<string | null>(null)
  const [lastDroppedQuickEditorToken, setLastDroppedQuickEditorToken] = React.useState<number>(0)

  const openQuickEditorNodeIds = useGraphStore(s => s.openQuickEditorNodeIds || [])
  const openQuickEditorNodeIdsRef = React.useRef(openQuickEditorNodeIds)
  const updateOpenQuickEditorNodeIds = useGraphStore(s => s.updateOpenQuickEditorNodeIds)
  const setOpenQuickEditorNodeIds = useGraphStore(s => s.setOpenQuickEditorNodeIds)

  React.useEffect(() => {
    openQuickEditorNodeIdsRef.current = openQuickEditorNodeIds
  }, [openQuickEditorNodeIds])

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
  const pendingSelectNodeIdRef = React.useRef<string | null>(null)
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

  React.useEffect(() => {
    if (!active) return
    const base = baseGraphData as GraphData | null
    setDraftGraphData(prev => (prev === base ? prev : base))
  }, [active, baseGraphData, baseGraphDataRevision])

  const overlayOnlyModeEnabled = React.useMemo(() => {
    return Array.isArray(nodeQuickEditorRegistry) && nodeQuickEditorRegistry.length > 0
  }, [nodeQuickEditorRegistry])

  const overlayOnlyHidePortHandleNodeIds = React.useMemo(() => {
    if (!overlayOnlyModeEnabled) return undefined
    const nodes = Array.isArray(draftGraphData?.nodes) ? draftGraphData?.nodes : []
    return nodes.map(n => String((n as { id?: unknown })?.id || '')).filter(Boolean)
  }, [draftGraphData?.nodes, overlayOnlyModeEnabled])

  const overlayCollisionResolveRafRef = React.useRef<number | null>(null)
  const overlayCollisionResolveKeyRef = React.useRef<string>('')
  const overlayRectCacheRef = React.useRef<Map<string, { left: number; top: number; width: number; height: number }>>(new Map())
  const overlayCollisionIterKeyRef = React.useRef<string>('')
  const overlayCollisionIterCountRef = React.useRef<number>(0)
  const overlayCollisionWarmupStartedAtMsRef = React.useRef<number | null>(null)
  const overlayCollisionWarmupAttemptsRef = React.useRef<number>(0)
  const overlayCollisionZoomDebounceRef = React.useRef<number | null>(null)
  const overlayCollisionLastZoomKRef = React.useRef<number | null>(null)

  const scheduleOverlayCollisionResolve = React.useCallback(() => {
    if (!active) return
    if (typeof document === 'undefined') return
    if (typeof window === 'undefined') return
    if (overlayCollisionResolveRafRef.current != null) return
    if (overlayCollisionWarmupStartedAtMsRef.current == null) overlayCollisionWarmupStartedAtMsRef.current = Date.now()

    overlayCollisionResolveRafRef.current = window.requestAnimationFrame(() => {
      overlayCollisionResolveRafRef.current = null
      if (!active) return

      const overlayEls = Array.from(document.querySelectorAll<HTMLElement>(FLOW_EDITOR_OVERLAY_ROOT_SELECTOR))
      if (overlayEls.length < 2) {
        const st = useGraphStore.getState()
        const wantsResolve = (st.openQuickEditorNodeIds || []).length >= 2 || overlayOnlyModeEnabled
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

      const overlayNodeIds = (() => {
        const next: string[] = []
        const seen = new Set<string>()
        for (let i = 0; i < overlayEls.length; i += 1) {
          const id = String(overlayEls[i]?.dataset?.kgNodeQuickEditor || '').trim()
          if (!id || seen.has(id)) continue
          seen.add(id)
          next.push(id)
        }
        return next.sort((a, b) => a.localeCompare(b))
      })()
      if (overlayNodeIds.length < 2) return

      const st = useGraphStore.getState()
      if (st.flowNodeQuickEditorDraggingNodeId) return
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
        const offset = canvasWindowOffsetRef.current
        if (typeof window === 'undefined') return { width: viewportW, height: viewportH }
        const w =
          (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientWidth : null) ??
          window.innerWidth
        const h =
          (typeof document !== 'undefined' && document.documentElement ? document.documentElement.clientHeight : null) ??
          window.innerHeight
        return {
          width: Math.max(1, Math.floor((Number.isFinite(w) ? (w as number) : viewportW) - offset.left)),
          height: Math.max(1, Math.floor((Number.isFinite(h) ? (h as number) : viewportH) - offset.top)),
        }
      })()
      const key = `${overlayNodeIds.join(',')}|${zKey}|${overlayViewport.width}x${overlayViewport.height}|${overlayOnlyModeEnabled ? 1 : 0}`
      if (overlayCollisionResolveKeyRef.current === key) return
      overlayCollisionResolveKeyRef.current = key
      if (overlayCollisionIterKeyRef.current !== key) {
        overlayCollisionIterKeyRef.current = key
        overlayCollisionIterCountRef.current = 0
      }

      const schemaCur = schema
      const panelScale = computeNodeQuickEditorScale(zoomK, null, { mode: 'pinnedInCanvas' })
      const floatingScaled = computeNodeQuickEditorScaledSize(panelScale)

      const pinnedById = st.flowNodeQuickEditorPinnedByNodeId || {}
      const posById = st.flowNodeQuickEditorPosByNodeId || {}

      const forcePinnedToCanvas = false
      const isPinnedInCanvas = (id: string): boolean => {
        if (forcePinnedToCanvas) return true
        const v = pinnedById[id]
        return typeof v === 'boolean' ? v : true
      }

      const rectByNodeId = (() => {
        const canvasOffset = canvasWindowOffsetRef.current
        const m = new Map<string, { left: number; top: number; width: number; height: number }>()
        for (let i = 0; i < overlayEls.length; i += 1) {
          const el = overlayEls[i]
          const id = String(el.dataset.kgNodeQuickEditor || '').trim()
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
        return Math.max(0, Math.min(40, Math.floor(base)))
      })()

      const unpinnedCount = overlayNodeIds.reduce((acc, id) => {
        if (!id) return acc
        const locked = isPinnedInCanvas(id)
        return locked ? acc : acc + 1
      }, 0)

      const cellSize = {
        width: typicalSize.width + gapPx,
        height: Math.round(typicalSize.height * 0.76) + gapPx,
      }

      const marginLeft = 20
      const marginRight = 20
      const marginTop = 96
      const marginBottom = 24
      const rowsMax = Math.max(1, Math.floor((overlayViewport.height - marginTop - marginBottom) / Math.max(1, cellSize.height)))
      const colsNeeded = Math.max(1, Math.ceil(Math.max(1, unpinnedCount) / rowsMax))
      const colsMax = Math.max(1, Math.min(3, Math.floor((overlayViewport.width - marginLeft - marginRight) / Math.max(1, cellSize.width))))
      const dockCols = Math.max(1, Math.min(colsNeeded, colsMax))
      const dockWidth = dockCols * cellSize.width - gapPx
      const dockLeft = Math.max(marginLeft, overlayViewport.width - marginRight - dockWidth)
      const dockTop = marginTop

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
          const okX = left >= marginLeft - 12 && left <= overlayViewport.width - marginRight - 12
          const okY = top >= marginTop - 12 && top <= overlayViewport.height - marginBottom - 12
          return okX && okY ? (stored as { top: number; left: number }) : fallback
        })()
        const clamped = clampOverlayTopLeftFullyInViewport({
          pos: base,
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
          const clamped = clampOverlayTopLeftFullyInViewport({
            pos: { top: it.top, left: it.left },
            size: { width: it.width, height: it.height },
            viewport: { width: overlayViewport.width, height: overlayViewport.height },
            snapPx: 1,
          })
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
        const knobs = readFlowLayoutKnobs({ schema: schemaCur, rankdir: 'TB' })
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
              maxAnchorShiftPx: computeNodeQuickEditorMaxAnchorShiftPx(overlayViewport.width, overlayViewport.height),
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
                maxAnchorShiftPx: computeNodeQuickEditorMaxAnchorShiftPx(overlayViewport.width, overlayViewport.height),
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
      st.setFlowNodeQuickEditorPosByNodeId(next)

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
    active,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    overlayOnlyModeEnabled,
    schema,
    selectedNodeId,
    viewportH,
    viewportW,
  ])

  React.useEffect(() => {
    if (!active) return
    scheduleOverlayCollisionResolve()
  }, [active, openQuickEditorNodeIds, overlayOnlyModeEnabled, scheduleOverlayCollisionResolve, viewportH, viewportW])

  React.useEffect(() => {
    if (!active) return
    if (typeof window === 'undefined') return
    const onInteractionFrame = () => {
      const live = getLiveZoomTransform()
      const k = typeof live?.k === 'number' && Number.isFinite(live.k) ? live.k : null
      if (k == null) return
      const prev = overlayCollisionLastZoomKRef.current
      overlayCollisionLastZoomKRef.current = k
      if (prev != null && Math.abs(prev - k) < 1e-6) return
      if (overlayCollisionZoomDebounceRef.current != null) {
        try {
          window.clearTimeout(overlayCollisionZoomDebounceRef.current)
        } catch {
          void 0
        }
      }
      overlayCollisionZoomDebounceRef.current = window.setTimeout(() => {
        overlayCollisionZoomDebounceRef.current = null
        scheduleOverlayCollisionResolve()
      }, 120)
    }
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)
    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)
      } catch {
        void 0
      }
      if (typeof window !== 'undefined' && overlayCollisionZoomDebounceRef.current != null) {
        try {
          window.clearTimeout(overlayCollisionZoomDebounceRef.current)
        } catch {
          void 0
        }
        overlayCollisionZoomDebounceRef.current = null
      }
    }
  }, [active, getLiveZoomTransform, scheduleOverlayCollisionResolve])

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
  const overlayEdgeRafRef = React.useRef<number | null>(null)

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
        return
      }

      const rawNodes = Array.isArray(graph.nodes) ? (graph.nodes as Array<{ id?: unknown; type?: unknown; properties?: unknown }>) : []
      const rawEdges = Array.isArray(graph.edges)
        ? (graph.edges as Array<{ id?: unknown; source?: unknown; target?: unknown; type?: unknown; properties?: unknown }>)
        : []

      const socketStyleByType = (() => {
        const meta = (graph.metadata || {}) as Record<string, unknown>
        const st = meta.socketTypes
        if (!isRecord(st)) return new Map<string, { color: string; edgeWidthPx: number | null }>()
        const m = new Map<string, { color: string; edgeWidthPx: number | null }>()
        for (const k of Object.keys(st)) {
          const spec = st[k]
          if (!isRecord(spec)) continue
          const color = pickString(spec.color)
          if (!color) continue
          const edgeWidthPx = typeof spec.edgeWidthPx === 'number' && Number.isFinite(spec.edgeWidthPx) ? spec.edgeWidthPx : null
          m.set(String(k || ''), { color, edgeWidthPx })
        }
        return m
      })()

      const overlayIdSet = (() => {
        const ids = Array.isArray(openQuickEditorNodeIdsRef.current) ? openQuickEditorNodeIdsRef.current : []
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

      const edges: Array<{ id: unknown; source: unknown; target: unknown; type?: unknown; properties?: unknown }> = []
      for (let i = 0; i < rawEdges.length; i += 1) {
        const id = String(rawEdges[i]?.id || '').trim()
        const source = String(rawEdges[i]?.source || '').trim()
        const target = String(rawEdges[i]?.target || '').trim()
        if (!id || !source || !target) continue
        if (!overlayIdSet.has(source) || !overlayIdSet.has(target)) continue
        edges.push({ id, source, target, type: rawEdges[i]?.type, properties: rawEdges[i]?.properties })
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
        return
      }

      const overlayRectsByNodeId = (() => {
        if (typeof document === 'undefined') return new Map<string, DOMRect>()
        const esc = (v: string) => {
          const raw = String(v || '')
          const fn = (globalThis as unknown as { CSS?: { escape?: (x: string) => string } }).CSS?.escape
          if (typeof fn === 'function') return fn(raw)
          return raw.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
        }
        const ids = Array.isArray(openQuickEditorNodeIdsRef.current) ? openQuickEditorNodeIdsRef.current : []
        const m = new Map<string, DOMRect>()
        for (let i = 0; i < ids.length; i += 1) {
          const id = String(ids[i] || '').trim()
          if (!id || !nodeIds.has(id)) continue
          const el = document.querySelector<HTMLElement>(`${FLOW_EDITOR_OVERLAY_ROOT_SELECTOR}[data-kg-node-quick-editor="${esc(id)}"]`)
          if (!el) continue
          m.set(id, el.getBoundingClientRect())
        }
        const sel = String(pendingOverlayNodeIdRef.current || '').trim()
        if (sel && nodeIds.has(sel) && !m.has(sel)) {
          const el = document.querySelector<HTMLElement>(`${FLOW_EDITOR_OVERLAY_ROOT_SELECTOR}[data-kg-node-quick-editor="${esc(sel)}"]`)
          if (el) m.set(sel, el.getBoundingClientRect())
        }
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
        return
      }

      const handlesByNodeId = computeFlowHandlesByNode({
        nodes,
        edges,
        nodeQuickEditorRegistry: Array.isArray(nodeQuickEditorRegistryRef.current) ? nodeQuickEditorRegistryRef.current : null,
      })

      const topPctByNodeAndHandle = new Map<string, Map<string, number>>()
      for (const [id, handles] of Object.entries(handlesByNodeId)) {
        const m = new Map<string, number>()
        for (let i = 0; i < (handles.in || []).length; i += 1) m.set(handles.in[i].id, handles.in[i].topPct)
        for (let i = 0; i < (handles.out || []).length; i += 1) m.set(handles.out[i].id, handles.out[i].topPct)
        topPctByNodeAndHandle.set(id, m)
      }

      const rootRect = root.getBoundingClientRect()
      const baseLeft = Number.isFinite(rootRect.left) ? rootRect.left : null
      const baseTop = Number.isFinite(rootRect.top) ? rootRect.top : null
      if (baseLeft == null || baseTop == null) return
      const keep = new Set<string>()

      for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i]
        const edgeId = String(e?.id || '').trim()
        const source = String(e?.source || '').trim()
        const target = String(e?.target || '').trim()
        if (!edgeId || !source || !target) continue

        const sRect = overlayRectsByNodeId.get(source)
        const tRect = overlayRectsByNodeId.get(target)
        if (!sRect || !tRect) continue

        const props = e.properties
        const sourcePortKey =
          props && typeof props === 'object' && !Array.isArray(props) && typeof (props as Record<string, unknown>)[FLOW_EDGE_SOURCE_PORT_KEY] === 'string'
            ? String((props as Record<string, unknown>)[FLOW_EDGE_SOURCE_PORT_KEY] || '').trim()
            : ''
        const targetPortKey =
          props && typeof props === 'object' && !Array.isArray(props) && typeof (props as Record<string, unknown>)[FLOW_EDGE_TARGET_PORT_KEY] === 'string'
            ? String((props as Record<string, unknown>)[FLOW_EDGE_TARGET_PORT_KEY] || '').trim()
            : ''

        const edgeTypeFromEdge = pickString(e.type)
        const edgeTypeFromProps =
          props && typeof props === 'object' && !Array.isArray(props) && typeof (props as Record<string, unknown>)['flow:socketType'] === 'string'
            ? String((props as Record<string, unknown>)['flow:socketType'] || '').trim()
            : ''
        const edgeSocketType = edgeTypeFromEdge || edgeTypeFromProps
        const style = edgeSocketType ? socketStyleByType.get(edgeSocketType) || null : null
        const stroke = style?.color || 'currentColor'
        const strokeWidth = style?.edgeWidthPx != null ? String(style.edgeWidthPx) : '1.5'

        const outHandleId = buildFlowHandleId({ dir: 'out', edgeId: sourcePortKey || edgeId })
        const inHandleId = buildFlowHandleId({ dir: 'in', edgeId: targetPortKey || edgeId })
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

        const sx = sRight - baseLeft
        const tx = tLeft - baseLeft
        const sy = sTop - baseTop + (Math.max(0, Math.min(100, sPct)) / 100) * sHeight
        const ty = tTop - baseTop + (Math.max(0, Math.min(100, tPct)) / 100) * tHeight
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) continue

        const dx = tx - sx
        const c = 0.5
        const c1x = sx + dx * c
        const c1y = sy
        const c2x = tx - dx * c
        const c2y = ty
        const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}`
        keep.add(edgeId)
        const existing = overlayEdgePathByIdRef.current.get(edgeId) || null
        const pathEl = existing || document.createElementNS('http://www.w3.org/2000/svg', 'path')
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
    })
  }, [active, overlayOnlyModeEnabled])

  React.useEffect(() => {
    if (!active) return
    if (!overlayOnlyModeEnabled) return
    scheduleOverlayEdgeUpdate()
    const onInteractionFrame = () => scheduleOverlayEdgeUpdate()
    window.addEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)

    const onAny = () => scheduleOverlayEdgeUpdate()
    window.addEventListener('resize', onAny)
    window.addEventListener('scroll', onAny, true)

    return () => {
      try {
        window.removeEventListener(FLOW_EDITOR_INTERACTION_FRAME_EVENT, onInteractionFrame as EventListener)
      } catch {
        void 0
      }
      window.removeEventListener('resize', onAny)
      window.removeEventListener('scroll', onAny, true)
      for (const el of overlayEdgePathByIdRef.current.values()) {
        try {
          el.remove()
        } catch {
          void 0
        }
      }
      overlayEdgePathByIdRef.current.clear()
    }
  }, [active, overlayOnlyModeEnabled, scheduleOverlayEdgeUpdate])


  React.useEffect(() => {
    if (!active) return
    if (!overlayOnlyModeEnabled) return
    if (!draftGraphData) return
    const nodes = Array.isArray(draftGraphData.nodes) ? (draftGraphData.nodes as GraphNode[]) : []
    const ids = nodes.map(n => String(n?.id || '').trim()).filter(Boolean)
    if (ids.length === 0) return
    if (ids.length > 120) return
    setOpenQuickEditorNodeIds(ids)
  }, [active, draftGraphData, overlayOnlyModeEnabled, setOpenQuickEditorNodeIds])

  React.useEffect(() => {
    if (!draftGraphData) return
    const nodes = Array.isArray(draftGraphData?.nodes) ? draftGraphData?.nodes : []
    const idSet = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
    updateOpenQuickEditorNodeIds(prev => prev.filter(id => idSet.has(String(id || ''))))
  }, [draftGraphData, updateOpenQuickEditorNodeIds])

  React.useEffect(() => {
    nodeQuickEditorRegistryRef.current = nodeQuickEditorRegistry
  }, [nodeQuickEditorRegistry])

  const shouldDedupeQuickEditorDrop = React.useCallback((key: string): boolean => {
    const now = Date.now()
    const last = lastQuickEditorDropRef.current
    if (last && last.key === key && now - last.ts <= QUICK_EDITOR_DROP_DEDUPE_WINDOW_MS) return true
    lastQuickEditorDropRef.current = { key, ts: now }
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
      const defaultPortKey = explicit || pickDefaultSchemaFieldPortKey(node) || null
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
      const sourcePort = explicitSource || pickDefaultSchemaFieldPortKey(sourceNode) || null
      const explicitTarget = typeof portKey === 'string' && portKey.trim() ? portKey.trim() : null
      const targetPort = explicitTarget || pickDefaultSchemaFieldPortKey(targetNode) || null

      const socketRes = resolveFlowSocketTypesForEdge({
        graphData: draftGraphData,
        sourceNode,
        targetNode,
        sourcePortKey: sourcePort,
        targetPortKey: targetPort,
      })
      if (!socketRes.ok) {
        upsertUiToast({
          id: 'flow-editor-edge-denied',
          kind: 'warning',
          message: `Incompatible port types: ${socketRes.outType || '∅'} → ${socketRes.inType || '∅'}.`,
          ttlMs: 2200,
        })
        return
      }
      const edgeSocketType = socketRes.edgeType || ''

      const usedEdgeIds = new Set((draftGraphData.edges || []).map(e => String(e.id || '')).filter(Boolean))
      const edgeId = createUniqueId('e', usedEdgeIds)
      const nextEdge: GraphEdge = {
        id: edgeId,
        source: pendingEdgeSourceId,
        target: id,
        label: 'linksTo',
        ...(edgeSocketType ? { type: edgeSocketType } : {}),
        properties: {
          ...(sourcePort ? { [FLOW_EDGE_SOURCE_PORT_KEY]: sourcePort } : {}),
          ...(targetPort ? { [FLOW_EDGE_TARGET_PORT_KEY]: targetPort } : {}),
          ...(edgeSocketType ? ({ 'flow:socketType': edgeSocketType } as unknown as Record<string, JSONValue>) : {}),
        },
      }

      const displayLabel = buildFlowEdgeDisplayLabelFromPorts({
        sourceNode,
        targetNode,
        sourcePortKey: sourcePort,
        targetPortKey: targetPort,
      })
      if (displayLabel) {
        ;(nextEdge.properties as Record<string, unknown>)[FLOW_EDGE_DISPLAY_LABEL_KEY] = displayLabel
      }

      const duplicate = (draftGraphData.edges || []).find(e => {
        if (String(e.source) !== String(nextEdge.source)) return false
        if (String(e.target) !== String(nextEdge.target)) return false
        if (String(e.label || '') !== String(nextEdge.label || '')) return false
        const sp = (e.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_SOURCE_PORT_KEY]
        const tp = (e.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_TARGET_PORT_KEY]
        const nsp = (nextEdge.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_SOURCE_PORT_KEY]
        const ntp = (nextEdge.properties as Record<string, unknown> | null | undefined)?.[FLOW_EDGE_TARGET_PORT_KEY]
        return String(sp || '') === String(nsp || '') && String(tp || '') === String(ntp || '')
      })
      if (duplicate) {
        setSelectionSource('canvas')
        selectEdge(String(duplicate.id || ''))
        selectNode(null)
        setPendingEdgeSourceId(null)
        setPendingEdgeSourcePortKey(null)
        setToolMode('select')
        return
      }

      if (!canAddEdge(schema, draftGraphData, nextEdge)) {
        upsertUiToast({
          id: 'flow-editor-edge-denied',
          kind: 'warning',
          message: 'Edge blocked by schema rules.',
          ttlMs: 2200,
        })
        return
      }
      addEdge(nextEdge)
      setPendingEdgeSourceId(null)
      setPendingEdgeSourcePortKey(null)
      setToolMode('select')
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
      pendingSelectNodeIdRef.current = id

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
      const next = normalizeGraphData({
        ...base,
        nodes: [...(base.nodes || []), nextNode],
      })
      setGraphDataPreservingLayout(next)
      return id
    },
    [baseGraphData, draftGraphData, setGraphDataPreservingLayout],
  )

  const addNode = React.useCallback(() => {
    const st = useGraphStore.getState()
    const pos = viewportCenterToWorld({
      transform: getZoomStateForKey({ zoomViewKey: zoomViewKeyRef.current, zoomStateByKey: st.zoomStateByKey }),
      viewportW,
      viewportH,
    })
    appendDraftNode({ type: 'Node', label: null, x: pos.x, y: pos.y, properties: {} })
  }, [appendDraftNode, viewportH, viewportW])

  const addNodeFromRegistryAtWorld = React.useCallback(
    (args: { entry: NodeQuickEditorRegistryEntry; x: number; y: number }) => {
      const entry = args.entry
      const x = Number.isFinite(args.x) ? args.x : 0
      const y = Number.isFinite(args.y) ? args.y : 0
      const label = entry.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID ? FLOW_VIDEO_GENERATION_NODE_LABEL : entry.nodeTypeId
      const properties: Record<string, unknown> = {
        [FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]: entry.quickEditorTypeId,
        [FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]: entry.formId,
      }
      if (entry.nodeTypeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) {
        properties.model = 'generate_video'
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
      const id = createUniqueId('n', used)
      reservedNodeIdsRef.current.add(id)
      setOverlayNodeIdOverride(id)
      pendingOverlayNodeIdRef.current = id
      overlayNodeIdOverrideWasSelectedRef.current = false
      overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
      lastDroppedQuickEditorNodeIdRef.current = id
      setLastDroppedQuickEditorToken(Date.now())
      useGraphStore.setState({
        selectionSource: 'canvas',
        selectedNodeId: id,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [id],
        selectedEdgeIds: [],
        selectedGroupIds: [],
      })
      scheduleForceSelect(id, { minHoldMs: 700 })
      setPendingOverlayNode({ id, type: entry.nodeTypeId, label, x, y, properties: properties as never })
      appendDraftNode({ id, type: entry.nodeTypeId, label, x, y, properties })
      updateOpenQuickEditorNodeIds(prev => (prev.includes(id) ? prev : [...prev, id]))
      try {
        setTimeout(() => {
          if (pendingOverlayNodeIdRef.current !== id) return
          pendingOverlayNodeIdRef.current = null
          setPendingOverlayNode(null)
        }, 2000)
      } catch {
        void 0
      }
      try {
        setTimeout(() => {
          const selected = String(useGraphStore.getState().selectedNodeId || '')
          const draft = draftGraphDataRef.current
          const nodes = Array.isArray(draft?.nodes) ? draft?.nodes : []
          const found = nodes.find(n => String(n.id || '') === id) || null
          const props = (found?.properties || {}) as Record<string, unknown>
          const qeType = typeof props[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY] === 'string' ? String(props[FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY]) : ''
          const qeForm = typeof props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY] === 'string' ? String(props[FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY]) : ''
          upsertUiToast({
            id: `flow-editor-drop-debug-${id}`,
            kind: 'neutral',
            message: `Drop debug: nodeId=${id} nodeType=${entry.nodeTypeId} registryEntryId=${entry.id} selected=${selected} override=${id} found=${found ? '1' : '0'} qeType=${qeType} qeForm=${qeForm}`,
            ttlMs: DROP_DEBUG_TOAST_TTL_MS,
          })
        }, 60)
      } catch {
        void 0
      }
    },
    [appendDraftNode, baseGraphData, scheduleForceSelect, updateOpenQuickEditorNodeIds, upsertUiToast],
  )

  React.useEffect(() => {
    if (!active) return
    if (typeof document === 'undefined') return
    const onDragOverCapture = (ev: DragEvent) => {
      const dt = ev.dataTransfer
      if (!dt) return
      if (!hasFlowNodeQuickEditorDragType(dt)) return
      const el = rootRef.current
      const rect = el ? el.getBoundingClientRect() : null
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
      const payload = readFlowNodeQuickEditorDragPayloadFromDataTransfer({ getData: mime => dt.getData(mime) })
      if (!payload) return
      const el = rootRef.current
      const rect = el ? el.getBoundingClientRect() : null
      if (!rect) return
      setCanvasWindowOffsetFromRect(rect)
      const sx = ev.clientX - rect.left
      const sy = ev.clientY - rect.top
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
      const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
      if (shouldDedupeQuickEditorDrop(dropKey)) {
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
      const entry = (nodeQuickEditorRegistryRef.current || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
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
        id: 'flow-editor-drop-node-quick-editor',
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
  }, [active, addNodeFromRegistryAtWorld, getLiveZoomTransform, setCanvasWindowOffsetFromRect, shouldDedupeQuickEditorDrop, upsertUiToast])

  const deleteSelection = React.useCallback(() => {
    if (!draftGraphData) return
    const selectedNodeIds = Array.isArray(selectedNodeIdsRef.current) ? selectedNodeIdsRef.current.map(String) : []
    const selectedEdgeIds = Array.isArray(selectedEdgeIdsRef.current) ? selectedEdgeIdsRef.current.map(String) : []
    const nodeIdSet = new Set(selectedNodeIds)
    const edgeIdSet = new Set(selectedEdgeIds)
    if (selectedNodeId) nodeIdSet.add(selectedNodeId)
    if (selectedEdgeId) edgeIdSet.add(selectedEdgeId)
    if (nodeIdSet.size === 0 && edgeIdSet.size === 0) return

    const nextNodes = (draftGraphData.nodes || []).filter(n => !nodeIdSet.has(String(n.id || '')))
    const nextEdges = (draftGraphData.edges || []).filter(e => {
      const id = String(e.id || '')
      if (edgeIdSet.has(id)) return false
      const src = String(e.source || '')
      const tgt = String(e.target || '')
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
    setSelectionSource('canvas')
    selectNode(null)
    selectEdge(null)
  }, [draftGraphData, selectEdge, selectNode, selectedEdgeId, selectedEdgeIdsRef, selectedNodeId, selectedNodeIdsRef, setGraphDataPreservingLayout, setSelectionSource])

  const removeNodeById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!draftGraphData) return
      const nodeIdSet = new Set([id])
      const nextNodes = (draftGraphData.nodes || []).filter(n => !nodeIdSet.has(String(n.id || '')))
      const nextEdges = (draftGraphData.edges || []).filter(e => {
        const src = String(e.source || '')
        const tgt = String(e.target || '')
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
      updateOpenQuickEditorNodeIds(prev => prev.filter(x => String(x || '') !== id))
      const selected = String(useGraphStore.getState().selectedNodeId || '')
      if (selected === id) {
        setSelectionSource('canvas')
        selectNode(null)
        selectEdge(null)
      }
    },
    [draftGraphData, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource, updateOpenQuickEditorNodeIds],
  )

  const clearNodeOutputById = React.useCallback(
    (nodeId: string) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      upsertUiToast({
        id: `flow-editor-clear-output-${id}`,
        kind: 'neutral',
        message: 'Clear output is not implemented in MVP.',
        ttlMs: 2200,
      })
    },
    [upsertUiToast],
  )

  const selectedDraftNode = React.useMemo(() => {
    if (!draftGraphData || !selectedNodeId) return null
    const nodes = Array.isArray(draftGraphData.nodes) ? draftGraphData.nodes : []
    return nodes.find(n => String(n.id || '') === selectedNodeId) || null
  }, [draftGraphData, selectedNodeId])

  const overlayDraftNode = React.useMemo(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return selectedDraftNode
    if (!draftGraphData) {
      const pending = pendingOverlayNodeIdRef.current
      if (pending && pending === override) return pendingOverlayNode
      return selectedDraftNode
    }
    const nodes = Array.isArray(draftGraphData.nodes) ? draftGraphData.nodes : []
    const found = nodes.find(n => String(n.id || '') === override) || null
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
      updateOpenQuickEditorNodeIds(prev => (prev.includes(nextId) ? prev : [...prev, nextId]))
      setSelectionSource('canvas')
      selectEdge(null)
      selectNode(nextId)
    },
    [draftGraphData, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource, updateOpenQuickEditorNodeIds],
  )

  const showNodeEditorHelp = React.useCallback(() => {
    upsertUiToast({
      id: 'flow-editor-node-editor-help',
      kind: 'neutral',
      message: UI_COPY.flowNodeQuickEditorHelpToast,
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
        message: UI_COPY.flowNodeQuickEditorEnableHandlesAlreadyOnToast,
        ttlMs: 2200,
      })
      return
    }

    const next = enableHandlesForAllInputsInSchema(schema)
    if (next.changed) setSchema(next.schema)
    upsertUiToast({
      id: 'flow-editor-enable-handles',
      kind: 'success',
      message: UI_COPY.flowNodeQuickEditorEnableHandlesToast,
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
          message: UI_COPY.flowNodeQuickEditorConvertToLoopAlreadyLoopToast,
          ttlMs: 2200,
        })
        return
      }
      setGraphDataPreservingLayout(converted.graphData)
      upsertUiToast({
        id: 'flow-editor-convert-loop',
        kind: 'success',
        message: UI_COPY.flowNodeQuickEditorConvertToLoopToast,
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
        const draft = (draftGraphDataRef.current || draftGraphData) as GraphData | null
        if (!draft) {
          upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
          return
        }
        const node = (draft.nodes || []).find(n => String(n.id || '') === id) || null
        if (!node) {
          upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorNodeNotFoundToast(id), ttlMs: 2400 })
          return
        }

        const subgraph = buildSelectionSubgraph(draft, id, null) || { ...draft, nodes: [node], edges: [] }

        const store = useGraphStore.getState()
        const registry = Array.isArray(store.nodeQuickEditorRegistry) ? store.nodeQuickEditorRegistry : []
        const nodeTypeIds = new Set((subgraph.nodes || []).map(n => String(n.type || '').trim()).filter(Boolean))
        const registryEntries = registry.filter(e => e && e.isEnabled && nodeTypeIds.has(String(e.nodeTypeId || '').trim()))
        const fallbackResolved = resolveNodeQuickEditorRegistryEntry({ node, registry })
        const entries = registryEntries.length > 0 ? registryEntries : fallbackResolved ? [fallbackResolved] : []

        await exportNodeQuickEditorBundleAsJson({
          graphData: subgraph,
          registryEntries: entries,
          suggestedName: `flow-node-${id}.quick-editor.bundle.json`,
        })
        upsertUiToast({ id: `flow-editor-run-${id}`, kind: 'neutral', message: UI_COPY.flowEditorRunExportedToast, ttlMs: 2200 })
      } catch {
        upsertUiToast({ id: `flow-editor-run-failed-${String(nodeId || '')}`, kind: 'neutral', message: UI_COPY.flowEditorRunFailedToast, ttlMs: 2600 })
      }
    },
    [draftGraphData, upsertUiToast],
  )

  const exportWorkflowBundle = React.useCallback(async () => {
    try {
      const draft = (draftGraphDataRef.current || draftGraphData) as GraphData | null
      if (!draft) {
        upsertUiToast({ id: 'flow-editor-export-bundle', kind: 'neutral', message: UI_COPY.flowEditorNoDraftGraphToast, ttlMs: 2400 })
        return
      }
      const store = useGraphStore.getState()
      const registry = Array.isArray(store.nodeQuickEditorRegistry) ? store.nodeQuickEditorRegistry : []
      await exportNodeQuickEditorBundleAsJson({
        graphData: draft,
        registryEntries: registry,
        suggestedName: 'flow-workflow.quick-editor.bundle.json',
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

  const overlayEditorNodeIds = React.useMemo(() => {
    const next: string[] = []
    const seen = new Set<string>()
    for (const id of openQuickEditorNodeIds) {
      const s = String(id || '').trim()
      if (!s || seen.has(s)) continue
      seen.add(s)
      next.push(s)
    }
    const sel = String(overlayDraftNode?.id || '').trim()
    if (sel && !seen.has(sel)) next.push(sel)
    return next
  }, [openQuickEditorNodeIds, overlayDraftNode?.id])

  const connectedValuesByNodeId = React.useMemo(() => {
    const targetNodeIds = new Set(overlayEditorNodeIds)
    return computeFlowConnectedValuesBySchemaPath({
      graphData: draftGraphData,
      registry: Array.isArray(nodeQuickEditorRegistry) ? nodeQuickEditorRegistry : [],
      targetNodeIds,
    })
  }, [draftGraphData, nodeQuickEditorRegistry, overlayEditorNodeIds])

  const overlayEditorElements = React.useMemo(() => {
    if (!active) return []
    const edges = (draftGraphData?.edges || []) as GraphEdge[]
    const nodes = Array.isArray(draftGraphData?.nodes) ? (draftGraphData?.nodes as GraphNode[]) : []
    const forcePinnedToCanvas = false
    const resolveNode = (id: string) => {
      const found = nodes.find(n => String(n.id || '') === id) || null
      if (found) return found
      const pending = pendingOverlayNodeIdRef.current
      if (pending && pending === id) return pendingOverlayNode
      return null
    }
    return overlayEditorNodeIds
      .map((id, stackIndex) => {
        const node = resolveNode(id)
        if (!node) return null
        const autoRevealKey = id === String(lastDroppedQuickEditorNodeIdRef.current || '') ? lastDroppedQuickEditorToken : 0
        const connectedValuesBySchemaPath = connectedValuesByNodeId.get(id) || undefined
        return (
          <FlowEditorNodeQuickEditorOverlay
            key={`qe-${id}`}
            active={active}
            node={node}
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
            onSetLabel={(label) => setNodeLabelById(id, label)}
            onSetType={(type) => setNodeTypeById(id, type)}
            onPatchProperties={(patch) => patchNodePropertiesById(id, patch)}
            onSetProperties={(props) => setNodePropertiesById(id, props)}
            onValidate={() => validateNodeById(id)}
            onDuplicate={() => duplicateNodeById(id)}
            onRemove={() => removeNodeById(id)}
            onClearOutput={() => clearNodeOutputById(id)}
            onHelp={showNodeEditorHelp}
            onConvertToLoopNode={() => convertNodeToLoopById(id)}
            onEnableHandlesForAllInputs={enableHandlesForAllInputs}
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
    active,
    beginAddEdgeFromNode,
    canvasWindowOffset,
    clearNodeOutputById,
    convertNodeToLoopById,
    connectedValuesByNodeId,
    draftGraphData?.edges,
    draftGraphData?.nodes,
    duplicateNodeById,
    enableHandlesForAllInputs,
    finalizePendingEdge,
    getLiveNodeWorldPos,
    getLiveZoomTransform,
    lastDroppedQuickEditorToken,
    overlayEditorNodeIds,
    patchNodePropertiesById,
    pendingEdgeSourceId,
    pendingOverlayNode,
    removeNodeById,
    renameSchemaFieldIdByNodeId,
    scheduleOverlayCollisionResolve,
    setNodeLabelById,
    setNodePropertiesById,
    setNodeTypeById,
    showNodeEditorHelp,
    toolMode,
    validateNodeById,
    viewportH,
    viewportW,
    zoomViewKey,
  ])

  const hasOverlayEditors = overlayEditorElements.length > 0
  const noGraphLoaded = !draftGraphData

  return (
    <section
      ref={rootRef}
      className="absolute inset-0 z-0"
      aria-label="Flow Editor"
      onDragOverCapture={(ev) => {
        if (!active) return
        ev.preventDefault()
        try {
          ev.dataTransfer.dropEffect = 'copy'
        } catch {
          void 0
        }
      }}
      onDropCapture={(ev) => {
        if (!active) return
        const payload = readFlowNodeQuickEditorDragPayloadFromDataTransfer({ getData: mime => ev.dataTransfer.getData(mime) })
        if (!payload) return
        const entry = (nodeQuickEditorRegistry || []).find(e => e && e.isEnabled && e.id === payload.registryEntryId) || null
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
        if (shouldDedupeQuickEditorDrop(dropKey)) {
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
          id: 'flow-editor-drop-node-quick-editor',
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
        graphDataOverride={draftGraphData}
        graphDataRevisionOverride={baseGraphDataRevision}
        exposeRuntimeRef={ref => {
          flowRuntimeRefRef.current = ref
        }}
        onInteractionFrame={hasOverlayEditors ? emitFlowEditorInteractionFrame : undefined}
        renderEdges={overlayOnlyModeEnabled ? false : true}
        renderGroups={overlayOnlyModeEnabled ? false : true}
        renderNodes={overlayOnlyModeEnabled ? false : true}
        hidePortHandleNodeIds={overlayOnlyHidePortHandleNodeIds}
      />

      {overlayOnlyModeEnabled && (
        <svg
          ref={overlayEdgesSvgRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 120, color: 'var(--kg-canvas-edge-stroke)', overflow: 'visible' }}
          aria-hidden={true}
        />
      )}

      {overlayEditorElements as unknown as React.ReactNode}

      {noGraphLoaded && (
        <aside className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Status">
          <section className={`rounded-lg border px-3 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
            <p className={`text-xs ${UI_THEME_TOKENS.text.secondary}`}>No graph loaded.</p>
          </section>
        </aside>
      )}

      {!hasOverlayEditors && (
      <nav className="absolute top-3 left-3 z-[220]" aria-label="Flow Editor Tools">
        <section className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.input.border}`}>
          <button
            type="button"
            className={`App-toolbar__btn ${toolMode === 'select' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => {
              setToolMode('select')
              setPendingEdgeSourceId(null)
            }}
            aria-label="Tool: Select"
            disabled={!active}
          >
            Select
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={addNode}
            aria-label="Add node"
            disabled={!active}
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${toolMode === 'addEdge' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
            onClick={() => {
              if (toolMode === 'addEdge') {
                setToolMode('select')
                setPendingEdgeSourceId(null)
                return
              }
              setToolMode('addEdge')
              setPendingEdgeSourceId(null)
            }}
            aria-label="Add edge"
            disabled={!active}
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={deleteSelection}
            aria-label="Delete selection"
            disabled={!active}
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <span className={`px-2 text-xs ${UI_THEME_TOKENS.text.secondary}`} aria-label="Sync status">
            Live
          </span>
        </section>
      </nav>
      )}

      {!hasOverlayEditors && toolMode === 'addEdge' && active && (
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
