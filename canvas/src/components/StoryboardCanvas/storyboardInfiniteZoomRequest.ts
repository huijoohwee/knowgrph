import type * as d3 from 'd3'
import type { GraphState } from '@/hooks/store/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData } from '@/lib/graph/types'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { resolveZoomRequest2d, type ZoomRequestResolve2dResult } from '@/lib/zoom/resolveZoomRequest2d'
import { DEFAULT_TOOLBAR_ZOOM_CONFIG } from '@/lib/zoom/toolbarZoom'

type StoryboardZoomSelectionState = Pick<
  GraphState,
  | 'selectedEdgeId'
  | 'selectedEdgeIds'
  | 'selectedGroupId'
  | 'selectedGroupIds'
  | 'selectedNodeId'
  | 'selectedNodeIds'
>

type StoryboardZoomRequestArgs = {
  currentTransform: d3.ZoomTransform
  documentSemanticMode?: 'document' | 'keyword'
  durations: { fitMs?: number; selectionMs?: number }
  fitFillRatio?: number
  graphData: GraphData
  graphDataRevision: number
  schema: GraphSchema
  selectionState: StoryboardZoomSelectionState
  viewPinned: boolean
  viewportFitReferenceHeight?: number
  viewportFitReferenceWidth?: number
  viewportH: number
  viewportW: number
  cacheKeyBase?: string
  zoomRequest: ZoomRequest
}

const readStringOrNull = (value: unknown): string | null => {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(item => String(item).trim()).filter(Boolean) : []

export function resolveStoryboardInfiniteZoomRequestTransform(args: StoryboardZoomRequestArgs): ZoomRequestResolve2dResult | null {
  const [schemaMinK, schemaMaxK] = readZoomScaleExtent(args.schema)
  return resolveZoomRequest2d({
    zoomRequest: args.zoomRequest,
    graphData: args.graphData,
    schema: args.schema,
    documentSemanticMode: args.documentSemanticMode,
    graphDataRevision: args.graphDataRevision,
    viewportW: args.viewportW,
    viewportH: args.viewportH,
    viewportFitReferenceWidth: args.viewportFitReferenceWidth,
    viewportFitReferenceHeight: args.viewportFitReferenceHeight,
    fitFillRatio: args.fitFillRatio,
    viewPinned: args.viewPinned,
    durations: args.durations,
    toolbarZoom: DEFAULT_TOOLBAR_ZOOM_CONFIG,
    selectedNodeId: readStringOrNull(args.selectionState.selectedNodeId),
    selectedEdgeId: readStringOrNull(args.selectionState.selectedEdgeId),
    selectedGroupId: readStringOrNull(args.selectionState.selectedGroupId),
    selectedNodeIds: readStringArray(args.selectionState.selectedNodeIds),
    selectedEdgeIds: readStringArray(args.selectionState.selectedEdgeIds),
    selectedGroupIds: readStringArray(args.selectionState.selectedGroupIds),
    currentTransform: args.currentTransform,
    schemaExtent: { minK: schemaMinK, maxK: schemaMaxK },
    currentExtent: { minK: schemaMinK, maxK: schemaMaxK },
    cacheKeyBase: args.cacheKeyBase || 'storyboard',
  })
}
