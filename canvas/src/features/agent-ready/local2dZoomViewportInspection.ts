import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { buildActive2dZoomViewKey } from '@/lib/canvas/active-2d-zoom-view-key'
import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'

type ZoomStateLike = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

type Local2dZoomViewportInspectionArgs = {
  markdownDocumentName?: unknown
  canvasRenderMode?: unknown
  canvas2dRenderer?: unknown
  schema?: GraphSchema | null | undefined
  graphData?: GraphData | null | undefined
  documentSemanticMode?: unknown
  frontmatterModeEnabled?: unknown
  multiDimTableModeEnabled?: unknown
  documentStructureBaselineLock?: unknown
  renderMediaAsNodes?: unknown
  mediaPanelDensity?: unknown
  collapsedGroupIds?: unknown
  designRendererWebpageLayoutKey?: unknown
  viewPinned?: unknown
  fitToScreenMode?: unknown
  zoomToSelectionMode?: unknown
  zoomState?: ZoomStateLike | null | undefined
  zoomStateByKey?: Record<string, ZoomStateLike | null | undefined> | null | undefined
}

const normalizeString = (value: unknown): string => String(value || '').trim()

const readEffectiveZoomState = (value: ZoomStateLike | null) => {
  if (!value) return null
  return {
    k: value.k,
    x: value.x,
    y: value.y,
    graphDataRevision: value.graphDataRevision ?? null,
    viewportW: value.viewportW ?? null,
    viewportH: value.viewportH ?? null,
  }
}

export const inspectLocal2dZoomViewport = (args: Local2dZoomViewportInspectionArgs) => {
  const documentName = normalizeString(args.markdownDocumentName)
  const canvasRenderMode = normalizeString(args.canvasRenderMode) || '2d'
  const canvas2dRenderer = normalizeString(args.canvas2dRenderer) || 'storyboard'
  const viewPinned = args.viewPinned === true
  const fitToScreenMode = args.fitToScreenMode === true
  const zoomToSelectionMode = args.zoomToSelectionMode === true

  if (canvasRenderMode !== '2d') {
    return {
      available: false,
      sourceKind: 'browser-local-2d-zoom-viewport',
      documentName: documentName || '',
      canvasRenderMode,
      canvas2dRenderer,
      zoomViewKey: null,
      viewPinned,
      fitToScreenMode,
      zoomToSelectionMode,
      zoomState: null,
      message: 'Local 2d zoom/viewport inspection is currently available only when the canvas render mode is 2d.',
    }
  }

  const zoomViewKey = buildActive2dZoomViewKey({
    canvasRenderMode,
    canvas2dRenderer,
    schema: args.schema || null,
    graphData: args.graphData || null,
    documentSemanticMode: args.documentSemanticMode,
    frontmatterModeEnabled: args.frontmatterModeEnabled,
    multiDimTableModeEnabled: args.multiDimTableModeEnabled,
    documentStructureBaselineLock: args.documentStructureBaselineLock,
    renderMediaAsNodes: args.renderMediaAsNodes,
    mediaPanelDensity: args.mediaPanelDensity,
    collapsedGroupIds: args.collapsedGroupIds,
    designRendererWebpageLayoutKey: args.designRendererWebpageLayoutKey,
  })
  const zoomState = getEffectiveZoomStateForKey({
    zoomViewKey,
    zoomStateByKey: args.zoomStateByKey || null,
    zoomState: args.zoomState || null,
  })
  const effectiveZoomState = readEffectiveZoomState(zoomState)

  if (!zoomViewKey || !effectiveZoomState) {
    return {
      available: false,
      sourceKind: 'browser-local-2d-zoom-viewport',
      documentName: documentName || '',
      canvasRenderMode,
      canvas2dRenderer,
      zoomViewKey,
      viewPinned,
      fitToScreenMode,
      zoomToSelectionMode,
      zoomState: null,
      message: 'No active local 2d zoom/viewport state is currently registered in the app runtime.',
    }
  }

  return {
    available: true,
    sourceKind: 'browser-local-2d-zoom-viewport',
    documentName: documentName || 'document.md',
    canvasRenderMode,
    canvas2dRenderer,
    zoomViewKey,
    viewPinned,
    fitToScreenMode,
    zoomToSelectionMode,
    zoomState: effectiveZoomState,
    message: null,
  }
}
