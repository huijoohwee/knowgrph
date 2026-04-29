import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { buildFlowWidgetEligibleNodeIdSet } from '@/lib/graph/flowWidgetEligibility'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { FORCE_SELECT_MAX_TICKS, FORCE_SELECT_TICK_MS, OVERLAY_NODE_OVERRIDE_LOCK_MS, WIDGET_DROP_DEDUPE_WINDOW_MS, resolveGraphNodeIdByCanonicalId } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'

export function useFlowEditorSelectionBookkeeping(args: {
  active: boolean
  editorRuntimeActive: boolean
  flowEditorViewActive: boolean
  overlayOnlyModeEnabled: boolean
  flowEditorFrontmatterGraphAvailable: boolean
  widgetRegistry: unknown
  draftGraphData: GraphData | null
  renderGraphDataOverride: GraphData | null
  selectedNodeId: string | null
  overlayNodeIdOverride: string | null
  pendingOverlayNode: GraphNode | null
  openWidgetNodeIdsRef: React.MutableRefObject<string[]>
  draftGraphDataRef: React.MutableRefObject<GraphData | null>
  widgetRegistryRef: React.MutableRefObject<any>
  lastWidgetDropRef: React.MutableRefObject<{ key: string; ts: number } | null>
  forceSelectRef: React.MutableRefObject<{ id: string; remaining: number; untilMs: number } | null>
  forceSelectTimerRef: React.MutableRefObject<number | null>
  pendingSelectNodeIdRef: React.MutableRefObject<string | null>
  reservedNodeIdsRef: React.MutableRefObject<Set<string>>
  pendingOpenWidgetNodeIdRef: React.MutableRefObject<string | null>
  pendingOverlayNodeIdRef: React.MutableRefObject<string | null>
  overlayNodeIdOverrideWasSelectedRef: React.MutableRefObject<boolean>
  overlayNodeIdOverrideUntilMsRef: React.MutableRefObject<number>
  setOpenWidgetNodeIds: (ids: string[]) => void
  updateOpenWidgetNodeIds: (updater: (prev: string[]) => string[]) => void
  setOverlayNodeIdOverride: React.Dispatch<React.SetStateAction<string | null>>
}) {
  React.useEffect(() => {
    args.openWidgetNodeIdsRef.current = Array.isArray((useGraphStore.getState() as any).openWidgetNodeIds)
      ? ((useGraphStore.getState() as any).openWidgetNodeIds as string[])
      : []
  })

  React.useEffect(() => {
    if (!args.editorRuntimeActive || !args.overlayOnlyModeEnabled || !args.draftGraphData || args.flowEditorFrontmatterGraphAvailable) return
    if (isFrontmatterFlowGraph(args.draftGraphData as GraphData)) return
    const nodes = Array.isArray(args.draftGraphData.nodes) ? (args.draftGraphData.nodes as GraphNode[]) : []
    const eligible = buildFlowWidgetEligibleNodeIdSet(nodes)
    const ids = Array.from(eligible)
    if (ids.length === 0 || ids.length > 120) return
    args.setOpenWidgetNodeIds(ids)
  }, [args])

  React.useEffect(() => {
    if (!args.editorRuntimeActive || !args.flowEditorViewActive || !args.draftGraphData) return
    const nodes = Array.isArray(args.draftGraphData.nodes) ? args.draftGraphData.nodes : []
    const idSet = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
    const eligible = buildFlowWidgetEligibleNodeIdSet(nodes as any)
    args.updateOpenWidgetNodeIds(prev => prev.filter(id => {
      const s = String(id || '')
      return idSet.has(s) && (eligible.size === 0 || eligible.has(s))
    }))
  }, [args])

  React.useEffect(() => {
    args.widgetRegistryRef.current = args.widgetRegistry
  }, [args.widgetRegistry, args.widgetRegistryRef])

  React.useEffect(() => {
    args.draftGraphDataRef.current = args.draftGraphData
  }, [args.draftGraphData, args.draftGraphDataRef])

  const shouldDedupeWidgetDrop = React.useCallback((key: string): boolean => {
    const now = Date.now()
    const last = args.lastWidgetDropRef.current
    if (last && last.key === key && now - last.ts <= WIDGET_DROP_DEDUPE_WINDOW_MS) return true
    args.lastWidgetDropRef.current = { key, ts: now }
    return false
  }, [args.lastWidgetDropRef])

  const scheduleForceSelect = React.useCallback((id: string, opts?: { minHoldMs?: number }) => {
    const nodeId = String(id || '').trim()
    if (!nodeId) return
    const now = Date.now()
    const minHoldMs = typeof opts?.minHoldMs === 'number' && Number.isFinite(opts.minHoldMs) ? Math.max(0, opts.minHoldMs) : 0
    const nextUntil = now + minHoldMs
    const existing = args.forceSelectRef.current
    if (!existing || existing.id !== nodeId) {
      args.forceSelectRef.current = { id: nodeId, remaining: FORCE_SELECT_MAX_TICKS, untilMs: nextUntil }
    } else if (nextUntil > existing.untilMs) {
      existing.untilMs = nextUntil
    }
    if (args.forceSelectTimerRef.current != null) return

    const tick = () => {
      args.forceSelectTimerRef.current = null
      const cur = args.forceSelectRef.current
      if (!cur) return
      if (cur.remaining <= 0) {
        args.forceSelectRef.current = null
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
      if (matches && Date.now() >= cur.untilMs) {
        args.forceSelectRef.current = null
        return
      }
      args.forceSelectTimerRef.current = setTimeout(tick, FORCE_SELECT_TICK_MS) as unknown as number
    }

    args.forceSelectTimerRef.current = setTimeout(tick, FORCE_SELECT_TICK_MS) as unknown as number
  }, [args.forceSelectRef, args.forceSelectTimerRef])

  React.useEffect(() => {
    return () => {
      if (args.forceSelectTimerRef.current != null) {
        try {
          clearTimeout(args.forceSelectTimerRef.current)
        } catch {
          void 0
        }
        args.forceSelectTimerRef.current = null
      }
      args.forceSelectRef.current = null
    }
  }, [args.forceSelectRef, args.forceSelectTimerRef])

  React.useEffect(() => {
    const pending = args.pendingSelectNodeIdRef.current
    if (!pending) return
    const nodes = Array.isArray(args.draftGraphData?.nodes) ? args.draftGraphData.nodes : []
    const found = nodes.find(n => String(n.id || '') === pending) || null
    if (!found) return
    args.pendingSelectNodeIdRef.current = null
    args.reservedNodeIdsRef.current.delete(pending)
    args.setOverlayNodeIdOverride(pending)
    args.overlayNodeIdOverrideWasSelectedRef.current = false
    args.overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
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
  }, [args.draftGraphData, args.overlayNodeIdOverrideUntilMsRef, args.overlayNodeIdOverrideWasSelectedRef, args.pendingSelectNodeIdRef, args.reservedNodeIdsRef, args.setOverlayNodeIdOverride, scheduleForceSelect])

  React.useEffect(() => {
    const pending = String(args.pendingOpenWidgetNodeIdRef.current || '').trim()
    if (!pending) return
    const nodes = Array.isArray(args.renderGraphDataOverride?.nodes) ? (args.renderGraphDataOverride.nodes as GraphNode[]) : []
    const resolvedPending = resolveGraphNodeIdByCanonicalId(args.renderGraphDataOverride as GraphData | null, pending) || pending
    const found = nodes.find(n => {
      const nodeId = String(n.id || '').trim()
      return !!nodeId && (nodeId === pending || nodeId === resolvedPending)
    }) || null
    if (!found) return
    args.pendingOpenWidgetNodeIdRef.current = null
    const openId = String(found.id || resolvedPending || pending).trim()
    if (!openId) return
    args.updateOpenWidgetNodeIds(prev => (prev.includes(openId) ? prev : [...prev, openId]))
  }, [args.pendingOpenWidgetNodeIdRef, args.renderGraphDataOverride, args.updateOpenWidgetNodeIds])

  React.useEffect(() => {
    const override = String(args.overlayNodeIdOverride || '').trim()
    if (!override) return
    const selected = String(args.selectedNodeId || '').trim()
    if (selected && selected === override) args.overlayNodeIdOverrideWasSelectedRef.current = true
  }, [args.overlayNodeIdOverride, args.overlayNodeIdOverrideWasSelectedRef, args.selectedNodeId])

  React.useEffect(() => {
    if (!args.active) return
    const override = String(args.overlayNodeIdOverride || '').trim()
    if (!override || Date.now() > args.overlayNodeIdOverrideUntilMsRef.current) return
    const selected = String(args.selectedNodeId || '').trim()
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
  }, [args.active, args.overlayNodeIdOverride, args.overlayNodeIdOverrideUntilMsRef, args.selectedNodeId])

  React.useEffect(() => {
    const override = String(args.overlayNodeIdOverride || '').trim()
    if (!override) return
    const now = Date.now()
    const selected = String(args.selectedNodeId || '').trim()
    if (args.overlayNodeIdOverrideWasSelectedRef.current && selected && selected !== override && now > args.overlayNodeIdOverrideUntilMsRef.current) {
      args.setOverlayNodeIdOverride(null)
      return
    }
    if (now <= args.overlayNodeIdOverrideUntilMsRef.current) return
    const nodes = Array.isArray(args.draftGraphData?.nodes) ? args.draftGraphData.nodes : []
    const found = nodes.find(n => String(n.id || '') === override) || null
    if (!found) args.setOverlayNodeIdOverride(null)
  }, [args.draftGraphData, args.overlayNodeIdOverride, args.overlayNodeIdOverrideUntilMsRef, args.overlayNodeIdOverrideWasSelectedRef, args.selectedNodeId, args.setOverlayNodeIdOverride])

  const selectedDraftNode = React.useMemo(() => {
    if (!args.draftGraphData || !args.selectedNodeId) return null
    return resolveGraphNodeByCanonicalId(args.draftGraphData, args.selectedNodeId)
  }, [args.draftGraphData, args.selectedNodeId])

  const overlayDraftNode = React.useMemo(() => {
    const override = String(args.overlayNodeIdOverride || '').trim()
    if (!override) return selectedDraftNode
    if (!args.draftGraphData) {
      const pending = args.pendingOverlayNodeIdRef.current
      if (pending && pending === override) return args.pendingOverlayNode
      return selectedDraftNode
    }
    const foundId = resolveGraphNodeIdByCanonicalId(args.draftGraphData, override)
    const found = foundId ? (args.draftGraphData.nodes || []).find(n => String(n.id || '').trim() === foundId) || null : null
    if (found) return found
    const pending = args.pendingOverlayNodeIdRef.current
    if (pending && pending === override) return args.pendingOverlayNode
    return selectedDraftNode
  }, [args.draftGraphData, args.overlayNodeIdOverride, args.pendingOverlayNode, args.pendingOverlayNodeIdRef, selectedDraftNode])

  return {
    overlayDraftNode,
    scheduleForceSelect,
    selectedDraftNode,
    shouldDedupeWidgetDrop,
  }
}
