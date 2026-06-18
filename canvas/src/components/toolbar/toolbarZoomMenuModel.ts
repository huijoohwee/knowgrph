import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'
import { clampScale, safeScaleExtent } from '@/lib/zoom/scaleExtent'
import { computeTransformScaleAboutViewportCenter } from '@/lib/zoom/viewport'
import type { GraphState } from '@/hooks/store/types'

export const TOOLBAR_ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const

export type ToolbarZoomPreset = typeof TOOLBAR_ZOOM_PRESETS[number]

export function formatToolbarZoomPercent(k: unknown): string {
  const value = typeof k === 'number' && Number.isFinite(k) && k > 0 ? k : 1
  return `${Math.round(value * 100)}%`
}

export function readToolbarZoomScale(state: GraphState): number {
  const zoomViewKey = buildActive2dZoomViewKey({
    canvasRenderMode: state.canvasRenderMode,
    canvas2dRenderer: state.canvas2dRenderer,
    schema: state.schema,
    graphData: state.graphData,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    multiDimTableModeEnabled: state.multiDimTableModeEnabled,
    documentStructureBaselineLock: state.documentStructureBaselineLock,
    renderMediaAsNodes: state.renderMediaAsNodes,
    mediaPanelDensity: state.mediaPanelDensity,
    collapsedGroupIds: state.collapsedGroupIds,
    designRendererWebpageLayoutKey: state.designRendererWebpageLayoutKey,
  })
  const zoomState = getEffectiveZoomStateForKey({
    zoomViewKey,
    zoomStateByKey: state.zoomStateByKey,
    zoomState: state.zoomState,
  })
  return typeof zoomState?.k === 'number' && Number.isFinite(zoomState.k) && zoomState.k > 0 ? zoomState.k : 1
}

export function computeToolbarZoomPresetTransform(args: {
  state: GraphState
  preset: ToolbarZoomPreset
}): { k: number; x: number; y: number } {
  const state = args.state
  const zoomViewKey = buildActive2dZoomViewKey({
    canvasRenderMode: state.canvasRenderMode,
    canvas2dRenderer: state.canvas2dRenderer,
    schema: state.schema,
    graphData: state.graphData,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled,
    multiDimTableModeEnabled: state.multiDimTableModeEnabled,
    documentStructureBaselineLock: state.documentStructureBaselineLock,
    renderMediaAsNodes: state.renderMediaAsNodes,
    mediaPanelDensity: state.mediaPanelDensity,
    collapsedGroupIds: state.collapsedGroupIds,
    designRendererWebpageLayoutKey: state.designRendererWebpageLayoutKey,
  })
  const zoomState = getEffectiveZoomStateForKey({
    zoomViewKey,
    zoomStateByKey: state.zoomStateByKey,
    zoomState: state.zoomState,
  })
  const extent = safeScaleExtent({
    minK: state.schema.performance?.zoom?.minScale ?? 0.001,
    maxK: state.schema.performance?.zoom?.maxScale ?? 8,
  })
  return computeTransformScaleAboutViewportCenter({
    transform: zoomState,
    viewportW: zoomState?.viewportW || state.canvasDims?.w || 800,
    viewportH: zoomState?.viewportH || state.canvasDims?.h || 600,
    nextK: clampScale(args.preset, extent),
  })
}
