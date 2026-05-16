import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { FORCE_SELECT_MAX_TICKS, FORCE_SELECT_TICK_MS, OVERLAY_NODE_OVERRIDE_LOCK_MS, WIDGET_DROP_DEDUPE_WINDOW_MS, resolveGraphNodeIdByCanonicalId } from '@/components/FlowEditorCanvas/flowEditorCanvasShared'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { parseCanonicalNodeIds, resolveGraphNodeByCanonicalId, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import { getCachedFlowEditorRenderGraph } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'
import { isFlowWidgetOverlayEligibleNode } from '@/lib/graph/flowWidgetEligibility'

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
  const {
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
  } = args
  const draftGraphDataRevision = React.useMemo(() => readGraphDataRevision(draftGraphData), [draftGraphData])
  const draftGraphLookup = React.useMemo(() => {
    return getCachedFlowEditorRenderGraph({
      scope: 'flow-editor-selection-bookkeeping-draft-graph',
      graphData: draftGraphData,
      graphRevision: draftGraphDataRevision,
      preferCurrentGraphDataRefs: true,
    })
  }, [draftGraphData, draftGraphDataRevision])

  const resolveDraftGraphNode = React.useCallback((rawId: unknown): GraphNode | null => {
    if (!draftGraphLookup) return null
    const candidateIds = parseCanonicalNodeIds(rawId)
    if (candidateIds.length === 0) return null
    for (let i = 0; i < candidateIds.length; i += 1) {
      const exact = draftGraphLookup.nodeById.get(candidateIds[i] || '') || null
      if (exact) return exact
    }
    let resolvedInnerId = ''
    for (let i = 0; i < candidateIds.length; i += 1) {
      const innerId = splitComposedNodeId(candidateIds[i]).inner
      if (!innerId) continue
      const matches = draftGraphLookup.nodeIdsByInnerId.get(innerId) || []
      if (matches.length === 1) {
        resolvedInnerId = matches[0] || ''
        break
      }
    }
    return resolvedInnerId ? draftGraphLookup.nodeById.get(resolvedInnerId) || null : null
  }, [draftGraphLookup])

  React.useEffect(() => {
    if (!editorRuntimeActive || !overlayOnlyModeEnabled || !draftGraphData || flowEditorFrontmatterGraphAvailable) return
    if (isFrontmatterFlowGraph(draftGraphData as GraphData)) return
    const ids = Array.from(draftGraphLookup?.nodeById.entries() || [])
      .filter(([, node]) => isFlowWidgetOverlayEligibleNode(node))
      .map(([id]) => String(id || '').trim())
      .filter(Boolean)
    if (ids.length === 0 || ids.length > 120) return
    setOpenWidgetNodeIds(ids)
  }, [
    draftGraphData,
    editorRuntimeActive,
    flowEditorFrontmatterGraphAvailable,
    overlayOnlyModeEnabled,
    setOpenWidgetNodeIds,
    draftGraphLookup,
  ])

  React.useEffect(() => {
    if (!editorRuntimeActive || !flowEditorViewActive || !draftGraphData) return
    const idSet = new Set<string>(draftGraphLookup?.nodeById.keys() || [])
    const overlayEligible = new Set<string>(
      Array.from(draftGraphLookup?.nodeById.entries() || [])
        .filter(([, node]) => isFlowWidgetOverlayEligibleNode(node))
        .map(([id]) => String(id || '').trim())
        .filter(Boolean),
    )
    updateOpenWidgetNodeIds(prev => prev.filter(id => {
      const s = String(id || '')
      return idSet.has(s) && (overlayEligible.size === 0 || overlayEligible.has(s))
    }))
  }, [
    draftGraphData,
    editorRuntimeActive,
    flowEditorViewActive,
    updateOpenWidgetNodeIds,
    draftGraphLookup,
  ])

  React.useEffect(() => {
    widgetRegistryRef.current = widgetRegistry
  }, [widgetRegistry, widgetRegistryRef])

  React.useEffect(() => {
    draftGraphDataRef.current = draftGraphData
  }, [draftGraphData, draftGraphDataRef])

  const shouldDedupeWidgetDrop = React.useCallback((key: string): boolean => {
    const now = Date.now()
    const last = lastWidgetDropRef.current
    if (last && last.key === key && now - last.ts <= WIDGET_DROP_DEDUPE_WINDOW_MS) return true
    lastWidgetDropRef.current = { key, ts: now }
    return false
  }, [lastWidgetDropRef])

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
      if (matches && Date.now() >= cur.untilMs) {
        forceSelectRef.current = null
        return
      }
      forceSelectTimerRef.current = setTimeout(tick, FORCE_SELECT_TICK_MS) as unknown as number
    }

    forceSelectTimerRef.current = setTimeout(tick, FORCE_SELECT_TICK_MS) as unknown as number
  }, [forceSelectRef, forceSelectTimerRef])

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
  }, [forceSelectRef, forceSelectTimerRef])

  React.useEffect(() => {
    const pending = pendingSelectNodeIdRef.current
    if (!pending) return
    const found = draftGraphLookup?.nodeById.get(pending) || null
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
  }, [
    draftGraphData,
    draftGraphLookup,
    overlayNodeIdOverrideUntilMsRef,
    overlayNodeIdOverrideWasSelectedRef,
    pendingSelectNodeIdRef,
    reservedNodeIdsRef,
    scheduleForceSelect,
    setOverlayNodeIdOverride,
  ])

  React.useEffect(() => {
    const pending = String(pendingOpenWidgetNodeIdRef.current || '').trim()
    if (!pending) return
    const resolvedPending = resolveGraphNodeIdByCanonicalId(renderGraphDataOverride as GraphData | null, pending) || pending
    const found = resolveGraphNodeByCanonicalId(renderGraphDataOverride as GraphData | null, resolvedPending || pending)
    if (!found) return
    pendingOpenWidgetNodeIdRef.current = null
    const openId = String(found.id || resolvedPending || pending).trim()
    if (!openId) return
    if (!isFlowWidgetOverlayEligibleNode(found)) return
    updateOpenWidgetNodeIds(prev => (prev.includes(openId) ? prev : [...prev, openId]))
  }, [pendingOpenWidgetNodeIdRef, renderGraphDataOverride, updateOpenWidgetNodeIds])

  React.useEffect(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return
    const selected = String(selectedNodeId || '').trim()
    if (selected && selected === override) overlayNodeIdOverrideWasSelectedRef.current = true
  }, [overlayNodeIdOverride, overlayNodeIdOverrideWasSelectedRef, selectedNodeId])

  React.useEffect(() => {
    if (!active) return
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override || Date.now() > overlayNodeIdOverrideUntilMsRef.current) return
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
  }, [active, overlayNodeIdOverride, overlayNodeIdOverrideUntilMsRef, selectedNodeId])

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
    const found = draftGraphLookup?.nodeById.get(override) || null
    if (!found) setOverlayNodeIdOverride(null)
  }, [
    draftGraphData,
    draftGraphLookup,
    overlayNodeIdOverride,
    overlayNodeIdOverrideUntilMsRef,
    overlayNodeIdOverrideWasSelectedRef,
    selectedNodeId,
    setOverlayNodeIdOverride,
  ])

  const selectedDraftNode = React.useMemo(() => {
    if (!draftGraphData || !selectedNodeId) return null
    return resolveDraftGraphNode(selectedNodeId) || resolveGraphNodeByCanonicalId(draftGraphData, selectedNodeId)
  }, [draftGraphData, selectedNodeId, resolveDraftGraphNode])

  const overlayDraftNode = React.useMemo(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return selectedDraftNode
    if (!draftGraphData) {
      const pending = pendingOverlayNodeIdRef.current
      if (pending && pending === override) return pendingOverlayNode
      return selectedDraftNode
    }
    const found = resolveDraftGraphNode(override)
      || (() => {
        const foundId = resolveGraphNodeIdByCanonicalId(draftGraphData, override)
        return foundId ? draftGraphLookup?.nodeById.get(foundId) || null : null
      })()
    if (found) return found
    const pending = pendingOverlayNodeIdRef.current
    if (pending && pending === override) return pendingOverlayNode
    return selectedDraftNode
  }, [
    draftGraphLookup,
    draftGraphData,
    overlayNodeIdOverride,
    pendingOverlayNode,
    pendingOverlayNodeIdRef,
    resolveDraftGraphNode,
    selectedDraftNode,
  ])

  return {
    overlayDraftNode,
    scheduleForceSelect,
    selectedDraftNode,
    shouldDedupeWidgetDrop,
  }
}
