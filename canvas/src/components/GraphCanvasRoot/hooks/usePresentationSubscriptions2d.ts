import { useEffect, type MutableRefObject, type RefObject } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'

export function useSelectionRerenderSubscription2d(args: {
  active: boolean
  beforeRenderFrameRef: MutableRefObject<(() => void) | null>
}): void {
  const { active, beforeRenderFrameRef } = args

  useEffect(() => {
    if (!active) return
    const unsubscribe = useGraphStore.subscribe(
      s => `${s.selectedNodeId || ''}:${s.selectedEdgeId || ''}:${s.selectedGroupId || ''}`,
      () => {
        const fn = beforeRenderFrameRef.current
        if (!fn) return
        try {
          fn()
        } catch {
          void 0
        }
      },
    )
    return () => {
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [active, beforeRenderFrameRef])
}

export function useZoomScaleReapplySubscription2d(args: {
  active: boolean
  svgRef: RefObject<SVGSVGElement | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
}): void {
  const { active, svgRef, zoomRef } = args

  useEffect(() => {
    if (!active) return
    const unsubscribe = useGraphStore.subscribe(
      s =>
        [
          s.zoomLabelScaleMode2d,
          s.zoomLabelScaleExponent2d,
          s.zoomLabelScaleClampMin2d,
          s.zoomLabelScaleClampMax2d,
          s.zoomStrokeScaleMode2d,
          s.zoomStrokeScaleExponent2d,
          s.zoomStrokeScaleClampMin2d,
          s.zoomStrokeScaleClampMax2d,
        ].join(':'),
      () => {
        const svgEl = svgRef.current
        const zoom = zoomRef.current
        if (!svgEl || !zoom) return
        try {
          const svg = d3.select(svgEl)
          const t0 = d3.zoomTransform(svgEl)
          svg.call(
            zoom.transform as unknown as (
              sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
              t: d3.ZoomTransform,
            ) => void,
            t0,
          )
        } catch {
          void 0
        }
      },
    )
    return () => {
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [active, svgRef, zoomRef])
}

