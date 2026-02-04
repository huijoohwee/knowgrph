import React from 'react'
import type { GraphSchema } from '@/lib/graph/schema'
import { computePanelAwareCanvasDims } from '@/components/GraphCanvas/helpers'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { useGraphStore } from '@/hooks/useGraphStore'

export function useAutoZoomModes2d(args: { viewportW: number; viewportH: number; paused?: boolean }) {
  const scheduleFitRef = React.useRef<(() => void) | null>(null)
  const dimsRef = React.useRef({ viewportW: args.viewportW, viewportH: args.viewportH })
  React.useEffect(() => {
    dimsRef.current = { viewportW: args.viewportW, viewportH: args.viewportH }
    const schedule = scheduleFitRef.current
    if (schedule) schedule()
  }, [args.viewportH, args.viewportW])

  const pausedRef = React.useRef<boolean>(!!args.paused)
  React.useEffect(() => {
    pausedRef.current = !!args.paused
  }, [args.paused])

  const lastFitSigRef = React.useRef<string | null>(null)
  const lastAutoZoomSelRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pausedRef.current) return
        const state = useGraphStore.getState()
        if (state.viewPinned) {
          lastFitSigRef.current = null
          return
        }
        if (state.zoomToSelectionMode) {
          lastFitSigRef.current = null
          return
        }
        if (!state.fitToScreenMode) {
          lastFitSigRef.current = null
          return
        }
        const nodes = Array.isArray(state.graphData?.nodes) ? state.graphData.nodes : []
        if (nodes.length === 0) return
        const panelDims = computePanelAwareCanvasDims(
          Math.max(1, Math.floor(dimsRef.current.viewportW)),
          Math.max(1, Math.floor(dimsRef.current.viewportH)),
          !!state.isSidebarOpen,
          state.sidebarWidthRatio,
        )
        const schema = state.schema as GraphSchema | null
        const [minScale, maxScale] = schema ? readZoomScaleExtent(schema) : [0.1, 4]
        const fitSig = schema
          ? `${String(schema.layout?.fitPadding ?? '')}|${String(schema.layout?.fitDetectClusters ?? '')}|${String(
              schema.layout?.fitTargetAspectRatio ?? '',
            )}|${String(schema.layout?.fitEnforceAspectRatio ?? '')}|${minScale}|${maxScale}|${String(state.mediaPanelDensity ?? '')}|${String(
              state.renderMediaAsNodes ? 1 : 0,
            )}`
          : `${minScale}|${maxScale}|${String(state.mediaPanelDensity ?? '')}|${String(state.renderMediaAsNodes ? 1 : 0)}`
        const sig = `${nodes.length}|${panelDims.width}x${panelDims.height}|${state.graphDataRevision}|${fitSig}`
        if (lastFitSigRef.current === sig) return
        lastFitSigRef.current = sig
        state.requestZoom('fit', { intent: 'fitToScreen' })
      })
    }
    scheduleFitRef.current = schedule
    schedule()
    const unsub = useGraphStore.subscribe(
      s => ({
        fitToScreenMode: s.fitToScreenMode,
        zoomToSelectionMode: s.zoomToSelectionMode,
        viewPinned: s.viewPinned,
        graphDataRevision: s.graphDataRevision,
        graphNodeCount: Array.isArray(s.graphData?.nodes) ? s.graphData.nodes.length : 0,
        isSidebarOpen: s.isSidebarOpen,
        sidebarWidthRatio: s.sidebarWidthRatio,
        fitPadding: s.schema?.layout?.fitPadding,
        fitDetectClusters: s.schema?.layout?.fitDetectClusters,
        fitTargetAspectRatio: s.schema?.layout?.fitTargetAspectRatio,
        fitEnforceAspectRatio: s.schema?.layout?.fitEnforceAspectRatio,
        zoomMinScale: s.schema?.performance?.zoom?.minScale,
        zoomMaxScale: s.schema?.performance?.zoom?.maxScale,
        mediaPanelDensity: s.mediaPanelDensity,
        renderMediaAsNodes: s.renderMediaAsNodes,
      }),
      () => schedule(),
    )
    return () => {
      unsub()
      scheduleFitRef.current = null
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  React.useEffect(() => {
    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pausedRef.current) return
        const state = useGraphStore.getState()
        if (state.viewPinned) {
          lastAutoZoomSelRef.current = null
          return
        }
        if (!state.zoomToSelectionMode) {
          lastAutoZoomSelRef.current = null
          return
        }
        const schema = state.schema as GraphSchema | null
        const expansionCfg = schema?.behavior?.expansion || {}
        const expansionEnabled = expansionCfg.enabled !== false
        const zoomOnSelection = expansionEnabled && expansionCfg.zoomOnSelection !== false
        if (!zoomOnSelection) return
        const nodeIds =
          Array.isArray(state.selectedNodeIds) && state.selectedNodeIds.length > 0
            ? state.selectedNodeIds
            : state.selectedNodeId
              ? [state.selectedNodeId]
              : []
        const edgeIds =
          Array.isArray(state.selectedEdgeIds) && state.selectedEdgeIds.length > 0
            ? state.selectedEdgeIds
            : state.selectedEdgeId
              ? [state.selectedEdgeId]
              : []
        if (nodeIds.length === 0 && edgeIds.length === 0) return
        const key = `${nodeIds.join(',')}|${edgeIds.join(',')}|${state.graphDataRevision}`
        if (lastAutoZoomSelRef.current === key) return
        lastAutoZoomSelRef.current = key
        state.requestZoom('selection')
      })
    }
    const unsub = useGraphStore.subscribe(
      s => ({
        zoomToSelectionMode: s.zoomToSelectionMode,
        selectedNodeId: s.selectedNodeId,
        selectedEdgeId: s.selectedEdgeId,
        selectedNodeIds: s.selectedNodeIds,
        selectedEdgeIds: s.selectedEdgeIds,
        graphDataRevision: s.graphDataRevision,
        viewPinned: s.viewPinned,
      }),
      () => schedule(),
    )
    return () => {
      unsub()
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])
}
