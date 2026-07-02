import React from 'react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { FORCE_SELECT_MAX_TICKS, FORCE_SELECT_TICK_MS, OVERLAY_NODE_OVERRIDE_LOCK_MS, WIDGET_DROP_DEDUPE_WINDOW_MS, resolveGraphNodeIdByCanonicalId } from '@/components/StoryboardWidgetCanvas/storyboardWidgetCanvasShared'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { isCanonicalNodeIdEqual, parseCanonicalNodeIds, resolveGraphNodeByCanonicalId, splitComposedNodeId } from '@/lib/graph/canonicalNodeIds'
import { getCachedStoryboardWidgetRenderGraph } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetRenderGraph'
import { isFlowWidgetOverlayEligibleNode } from '@/lib/graph/flowWidgetEligibility'
import { reportRuntimeTrace } from '@/lib/debug/runtimeTrace'

// #region debug-point A:selection-bookkeeping
const STORYBOARD_MEDIA_PANEL_LOOP_TRACE_SCOPE = 'storyboard-media-panel-loop'
const reportStoryboardMediaPanelLoopSelectionDebug = (args: {
  hypothesisId: 'A' | 'B' | 'C' | 'D' | 'E'
  location: string
  msg: string
  data?: Record<string, unknown>
}) => {
  reportRuntimeTrace({
    scope: STORYBOARD_MEDIA_PANEL_LOOP_TRACE_SCOPE,
    runId: 'runtime',
    hypothesisId: args.hypothesisId,
    location: args.location,
    msg: args.msg,
    data: args.data || {},
  })
}
// #endregion

export function useStoryboardWidgetSelectionBookkeeping(args: {
  active: boolean
  editorRuntimeActive: boolean
  storyboardWidgetViewActive: boolean
  canvas2dRenderer: string
  overlayOnlyModeEnabled: boolean
  storyboardWidgetFrontmatterGraphAvailable: boolean
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
    storyboardWidgetViewActive,
    canvas2dRenderer,
    overlayOnlyModeEnabled,
    storyboardWidgetFrontmatterGraphAvailable,
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
    return getCachedStoryboardWidgetRenderGraph({
      scope: 'storyboard-widget-selection-bookkeeping-draft-graph',
      graphData: draftGraphData,
      graphRevision: draftGraphDataRevision,
      preferCurrentGraphDataRefs: true,
    })
  }, [draftGraphData, draftGraphDataRevision])
  const renderGraphDataOverrideRevision = React.useMemo(
    () => readGraphDataRevision(renderGraphDataOverride),
    [renderGraphDataOverride],
  )
  const renderGraphLookup = React.useMemo(() => {
    return getCachedStoryboardWidgetRenderGraph({
      scope: 'storyboard-widget-selection-bookkeeping-render-graph',
      graphData: renderGraphDataOverride,
      graphRevision: renderGraphDataOverrideRevision,
      preferCurrentGraphDataRefs: true,
    })
  }, [renderGraphDataOverride, renderGraphDataOverrideRevision])

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
    if (!editorRuntimeActive || !overlayOnlyModeEnabled || !draftGraphData || storyboardWidgetFrontmatterGraphAvailable) return
    if (isFrontmatterFlowGraph(draftGraphData as GraphData)) return
    const focusedOverlayNodeId = String(
      overlayNodeIdOverride
      || pendingOverlayNode?.id
      || pendingOverlayNodeIdRef.current
      || pendingOpenWidgetNodeIdRef.current
      || '',
    ).trim()
    if (focusedOverlayNodeId) return
    const ids = Array.from(draftGraphLookup?.nodeById.entries() || [])
      .filter(([, node]) => isFlowWidgetOverlayEligibleNode(node))
      .map(([id]) => String(id || '').trim())
      .filter(Boolean)
    if (ids.length === 0 || ids.length > 120) return
    setOpenWidgetNodeIds(ids)
  }, [
    draftGraphData,
    editorRuntimeActive,
    storyboardWidgetFrontmatterGraphAvailable,
    overlayOnlyModeEnabled,
    overlayNodeIdOverride,
    pendingOpenWidgetNodeIdRef,
    pendingOverlayNode,
    pendingOverlayNodeIdRef,
    setOpenWidgetNodeIds,
    draftGraphLookup,
  ])

  React.useEffect(() => {
    if (!editorRuntimeActive || !storyboardWidgetViewActive || !draftGraphData) return
    const graphLookupForOpenWidgetCleanup =
      (draftGraphLookup?.nodeById.size || 0) > 0
        ? draftGraphLookup
        : (renderGraphLookup?.nodeById.size || 0) > 0
          ? renderGraphLookup
          : null
    if (!graphLookupForOpenWidgetCleanup) return
    const protectedPendingOpenWidgetIds = [
      String(pendingOverlayNode?.id || '').trim(),
      String(pendingOverlayNodeIdRef.current || '').trim(),
      String(pendingOpenWidgetNodeIdRef.current || '').trim(),
      String(pendingSelectNodeIdRef.current || '').trim(),
    ].filter(Boolean)
    const idSet = new Set<string>(graphLookupForOpenWidgetCleanup.nodeById.keys() || [])
    const overlayEligible = new Set<string>(
      Array.from(graphLookupForOpenWidgetCleanup.nodeById.entries() || [])
        .filter(([, node]) => isFlowWidgetOverlayEligibleNode(node))
        .map(([id]) => String(id || '').trim())
        .filter(Boolean),
    )
    const preserveStoryboardGraphNodeIds = canvas2dRenderer === 'storyboard'
    updateOpenWidgetNodeIds(prev => prev.filter(id => {
      const s = String(id || '')
      const protectedPendingOpenWidgetId = protectedPendingOpenWidgetIds.some(protectedId => isCanonicalNodeIdEqual(protectedId, s))
      if (protectedPendingOpenWidgetId) return true
      return idSet.has(s) && (
        preserveStoryboardGraphNodeIds
        || overlayEligible.size === 0
        || overlayEligible.has(s)
      )
    }))
  }, [
    canvas2dRenderer,
    draftGraphData,
    editorRuntimeActive,
    storyboardWidgetViewActive,
    pendingOpenWidgetNodeIdRef,
    pendingOverlayNode,
    pendingOverlayNodeIdRef,
    pendingSelectNodeIdRef,
    renderGraphLookup,
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
      // #region debug-point B:force-select-tick
      reportStoryboardMediaPanelLoopSelectionDebug({
        hypothesisId: 'A',
        location: 'useStoryboardWidgetSelectionBookkeeping.ts:force-select-tick',
        msg: 'force-select tick observed selection state',
        data: {
          active,
          curId: cur.id,
          selectedNodeId: selected,
          matches,
          remaining: cur.remaining,
          untilMs: cur.untilMs,
          canvas2dRenderer: String((st as { canvas2dRenderer?: unknown }).canvas2dRenderer || ''),
          openWidgetNodeIds: Array.isArray((st as { openWidgetNodeIds?: unknown[] }).openWidgetNodeIds)
            ? (st as { openWidgetNodeIds?: unknown[] }).openWidgetNodeIds!.map(id => String(id || '').trim()).filter(Boolean)
            : [],
          rendererScopedOpenWidgetNodeIds: Array.isArray((st as { openWidgetNodeIdsByRenderer?: Record<string, unknown[]> }).openWidgetNodeIdsByRenderer?.[String((st as { canvas2dRenderer?: unknown }).canvas2dRenderer || '')])
            ? ((st as { openWidgetNodeIdsByRenderer?: Record<string, unknown[]> }).openWidgetNodeIdsByRenderer?.[String((st as { canvas2dRenderer?: unknown }).canvas2dRenderer || '')] || []).map(id => String(id || '').trim()).filter(Boolean)
            : [],
        },
      })
      // #endregion
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
    const found = resolveDraftGraphNode(pending) || resolveGraphNodeByCanonicalId(draftGraphData, pending)
    if (!found) return
    const resolvedPendingId = String(found.id || pending).trim()
    if (!resolvedPendingId) {
      pendingSelectNodeIdRef.current = null
      reservedNodeIdsRef.current.delete(pending)
      return
    }
    const currentSelectedNodeId = String(useGraphStore.getState().selectedNodeId || '').trim()
    const alreadySelectedPending = isCanonicalNodeIdEqual(currentSelectedNodeId, resolvedPendingId)
    const alreadyUsingPendingOverride = isCanonicalNodeIdEqual(overlayNodeIdOverride, resolvedPendingId)
    // #region debug-point C:pending-select-resolve
    reportStoryboardMediaPanelLoopSelectionDebug({
      hypothesisId: 'A',
      location: 'useStoryboardWidgetSelectionBookkeeping.ts:pending-select-resolve',
      msg: 'pending selection resolved against draft graph',
      data: {
        pending,
        resolvedPendingId,
        currentSelectedNodeId,
        overlayNodeIdOverride: String(overlayNodeIdOverride || '').trim(),
        alreadySelectedPending,
        alreadyUsingPendingOverride,
      },
    })
    // #endregion
    pendingSelectNodeIdRef.current = null
    reservedNodeIdsRef.current.delete(pending)
    reservedNodeIdsRef.current.delete(resolvedPendingId)
    if (!alreadyUsingPendingOverride) setOverlayNodeIdOverride(resolvedPendingId)
    overlayNodeIdOverrideWasSelectedRef.current = false
    overlayNodeIdOverrideUntilMsRef.current = Date.now() + OVERLAY_NODE_OVERRIDE_LOCK_MS
    if (!alreadySelectedPending) {
      useGraphStore.setState({
        selectionSource: 'canvas',
        selectedNodeId: resolvedPendingId,
        selectedEdgeId: null,
        selectedGroupId: null,
        selectedNodeIds: [resolvedPendingId],
        selectedEdgeIds: [],
        selectedGroupIds: [],
      })
    }
    scheduleForceSelect(resolvedPendingId, { minHoldMs: 250 })
  }, [
    draftGraphData,
    draftGraphLookup,
    overlayNodeIdOverride,
    overlayNodeIdOverrideUntilMsRef,
    overlayNodeIdOverrideWasSelectedRef,
    pendingSelectNodeIdRef,
    reservedNodeIdsRef,
    resolveDraftGraphNode,
    scheduleForceSelect,
    setOverlayNodeIdOverride,
  ])

  React.useEffect(() => {
    const pending = String(pendingOpenWidgetNodeIdRef.current || '').trim()
    if (!pending) return
    const resolvedPending = resolveGraphNodeIdByCanonicalId(renderGraphDataOverride as GraphData | null, pending) || pending
    const pendingOverlayNodeMatch =
      pendingOverlayNode && isCanonicalNodeIdEqual(String(pendingOverlayNode.id || '').trim(), resolvedPending || pending)
        ? pendingOverlayNode
        : null
    const found = resolveGraphNodeByCanonicalId(renderGraphDataOverride as GraphData | null, resolvedPending || pending)
      || pendingOverlayNodeMatch
    if (!found) {
      // #region debug-point E:pending-open-miss
      reportStoryboardMediaPanelLoopSelectionDebug({
        hypothesisId: 'C',
        location: 'useStoryboardWidgetSelectionBookkeeping.ts:pending-open-miss',
        msg: 'pending open widget id is not yet present in renderGraphDataOverride',
        data: {
          pending,
          resolvedPending,
          renderGraphNodeCount: Array.isArray(renderGraphDataOverride?.nodes) ? renderGraphDataOverride.nodes.length : 0,
          pendingOverlayNodeId: String(pendingOverlayNode?.id || '').trim(),
        },
      })
      // #endregion
      return
    }
    pendingOpenWidgetNodeIdRef.current = null
    const openId = String(found.id || resolvedPending || pending).trim()
    if (!openId) return
    if (!isFlowWidgetOverlayEligibleNode(found)) return
    // #region debug-point F:pending-open-resolve
    reportStoryboardMediaPanelLoopSelectionDebug({
      hypothesisId: 'C',
      location: 'useStoryboardWidgetSelectionBookkeeping.ts:pending-open-resolve',
      msg: 'pending open widget id resolved in renderGraphDataOverride',
      data: {
        pending,
        resolvedPending,
        openId,
        nodeType: String(found.type || '').trim(),
      },
    })
    // #endregion
    updateOpenWidgetNodeIds(prev => (prev.includes(openId) ? prev : [...prev, openId]))
  }, [pendingOpenWidgetNodeIdRef, pendingOverlayNode, renderGraphDataOverride, updateOpenWidgetNodeIds])

  React.useEffect(() => {
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override) return
    const selected = String(selectedNodeId || '').trim()
    if (selected && isCanonicalNodeIdEqual(selected, override)) {
      overlayNodeIdOverrideWasSelectedRef.current = true
    }
  }, [overlayNodeIdOverride, overlayNodeIdOverrideWasSelectedRef, selectedNodeId])

  React.useEffect(() => {
    if (!active) return
    const override = String(overlayNodeIdOverride || '').trim()
    if (!override || Date.now() > overlayNodeIdOverrideUntilMsRef.current) return
    const selected = String(selectedNodeId || '').trim()
    if (selected && isCanonicalNodeIdEqual(selected, override)) return
    // #region debug-point D:override-force-select
    reportStoryboardMediaPanelLoopSelectionDebug({
      hypothesisId: 'A',
      location: 'useStoryboardWidgetSelectionBookkeeping.ts:override-force-select',
      msg: 'overlay override is forcing selected node id',
      data: {
        override,
        selected,
        active,
        overrideUntilMs: overlayNodeIdOverrideUntilMsRef.current,
      },
    })
    // #endregion
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
    const selectedMatchesOverride = selected ? isCanonicalNodeIdEqual(selected, override) : false
    if (overlayNodeIdOverrideWasSelectedRef.current && selected && !selectedMatchesOverride && now > overlayNodeIdOverrideUntilMsRef.current) {
      setOverlayNodeIdOverride(null)
      return
    }
    if (now <= overlayNodeIdOverrideUntilMsRef.current) return
    const found = resolveDraftGraphNode(override) || resolveGraphNodeByCanonicalId(draftGraphData, override)
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
