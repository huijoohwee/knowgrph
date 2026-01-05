import type { GraphData, GraphNode } from './types'

export function getGraphCapabilities(graphData: GraphData | null | undefined) {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return { supportsTraversalTour: false }
  }
  const supportsTraversalTour = graphData.nodes.some((node: GraphNode) => {
    const props = node.properties || {}
    const value = props.graphRAGPath
    return typeof value !== 'undefined'
  })
  return { supportsTraversalTour }
}

