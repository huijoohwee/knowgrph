import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
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
}
