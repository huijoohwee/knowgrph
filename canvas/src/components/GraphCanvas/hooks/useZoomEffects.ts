import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { GraphSchema } from '@/lib/graph/schema'
import { computePanelAwareCanvasDims } from '@/components/GraphCanvas/helpers'
import { applyZoomRequest, type ZoomRequest } from '@/components/GraphCanvas/zoomController'
import { useGraphStore } from '@/hooks/useGraphStore'

interface UseZoomEffectsProps {
  svgRef: React.RefObject<SVGSVGElement>
  zoomRef: React.MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  width: number
  height: number
  paused?: boolean
}

export function useZoomEffects({
  svgRef,
  zoomRef,
  width,
  height,
  paused,
}: UseZoomEffectsProps) {
  const dimsRef = useRef({ width, height })
  useEffect(() => {
    dimsRef.current = { width, height }
  }, [width, height])

  const lastFitSigRef = useRef<string | null>(null)
  const lastAutoZoomSelRef = useRef<string | null>(null)

  useEffect(() => {
    if (paused) return
    let rafId: number | null = null
    const apply = (zoomRequest: ZoomRequest | null) => {
      if (!zoomRequest || !svgRef.current || !zoomRef.current) return
      const state = useGraphStore.getState()
      const svg = d3.select(svgRef.current)
      const panelDims = computePanelAwareCanvasDims(
        Math.max(1, Math.floor(dimsRef.current.width)),
        Math.max(1, Math.floor(dimsRef.current.height)),
        !!state.isSidebarOpen,
        state.sidebarWidthRatio,
      )
      applyZoomRequest(zoomRequest, {
        svg,
        zoom: zoomRef.current,
        graphData: state.graphData,
        width: panelDims.width,
        height: panelDims.height,
        selectedNodeId: state.selectedNodeId,
        selectedEdgeId: state.selectedEdgeId,
        selectedNodeIds: state.selectedNodeIds,
        selectedEdgeIds: state.selectedEdgeIds,
      })
    }
    const schedule = (zoomRequest: ZoomRequest | null) => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        apply(zoomRequest)
      })
    }
    const unsubZoomRequest = useGraphStore.subscribe(
      s => s.zoomRequest,
      zoomRequest => schedule(zoomRequest),
    )
    return () => {
      unsubZoomRequest()
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [paused, svgRef, zoomRef])

  useEffect(() => {
    if (paused) return
    const applyFitIfNeeded = () => {
      const state = useGraphStore.getState()
      if (state.viewPinned) return
      if (!state.fitToScreenMode) {
        lastFitSigRef.current = null
        return
      }
      const nodes = Array.isArray(state.graphData?.nodes) ? state.graphData.nodes : []
      if (nodes.length === 0) return
      const sig = `${nodes.length}|${Math.max(1, Math.floor(dimsRef.current.width))}|${Math.max(
        1,
        Math.floor(dimsRef.current.height),
      )}|${state.graphDataRevision}`
      if (lastFitSigRef.current === sig) return
      lastFitSigRef.current = sig
      state.requestZoom('fit')
    }
    applyFitIfNeeded()
  }, [paused, width, height])

  useEffect(() => {
    if (paused) return
    let rafId: number | null = null
    const schedule = () => {
      if (rafId != null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const state = useGraphStore.getState()
        if (state.viewPinned) return
        if (!state.zoomToSelectionMode) return
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
  }, [paused])
}
