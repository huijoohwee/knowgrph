import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { createUniqueId } from '@/lib/ids'
import {
  buildFloatingPropsPanelAddedNode,
  commitFloatingPropsPanelAddedNode,
} from '@/lib/toolbar/floatingPropsPanelAddNode'
import { buildDataflowWidgetRegistry } from '@/lib/storyboardWidget/widgetRegistryDataflow'
import {
  EMPTY_WIDGET_REGISTRY,
  FORCE_SELECT_MAX_TICKS,
  FORCE_SELECT_TICK_MS,
  WIDGET_DROP_DEDUPE_WINDOW_MS,
} from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import { useStoryboardWidgetDropBridge } from '@/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetDropBridge'

export default function StoryboardWidgetDropBridge(props: {
  active?: boolean
  widgetDropCaptureEnabled?: boolean
  geospatialWidgetPanelMode?: boolean
}) {
  const active = props.active === true
  const widgetDropCaptureEnabled = props.widgetDropCaptureEnabled === true
  const geospatialWidgetPanelMode = props.geospatialWidgetPanelMode === true
  const rootRef = React.useRef<HTMLElement | null>(null)
  const draftGraphDataRef = React.useRef<GraphData | null>(null)
  const reservedNodeIdsRef = React.useRef<Set<string>>(new Set())
  const pendingOverlayNodeIdRef = React.useRef<string | null>(null)
  const pendingOpenWidgetNodeIdRef = React.useRef<string | null>(null)
  const overlayNodeIdOverrideWasSelectedRef = React.useRef(false)
  const overlayNodeIdOverrideUntilMsRef = React.useRef(0)
  const lastDroppedWidgetNodeIdRef = React.useRef<string | null>(null)
  const lastWidgetDropRef = React.useRef<{ key: string; ts: number } | null>(null)
  const forceSelectRef = React.useRef<{ id: string; remaining: number; untilMs: number } | null>(null)
  const forceSelectTimerRef = React.useRef<number | null>(null)
  const zoomViewKeyRef = React.useRef<string | null>(null)
  const [overlayNodeIdOverride, setOverlayNodeIdOverride] = React.useState<string | null>(null)
  const [pendingOverlayNode, setPendingOverlayNode] = React.useState<GraphNode | null>(null)
  const [lastDroppedWidgetToken, setLastDroppedWidgetToken] = React.useState(0)
  const {
    graphData,
    addNode,
    updateNode,
    upsertUiToast,
    updateOpenWidgetNodeIds,
    documentWidgetRegistry,
    effectiveWidgetRegistry,
    baseWidgetRegistry,
  } = useGraphStore(
    useShallow(s => ({
      graphData: (s.graphData || null) as GraphData | null,
      addNode: s.addNode,
      updateNode: s.updateNode,
      upsertUiToast: s.upsertUiToast,
      updateOpenWidgetNodeIds: s.updateOpenWidgetNodeIds,
      documentWidgetRegistry: Array.isArray(s.documentWidgetRegistry) ? s.documentWidgetRegistry : EMPTY_WIDGET_REGISTRY,
      effectiveWidgetRegistry: Array.isArray(s.effectiveWidgetRegistry) ? s.effectiveWidgetRegistry : EMPTY_WIDGET_REGISTRY,
      baseWidgetRegistry: Array.isArray(s.widgetRegistry) ? s.widgetRegistry : EMPTY_WIDGET_REGISTRY,
    })),
  )
  const widgetRegistry = React.useMemo(
    () => buildDataflowWidgetRegistry({ documentWidgetRegistry, effectiveWidgetRegistry, widgetRegistry: baseWidgetRegistry }),
    [baseWidgetRegistry, documentWidgetRegistry, effectiveWidgetRegistry],
  )
  const widgetRegistryRef = React.useRef(widgetRegistry)

  React.useEffect(() => {
    draftGraphDataRef.current = graphData
  }, [graphData])

  React.useEffect(() => {
    widgetRegistryRef.current = widgetRegistry
  }, [widgetRegistry])

  const appendDraftNode = React.useCallback(
    (nodeArgs: { id?: string | null; type: string; label?: string | null; x: number; y: number; properties?: Record<string, unknown> }) => {
      const base: GraphData = (graphData || {
        context: '',
        type: 'Graph',
        nodes: [],
        edges: [],
      }) as GraphData
      const used = new Set<string>((base.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      const requested = typeof nodeArgs.id === 'string' && nodeArgs.id.trim() ? nodeArgs.id.trim() : ''
      const id = requested && !used.has(requested) ? requested : createUniqueId('n', used)
      const x = Number.isFinite(nodeArgs.x) ? nodeArgs.x : 0
      const y = Number.isFinite(nodeArgs.y) ? nodeArgs.y : 0
      const type = String(nodeArgs.type || '').trim() || 'Node'
      const label = String(nodeArgs.label || '').trim() || id
      const nextNode = buildFloatingPropsPanelAddedNode({
        id,
        type,
        label,
        point: { x, y },
        properties: nodeArgs.properties || {},
      })
      const beforeIds = new Set<string>((useGraphStore.getState().graphData?.nodes || []).map(node => String(node.id || '')).filter(Boolean))
      const committedId = commitFloatingPropsPanelAddedNode({
        node: nextNode,
        addNode,
        readGraphData: () => useGraphStore.getState().graphData as GraphData | null,
      })
      const committedGraph = useGraphStore.getState().graphData as GraphData | null
      const committedNodes = Array.isArray(committedGraph?.nodes) ? (committedGraph.nodes as GraphNode[]) : []
      const exactId = committedNodes.find(node => String(node.id || '') === id)?.id
      const composedId = committedNodes.find(node => String(node.id || '').endsWith(`::${id}`))?.id
      const insertedId = committedNodes.find(node => {
        const nodeId = String(node.id || '')
        if (!nodeId || beforeIds.has(nodeId)) return false
        return String(node.type || '').trim() === type && String(node.label || '').trim() === label
      })?.id
      const actualId = String(exactId || composedId || insertedId || committedId || id).trim() || id
      reservedNodeIdsRef.current.delete(id)
      reservedNodeIdsRef.current.delete(actualId)
      return actualId
    },
    [addNode, graphData],
  )

  const shouldDedupeWidgetDrop = React.useCallback((key: string): boolean => {
    const now = Date.now()
    const last = lastWidgetDropRef.current
    if (last && last.key === key && now - last.ts <= WIDGET_DROP_DEDUPE_WINDOW_MS) return true
    lastWidgetDropRef.current = { key, ts: now }
    return false
  }, [])

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
      const current = forceSelectRef.current
      if (!current) return
      if (current.remaining <= 0) {
        forceSelectRef.current = null
        return
      }
      current.remaining -= 1
      const store = useGraphStore.getState()
      const selected = String(store.selectedNodeId || '')
      const matches = selected === current.id
      if (!matches) {
        useGraphStore.setState({
          selectionSource: 'canvas',
          selectedNodeId: current.id,
          selectedEdgeId: null,
          selectedGroupId: null,
          selectedNodeIds: [current.id],
          selectedEdgeIds: [],
          selectedGroupIds: [],
        })
      }
      if (matches && Date.now() >= current.untilMs) {
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
    const pending = String(pendingOpenWidgetNodeIdRef.current || '').trim()
    if (!pending) return
    const nodes = Array.isArray(graphData?.nodes) ? (graphData.nodes as GraphNode[]) : []
    const resolved = nodes.find(node => {
      const nodeId = String(node.id || '').trim()
      return nodeId === pending || nodeId.endsWith(`::${pending}`)
    })
    const openId = String(resolved?.id || pending).trim()
    if (!openId) return
    pendingOpenWidgetNodeIdRef.current = null
    updateOpenWidgetNodeIds(prev => (prev.includes(openId) ? prev : [...prev, openId]))
  }, [graphData, lastDroppedWidgetToken, updateOpenWidgetNodeIds])

  useStoryboardWidgetDropBridge({
    active,
    widgetDropCaptureEnabled,
    widgetDropBridgeOnly: true,
    geospatialWidgetPanelMode,
    rootRef,
    widgetRegistryRef,
    baseGraphData: graphData,
    draftGraphDataRef,
    reservedNodeIdsRef,
    pendingOverlayNodeIdRef,
    pendingOpenWidgetNodeIdRef,
    overlayNodeIdOverrideWasSelectedRef,
    overlayNodeIdOverrideUntilMsRef,
    lastDroppedWidgetNodeIdRef,
    zoomViewKeyRef,
    getLiveZoomTransform: () => null,
    appendDraftNode,
    updateNode,
    shouldDedupeWidgetDrop,
    scheduleForceSelect,
    setCanvasWindowOffsetFromRect: () => void 0,
    setOverlayNodeIdOverride,
    setPendingOverlayNode,
    setLastDroppedWidgetToken,
    upsertUiToast,
  })

  void overlayNodeIdOverride
  void pendingOverlayNode

  return <section ref={rootRef} className="absolute inset-0 pointer-events-none opacity-0" aria-hidden="true" />
}
