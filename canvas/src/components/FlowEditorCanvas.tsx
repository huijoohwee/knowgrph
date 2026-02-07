import React from 'react'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'

import FlowCanvas from '@/components/FlowCanvas'
import FlowEditorInspector, { type InspectorTab } from '@/components/FlowEditor/FlowEditorInspector'
import NodeOverlayEditor from '@/components/FlowEditor/NodeOverlayEditor'
import { coerceJsonObject, safeJsonStringify, tryParseJson } from '@/components/FlowEditor/flowEditorJson'
import { useContainerDims } from '@/hooks/useContainerDims'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useGraphStoreKeyRef } from '@/hooks/useGraphStoreKeyRef'
import { createUniqueId } from '@/lib/ids'
import { normalizeGraphData } from '@/lib/graph/normalize'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import {
  FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID,
  FLOW_EDITOR_SMART_NODE_REQUIRED_FIELDS,
  FLOW_VIDEO_GENERATION_NODE_LABEL,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
  UI_COPY,
} from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { screenToWorld, viewportCenterToWorld } from '@/lib/zoom/viewport'
import {
  convertNodeToLoopInGraphData,
  enableHandlesForAllInputsInSchema,
  isHandlesForAllInputsEnabled,
} from '@/lib/flowEditor/flowEditorActions'
import { togglePortHandlesEnabledInSchema } from '@/lib/graph/portHandlesBehavior'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  FLOW_EDGE_DISPLAY_LABEL_KEY,
  buildFlowEdgeDisplayLabelFromPorts,
  pickDefaultSchemaFieldPortKey,
} from '@/lib/graph/flowPorts'
import { canAddEdge } from '@/features/schema/validation'
import type { NodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/nodeQuickEditorRegistryTypes'
import { FLOW_NODE_QUICK_EDITOR_FORM_ID_KEY, FLOW_NODE_QUICK_EDITOR_TYPE_ID_KEY } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { resolveNodeQuickEditorRegistryEntry } from '@/features/flow-editor-manager/resolveNodeQuickEditorRegistry'
import { hasFlowNodeQuickEditorDragType, readFlowNodeQuickEditorDragPayloadFromDataTransfer } from '@/lib/flowEditor/nodeQuickEditorDrag'
import { buildSelectionSubgraph, exportNodeQuickEditorBundleAsJson } from '@/lib/graph/file'

type ToolMode = 'select' | 'addEdge'

const OVERLAY_NODE_OVERRIDE_LOCK_MS = 4000
const QUICK_EDITOR_DROP_DEDUPE_WINDOW_MS = 250
const FORCE_SELECT_TICK_MS = 30
const FORCE_SELECT_MAX_TICKS = 80
const DROP_DEBUG_TOAST_TTL_MS = 3500

const FlowEditorNodeQuickEditorOverlay = React.memo(function FlowEditorNodeQuickEditorOverlay(args: {
  active: boolean
  node: GraphNode
  edges: ReadonlyArray<GraphEdge>
  viewportW: number
  viewportH: number
  canvasWindowOffset: { left: number; top: number }
  autoRevealKey?: number
  forcePinnedToNode?: boolean
  stackIndex?: number
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
  onTogglePortHandles: () => void
  onEnableHandlesForAllInputs: () => void
  onPinnedToNodeChange: (pinnedToNode: boolean) => void
}) {
  return (
    <NodeOverlayEditor
      active={args.active}
      node={args.node}
      edges={args.edges}
      toolMode={args.toolMode}
      pendingEdgeSourceId={args.pendingEdgeSourceId}
      onBeginAddEdgeFromNode={args.onBeginAddEdgeFromNode}
      onFinalizeAddEdgeToNode={args.onFinalizeAddEdgeToNode}
      viewportW={args.viewportW}
      viewportH={args.viewportH}
      canvasWindowOffset={args.canvasWindowOffset}
      autoRevealKey={args.autoRevealKey}
      forcePinnedToNode={args.forcePinnedToNode}
      stackIndex={args.stackIndex}
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
      onTogglePortHandles={args.onTogglePortHandles}
      onEnableHandlesForAllInputs={args.onEnableHandlesForAllInputs}
      onPinnedToNodeChange={args.onPinnedToNodeChange}
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
  const selectedNodeId = useGraphStore(s => (typeof s.selectedNodeId === 'string' ? s.selectedNodeId : null))
  const selectedEdgeId = useGraphStore(s => (typeof s.selectedEdgeId === 'string' ? s.selectedEdgeId : null))
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const setGraphDataPreservingLayout = useGraphStore(s => s.setGraphDataPreservingLayout)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)
  const documentStructureBaselineLock = useGraphStore(s => s.documentStructureBaselineLock === true)
  const schema = useGraphStore(s => s.schema)
  const setSchema = useGraphStore(s => s.setSchema)

  const selectedNodeIdsRef = useGraphStoreKeyRef('selectedNodeIds')
  const selectedEdgeIdsRef = useGraphStoreKeyRef('selectedEdgeIds')
  const nodeQuickEditorRegistry = useGraphStore(s => s.nodeQuickEditorRegistry || [])
  const nodeQuickEditorRegistryRef = React.useRef(nodeQuickEditorRegistry)
  const lastQuickEditorDropRef = React.useRef<{ key: string; ts: number } | null>(null)
  const lastDroppedQuickEditorNodeIdRef = React.useRef<string | null>(null)
  const [lastDroppedQuickEditorToken, setLastDroppedQuickEditorToken] = React.useState<number>(0)

  const openQuickEditorNodeIds = useGraphStore(s => s.openQuickEditorNodeIds || [])
  const updateOpenQuickEditorNodeIds = useGraphStore(s => s.updateOpenQuickEditorNodeIds)
  const pinnedToNodeByIdRef = React.useRef<Map<string, boolean>>(new Map())
  const [anyEditorPinnedToNode, setAnyEditorPinnedToNode] = React.useState<boolean>(false)

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

  React.useEffect(() => {
    const nodes = Array.isArray(draftGraphData?.nodes) ? draftGraphData?.nodes : []
    const idSet = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
    updateOpenQuickEditorNodeIds(prev => prev.filter(id => idSet.has(String(id || ''))))
    const pinnedMap = pinnedToNodeByIdRef.current
    for (const key of Array.from(pinnedMap.keys())) {
      if (!idSet.has(String(key || ''))) pinnedMap.delete(key)
    }
    setAnyEditorPinnedToNode(Array.from(pinnedMap.values()).some(Boolean))
  }, [draftGraphData])

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

      const usedEdgeIds = new Set((draftGraphData.edges || []).map(e => String(e.id || '')).filter(Boolean))
      const edgeId = createUniqueId('e', usedEdgeIds)
      const nextEdge: GraphEdge = {
        id: edgeId,
        source: pendingEdgeSourceId,
        target: id,
        label: 'linksTo',
        properties: {
          ...(sourcePort ? { [FLOW_EDGE_SOURCE_PORT_KEY]: sourcePort } : {}),
          ...(targetPort ? { [FLOW_EDGE_TARGET_PORT_KEY]: targetPort } : {}),
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
      const next: GraphData = {
        ...draftGraphData,
        edges: [...(draftGraphData.edges || []), nextEdge],
      }
      setGraphDataPreservingLayout(normalizeGraphData(next))
      setPendingEdgeSourceId(null)
      setPendingEdgeSourcePortKey(null)
      setToolMode('select')
    },
    [active, draftGraphData, pendingEdgeSourceId, pendingEdgeSourcePortKey, schema, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource, toolMode, upsertUiToast],
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
      transform: (st.zoomState as unknown as { k: number; x: number; y: number } | null) || null,
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
      updateOpenQuickEditorNodeIds(prev => (prev.includes(id) ? prev : [...prev, id]))
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
    [appendDraftNode, baseGraphData, scheduleForceSelect, upsertUiToast],
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
      const pos = screenToWorld({ transform: (st.zoomState as unknown as { k: number; x: number; y: number } | null) || null, sx, sy })
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
  }, [active, addNodeFromRegistryAtWorld, shouldDedupeQuickEditorDrop, upsertUiToast])

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
      pinnedToNodeByIdRef.current.delete(id)
      setAnyEditorPinnedToNode(Array.from(pinnedToNodeByIdRef.current.values()).some(Boolean))
      const selected = String(useGraphStore.getState().selectedNodeId || '')
      if (selected === id) {
        setSelectionSource('canvas')
        selectNode(null)
        selectEdge(null)
      }
    },
    [draftGraphData, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource],
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
      if (!draftGraphData) return
      const trimmed = String(label || '')
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== id) return n
        if (String(n.label || '') === trimmed) return n
        return { ...n, label: trimmed }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setGraphDataPreservingLayout(next)
    },
    [draftGraphData, setGraphDataPreservingLayout],
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
      if (!draftGraphData) return
      const trimmed = String(type || '').trim() || 'Node'
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== id) return n
        if (String(n.type || '') === trimmed) return n
        return { ...n, type: trimmed }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setGraphDataPreservingLayout(next)
    },
    [draftGraphData, setGraphDataPreservingLayout],
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
      if (!draftGraphData) return
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== id) return n
        const prevProps = (n.properties || {}) as Record<string, unknown>
        const nextProps: Record<string, unknown> = { ...prevProps }
        for (const [key, value] of Object.entries(patch)) {
          if (typeof value === 'undefined') {
            delete nextProps[key]
            continue
          }
          nextProps[key] = value as unknown
        }
        return { ...n, properties: nextProps as never }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setGraphDataPreservingLayout(next)
    },
    [draftGraphData, setGraphDataPreservingLayout],
  )

  const setNodePropertiesById = React.useCallback(
    (nodeId: string, properties: Record<string, unknown>) => {
      const id = String(nodeId || '').trim()
      if (!id) return
      if (!draftGraphData) return
      const nodes = (draftGraphData.nodes || []).map(n => {
        if (String(n.id || '') !== id) return n
        return { ...n, properties: (properties || {}) as never }
      })
      const next = normalizeGraphData({ ...draftGraphData, nodes })
      setGraphDataPreservingLayout(next)
    },
    [draftGraphData, setGraphDataPreservingLayout],
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
    [draftGraphData, selectEdge, selectNode, setGraphDataPreservingLayout, setSelectionSource],
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

  const togglePortHandles = React.useCallback(() => {
    if (documentStructureBaselineLock === true) {
      upsertUiToast({
        id: 'baseline-locked',
        kind: 'warning',
        message: UI_COPY.baselineLockedToast,
        ttlMs: 6000,
      })
      return
    }
    const next = togglePortHandlesEnabledInSchema(schema)
    if (next.changed) setSchema(next.schema)
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
      if (!draftGraphData || !selectedEdgeId) return
      const trimmed = String(label || '').trim() || 'linksTo'
      const edges = (draftGraphData.edges || []).map(e => {
        if (String(e.id || '') !== selectedEdgeId) return e
        if (String(e.label || '') === trimmed) return e
        return { ...e, label: trimmed }
      })
      const next = normalizeGraphData({ ...draftGraphData, edges })
      setGraphDataPreservingLayout(next)
    },
    [draftGraphData, selectedEdgeId, setGraphDataPreservingLayout],
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
        const nodes = (draftGraphData.nodes || []).map(n => {
          if (String(n.id || '') !== selectedNodeId) return n
          return args.target === 'nodeProps' ? { ...n, properties: record as never } : { ...n, metadata: record as never }
        })
        apply({ ...draftGraphData, nodes })
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
        const edges = (draftGraphData.edges || []).map(e => {
          if (String(e.id || '') !== selectedEdgeId) return e
          return args.target === 'edgeProps' ? { ...e, properties: record as never } : { ...e, metadata: record as never }
        })
        apply({ ...draftGraphData, edges })
      }
    },
    [draftGraphData, edgeMetaJson, edgePropsJson, nodeMetaJson, nodePropsJson, selectedEdgeId, selectedNodeId, setGraphDataPreservingLayout, workflowContextJson, workflowMetaJson],
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

  const inspectorElement = (
    <FlowEditorInspector
      active={active}
      tab={inspectorTab}
      setTab={setInspectorTab}
      selectedNode={selectedDraftNode}
      selectedEdge={selectedDraftEdge}
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

  const overlayEditorElements = React.useMemo(() => {
    if (!active) return []
    const edges = (draftGraphData?.edges || []) as GraphEdge[]
    const nodes = Array.isArray(draftGraphData?.nodes) ? (draftGraphData?.nodes as GraphNode[]) : []
    const forcePinnedToNode = overlayEditorNodeIds.length > 1
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
        return (
          <FlowEditorNodeQuickEditorOverlay
            key={`qe-${id}`}
            active={active}
            node={node}
            edges={edges}
            toolMode={toolMode}
            pendingEdgeSourceId={pendingEdgeSourceId}
            onBeginAddEdgeFromNode={beginAddEdgeFromNode}
            onFinalizeAddEdgeToNode={finalizePendingEdge}
            viewportW={viewportW}
            viewportH={viewportH}
            canvasWindowOffset={canvasWindowOffset}
            autoRevealKey={autoRevealKey}
            forcePinnedToNode={forcePinnedToNode}
            stackIndex={stackIndex}
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
            onTogglePortHandles={togglePortHandles}
            onEnableHandlesForAllInputs={enableHandlesForAllInputs}
            onPinnedToNodeChange={(pinnedToNode) => {
              pinnedToNodeByIdRef.current.set(id, pinnedToNode)
              setAnyEditorPinnedToNode(Array.from(pinnedToNodeByIdRef.current.values()).some(Boolean))
            }}
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
    draftGraphData?.edges,
    draftGraphData?.nodes,
    duplicateNodeById,
    enableHandlesForAllInputs,
    finalizePendingEdge,
    lastDroppedQuickEditorToken,
    overlayEditorNodeIds,
    patchNodePropertiesById,
    pendingEdgeSourceId,
    pendingOverlayNode,
    removeNodeById,
    setNodeLabelById,
    setNodePropertiesById,
    setNodeTypeById,
    showNodeEditorHelp,
    togglePortHandles,
    toolMode,
    validateNodeById,
    viewportH,
    viewportW,
  ])

  const hasOverlayEditors = overlayEditorElements.length > 0
  const noGraphLoaded = !draftGraphData

  return (
    <section
      ref={rootRef}
      className="absolute inset-0"
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
        if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return
        const dropKey = `${payload.registryEntryId}:${Math.round(sx)}:${Math.round(sy)}`
        if (shouldDedupeQuickEditorDrop(dropKey)) {
          ev.preventDefault()
          ev.stopPropagation()
          return
        }
        const st = useGraphStore.getState()
        const pos = screenToWorld({ transform: (st.zoomState as unknown as { k: number; x: number; y: number } | null) || null, sx, sy })
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
        collisionDuringDrag
        allowNodeDragOverride={anyEditorPinnedToNode ? false : undefined}
        renderEdges={false}
        renderGroups={false}
        renderNodes={false}
        forbidCircleNodes
      />

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
