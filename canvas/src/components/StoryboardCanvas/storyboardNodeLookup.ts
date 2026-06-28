import type { GraphData, GraphNode } from '@/lib/graph/types'
import { parseComposedId } from '@/hooks/store/graph-data-slice/graphDataComposedSource'

export function buildStoryboardGraphBackedNodeLookup(graphs: readonly (GraphData | null | undefined)[]): Map<string, GraphNode> {
  const nodeById = new Map<string, GraphNode>()
  for (const graph of graphs) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
    for (const node of nodes) {
      const id = String(node?.id || '').trim()
      if (!id) continue
      if (!nodeById.has(id)) nodeById.set(id, node)
      const parsed = parseComposedId(id)
      const innerId = String(parsed?.innerId || '').trim()
      if (innerId && !nodeById.has(innerId)) nodeById.set(innerId, node)
    }
  }
  return nodeById
}

export function findStoryboardGraphNodeIdByProperty(graphs: readonly (GraphData | null | undefined)[], nodeType: string, propertyKey: string, propertyValue: unknown): string {
  const expectedValue = String(propertyValue || '').trim()
  if (!expectedValue) return ''
  for (const graph of graphs) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
    for (const node of nodes) {
      if (String(node?.type || '').trim() !== nodeType) continue
      const properties = node.properties && typeof node.properties === 'object' ? node.properties as Record<string, unknown> : {}
      if (String(properties[propertyKey] || '').trim() === expectedValue) return String(node.id || '').trim()
    }
  }
  return ''
}
