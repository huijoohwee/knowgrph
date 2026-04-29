import React from 'react'
import * as d3 from 'd3'
import { useZoomEffects } from '@/components/GraphCanvas/hooks/useZoomEffects'
import { createZoom } from '@/components/GraphCanvas/zoom'
import { useAutoZoomModes2d } from '@/features/zoom/useAutoZoomModes2d'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { commitZoomTransformToStore } from '@/lib/canvas/zoom-commit'
import { pickZoomStateForView } from '@/lib/canvas/zoom-effective'
import { createRafLatestScheduler } from '@/lib/react/rafLatestScheduler'
import { pickInitialZoomTransform } from '@/lib/zoom/viewport'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'

type ZoomBehaviorRef = React.MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
type SvgRef = React.MutableRefObject<SVGSVGElement | null>
type GroupRef = React.MutableRefObject<SVGGElement | null>
type LabelsRef = React.MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>

type UseZoomInitControllerArgs = {
  active: boolean
  svgRef: SvgRef
  gRef: GroupRef
  zoomRef: ZoomBehaviorRef
  labelsSelRef: LabelsRef
  viewportW: number
  viewportH: number
  localGraphData: GraphData
  localGraphDataRef: React.MutableRefObject<GraphData>
  graphDataRevision: number
  canvasRenderMode: unknown
  canvas2dRenderer: unknown
  schema: GraphSchema | null | undefined
  viewportControlsPreset: unknown
  documentSemanticMode: unknown
  frontmatterModeEnabled: unknown
  documentStructureBaselineLock: unknown
  renderMediaAsNodes: unknown
  mediaPanelDensity: unknown
  collapsedGroupIds: unknown
  webpageLayoutKey: string
}

function centerGraphTransform(args: {
  graphData: GraphData
  viewportW: number
  viewportH: number
}): { x: number; y: number; k: number } | null {
  const nodes = Array.isArray(args.graphData.nodes) ? (args.graphData.nodes as GraphNode[]) : []
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 }
  let sumX = 0
  let sumY = 0
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i] as unknown as { x?: unknown; y?: unknown; properties?: unknown }
    const x0 = typeof node?.x === 'number' && Number.isFinite(node.x) ? (node.x as number) : null
    const y0 = typeof node?.y === 'number' && Number.isFinite(node.y) ? (node.y as number) : null
    if (x0 == null || y0 == null) continue
    const props =
      node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)
        ? (node.properties as Record<string, unknown>)
        : {}
    const width = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : 0
    const height = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : 0
    sumX += x0 + width / 2
    sumY += y0 + height / 2
    count += 1
  }
  if (count <= 0) return { x: 0, y: 0, k: 1 }
  const cx = sumX / count
  const cy = sumY / count
  const k = 1
  return {
    x: args.viewportW / 2 - cx * k,
    y: args.viewportH / 2 - cy * k,
    k,
  }
}

export function useZoomInitController(args: UseZoomInitControllerArgs) {
  const {
    active,
    svgRef,
    gRef,
    zoomRef,
    labelsSelRef,
    viewportW,
    viewportH,
    localGraphData,
    localGraphDataRef,
    graphDataRevision,
    canvasRenderMode,
    canvas2dRenderer,
    schema,
    viewportControlsPreset,
    documentSemanticMode,
    frontmatterModeEnabled,
    documentStructureBaselineLock,
    renderMediaAsNodes,
    mediaPanelDensity,
    collapsedGroupIds,
    webpageLayoutKey,
  } = args

  const dimsRef = React.useRef({ width: viewportW, height: viewportH })
  React.useEffect(() => {
    dimsRef.current = { width: viewportW, height: viewportH }
  }, [viewportH, viewportW])

  const zoomCommitSchedulerRef = React.useRef(
    createRafLatestScheduler<{ k: number; x: number; y: number }>(pending => {
      const store = useGraphStore.getState()
      const key = zoomViewKeyRef.current
      if (!key) return
      const dims = dimsRef.current
      commitZoomTransformToStore({
        state: {
          viewPinned: store.viewPinned,
          zoomState: store.zoomState,
          zoomStateByKey: store.zoomStateByKey,
          setZoomState: store.setZoomState,
          setZoomStateForKey: store.setZoomStateForKey,
        },
        zoomViewKey: key,
        transform: { k: pending.k, x: pending.x, y: pending.y },
        viewportW: dims.width,
        viewportH: dims.height,
        graphDataRevision: store.graphDataRevision,
      })
    }),
  )

  const zoomViewKey = React.useMemo(() => {
    return buildActive2dZoomViewKey({
      canvasRenderMode,
      canvas2dRenderer,
      schema,
      graphData: localGraphData,
      documentSemanticMode,
      frontmatterModeEnabled,
      documentStructureBaselineLock,
      renderMediaAsNodes,
      mediaPanelDensity,
      collapsedGroupIds,
      designRendererWebpageLayoutKey: webpageLayoutKey,
    })
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIds,
    documentSemanticMode,
    documentStructureBaselineLock,
    frontmatterModeEnabled,
    localGraphData,
    mediaPanelDensity,
    renderMediaAsNodes,
    schema,
    webpageLayoutKey,
  ])

  const zoomViewKeyRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    zoomViewKeyRef.current = zoomViewKey
  }, [zoomViewKey])

  const lastInitKeyRef = React.useRef<string | null>(null)

  useZoomEffects({
    svgRef,
    zoomRef,
    width: viewportW,
    height: viewportH,
    paused: !active,
    graphDataOverride: localGraphData,
  })

  useAutoZoomModes2d({
    viewportW,
    viewportH,
    paused: !active,
    getGraph: () => ({ graphData: localGraphData, graphDataRevision }),
  })

  React.useEffect(() => {
    if (!active) return
    if (!svgRef.current || !gRef.current) return
    const svgEl = svgRef.current
    const gEl = gRef.current
    const scheduler = zoomCommitSchedulerRef.current
    const svg = d3.select(svgEl)
    const g = d3.select(gEl)
    const zoom = createZoom(
      svg,
      g,
      labelsSelRef,
      schema,
      viewportControlsPreset,
      transform => {
        if (!active) return
        scheduler.schedule({ k: transform.k, x: transform.x, y: transform.y })
      },
      undefined,
      () => active,
    )
    zoomRef.current = zoom

    const store = useGraphStore.getState()
    const initialZoomState = pickZoomStateForView({
      zoomViewKey,
      zoomStateByKey: store.zoomStateByKey,
      viewPinned: store.viewPinned,
      fitToScreenMode: store.fitToScreenMode,
      zoomToSelectionMode: store.zoomToSelectionMode,
    })
    const initial = pickInitialZoomTransform({
      zoomState: initialZoomState,
      pinned: store.viewPinned,
      graphDataRevision: store.graphDataRevision,
      nextViewportW: viewportW,
      nextViewportH: viewportH,
    })
    const initKey = zoomViewKey
    const alreadyInitialized = lastInitKeyRef.current === initKey
    const currentTransform = d3.zoomTransform(svgEl)
    const hasNonIdentityTransform = currentTransform.k !== 1 || currentTransform.x !== 0 || currentTransform.y !== 0
    const autoZoomActive = store.viewPinned !== true && (store.fitToScreenMode || store.zoomToSelectionMode)

    if (!alreadyInitialized || !hasNonIdentityTransform) {
      if (!alreadyInitialized && !autoZoomActive && hasNonIdentityTransform && !initial) {
        if (zoomViewKey && !store.zoomStateByKey?.[zoomViewKey]) {
          commitZoomTransformToStore({
            state: {
              viewPinned: store.viewPinned,
              zoomState: store.zoomState,
              zoomStateByKey: store.zoomStateByKey,
              setZoomState: store.setZoomState,
              setZoomStateForKey: store.setZoomStateForKey,
            },
            zoomViewKey,
            transform: { k: currentTransform.k, x: currentTransform.x, y: currentTransform.y },
            viewportW,
            viewportH,
            graphDataRevision: store.graphDataRevision,
          })
        }
      } else if (initial) {
        svg.call(zoom.transform as never, d3.zoomIdentity.translate(initial.x, initial.y).scale(initial.k))
      } else if (store.viewPinned !== true && viewportW > 80 && viewportH > 80) {
        const centered = centerGraphTransform({
          graphData: localGraphDataRef.current,
          viewportW,
          viewportH,
        })
        if (centered) {
          svg.call(zoom.transform as never, d3.zoomIdentity.translate(centered.x, centered.y).scale(centered.k))
        } else {
          svg.call(zoom.transform as never, d3.zoomIdentity)
        }
      } else {
        svg.call(zoom.transform as never, d3.zoomIdentity)
      }
      if (initKey) lastInitKeyRef.current = initKey
    }

    return () => {
      const any = svgEl as unknown as { __kgViewportControllerDestroy?: (() => void) | null; __kgWindowGestureDestroy?: (() => void) | null }
      if (typeof any.__kgViewportControllerDestroy === 'function') {
        try {
          any.__kgViewportControllerDestroy()
        } catch {
          void 0
        }
        any.__kgViewportControllerDestroy = null
      }
      if (typeof any.__kgWindowGestureDestroy === 'function') {
        try {
          any.__kgWindowGestureDestroy()
        } catch {
          void 0
        }
        any.__kgWindowGestureDestroy = null
      }
      try {
        svg.on('.zoom', null)
        svg.on('.kgPointerPan', null)
        svg.on('.kgPointerPanMove', null)
        svg.on('.kgPointerPanUp', null)
        svg.on('.kgWheelZoom', null)
        svg.on('.kgWheelZoomGuard', null)
        svg.on('.kgZoomWheelLastPointer', null)
        svg.on('.kgTouch', null)
        svg.on('.kgPanOnScroll', null)
        svg.on('.kgDesignViewport', null)
      } catch {
        void 0
      }
      zoomRef.current = null
      scheduler.cancel()
    }
  }, [
    active,
    gRef,
    labelsSelRef,
    localGraphDataRef,
    schema,
    svgRef,
    viewportControlsPreset,
    viewportH,
    viewportW,
    zoomRef,
    zoomViewKey,
  ])
}
