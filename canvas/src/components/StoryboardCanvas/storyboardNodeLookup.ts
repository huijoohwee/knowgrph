import type { GraphData, GraphNode } from '@/lib/graph/types'
import { parseCanonicalNodeIds } from '@/lib/graph/canonicalNodeIds'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'

export function buildStoryboardGraphBackedNodeLookup(graphs: readonly (GraphData | null | undefined)[]): Map<string, GraphNode> {
  const nodeById = new Map<string, GraphNode>()
  for (const graph of graphs) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
    for (const node of nodes) {
      for (const id of parseCanonicalNodeIds(node?.id)) {
        if (!nodeById.has(id)) nodeById.set(id, node)
      }
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
      if (String(unwrapGraphCellValue(node?.type) || '').trim() !== nodeType) continue
      const properties = node.properties && typeof node.properties === 'object' ? node.properties as Record<string, unknown> : {}
      if (String(unwrapGraphCellValue(properties[propertyKey]) || '').trim() === expectedValue) {
        return parseCanonicalNodeIds(node.id)[0] || ''
      }
    }
  }
  return ''
}
