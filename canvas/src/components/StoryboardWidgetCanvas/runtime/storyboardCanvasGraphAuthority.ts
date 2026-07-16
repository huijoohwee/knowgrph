import type { GraphData } from '@/lib/graph/types'
import { applyCanonicalNodePropertyAuthority } from '@/lib/graph/applyCanonicalNodePropertyAuthority'
import { normalizeAllStoryboardWidgetProbeTreeOutputLayouts } from './storyboardWidgetProbeTreeLayout'

const hasGraphNodes = (graphData: GraphData | null | undefined): graphData is GraphData =>
  Array.isArray(graphData?.nodes) && graphData.nodes.length > 0

export function applyStoryboardCanvasGraphPropertyAuthority(args: {
  graphData: GraphData | null | undefined
  propertyAuthorityGraphData: GraphData | null | undefined
}): GraphData | null {
  const graphData = applyCanonicalNodePropertyAuthority(args)
  return graphData ? normalizeAllStoryboardWidgetProbeTreeOutputLayouts(graphData) : null
}

export function resolveStoryboardCanvasGraphDataAuthority(args: {
  baseGraphData: GraphData | null
  draftGraphData: GraphData | null
  renderGraphData: GraphData | null
}): GraphData {
  const graphData = hasGraphNodes(args.draftGraphData)
    ? args.draftGraphData
    : hasGraphNodes(args.renderGraphData)
      ? args.renderGraphData
      : hasGraphNodes(args.baseGraphData)
        ? args.baseGraphData
        : args.draftGraphData || args.renderGraphData || args.baseGraphData || { context: '', type: 'Graph', nodes: [], edges: [] }
  return normalizeAllStoryboardWidgetProbeTreeOutputLayouts(graphData)
}
