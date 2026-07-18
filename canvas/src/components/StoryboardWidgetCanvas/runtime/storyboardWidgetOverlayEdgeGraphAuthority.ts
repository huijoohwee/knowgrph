import type { GraphData } from '@/lib/graph/types'

export function resolveStoryboardWidgetOverlayEdgeGraphAuthority(args: {
  draftGraphData: GraphData | null
  renderedGraphData: GraphData | null
  fixedCardsOwnGraphAuthority: boolean
}): GraphData | null {
  if (args.fixedCardsOwnGraphAuthority) {
    return args.renderedGraphData || args.draftGraphData || null
  }
  return args.draftGraphData || args.renderedGraphData || null
}
