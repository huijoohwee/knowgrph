import { useEffect, type MutableRefObject, type RefObject } from 'react'
import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'

export function useZoomStateSeeding2d(args: {
  active: boolean
  viewPinned: boolean
  zoomState: unknown
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
  svgRef: RefObject<SVGSVGElement | null>
  gRef: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>
  sceneWidth: number
  sceneHeight: number
  canvasRenderMode: unknown
  canvas2dRenderer: unknown
  collapsedGroupIdsKey: string
  documentSemanticMode: unknown
  frontmatterModeEnabled: unknown
  mediaPanelDensity: unknown
  renderMediaAsNodes: unknown
  schemaLayoutEngineJson: string
}): void {
  const {
    active,
    viewPinned,
    zoomState,
    fitToScreenMode,
    zoomToSelectionMode,
    svgRef,
    gRef,
    zoomRef,
    sceneWidth,
    sceneHeight,
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    schemaLayoutEngineJson,
  } = args

  useEffect(() => {
    if (!viewPinned) return
    if (!svgRef.current) return
    if (!gRef.current) return
    if (!zoomRef.current) return
    try {
      const t = d3.zoomTransform(svgRef.current)
      const st = useGraphStore.getState()
      const zoomViewKey = buildActive2dZoomViewKey({
        canvasRenderMode: st.canvasRenderMode,
        canvas2dRenderer: st.canvas2dRenderer,
        schema: st.schema,
        graphData: st.graphData,
        documentSemanticMode: st.documentSemanticMode,
        frontmatterModeEnabled: st.frontmatterModeEnabled,
        documentStructureBaselineLock: st.documentStructureBaselineLock,
        renderMediaAsNodes: st.renderMediaAsNodes,
        mediaPanelDensity: st.mediaPanelDensity,
        collapsedGroupIds: st.collapsedGroupIds,
      })
      const seeded = { k: t.k, x: t.x, y: t.y, graphDataRevision: undefined, viewportW: sceneWidth, viewportH: sceneHeight }
      if (!st.zoomState) st.setZoomState(seeded)
      if (zoomViewKey && !st.zoomStateByKey?.[zoomViewKey]) {
        st.setZoomStateForKey(zoomViewKey, seeded)
      }
    } catch {
      void 0
    }
  }, [sceneHeight, sceneWidth, viewPinned, zoomState, gRef, svgRef, zoomRef])

  useEffect(() => {
    if (!active) return
    if (fitToScreenMode || zoomToSelectionMode) return
    if (!svgRef.current) return
    if (!zoomRef.current) return
    try {
      const t = d3.zoomTransform(svgRef.current)
      const hasNonIdentityTransform = t.k !== 1 || t.x !== 0 || t.y !== 0
      if (!hasNonIdentityTransform) return
      const st = useGraphStore.getState()
      const zoomViewKey = buildActive2dZoomViewKey({
        canvasRenderMode: st.canvasRenderMode,
        canvas2dRenderer: st.canvas2dRenderer,
        schema: st.schema,
        graphData: st.graphData,
        documentSemanticMode: st.documentSemanticMode,
        frontmatterModeEnabled: st.frontmatterModeEnabled,
        documentStructureBaselineLock: st.documentStructureBaselineLock,
        renderMediaAsNodes: st.renderMediaAsNodes,
        mediaPanelDensity: st.mediaPanelDensity,
        collapsedGroupIds: st.collapsedGroupIds,
      })
      if (!zoomViewKey) return
      if (st.zoomStateByKey?.[zoomViewKey]) return
      const seeded = { k: t.k, x: t.x, y: t.y, graphDataRevision: undefined, viewportW: sceneWidth, viewportH: sceneHeight }
      st.setZoomStateForKey(zoomViewKey, seeded)
      if (!st.zoomState) st.setZoomState(seeded)
    } catch {
      void 0
    }
  }, [
    active,
    canvas2dRenderer,
    canvasRenderMode,
    collapsedGroupIdsKey,
    documentSemanticMode,
    fitToScreenMode,
    frontmatterModeEnabled,
    mediaPanelDensity,
    renderMediaAsNodes,
    sceneHeight,
    sceneWidth,
    schemaLayoutEngineJson,
    svgRef,
    zoomRef,
    zoomToSelectionMode,
  ])
}

