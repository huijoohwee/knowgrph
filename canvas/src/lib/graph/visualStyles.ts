import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { type GraphSchema, getAgenticRagTagColor, getRendererPalette } from '@/lib/graph/schema'

export const getEdgeBaseStroke = (edge: GraphEdge, schema: GraphSchema): string => {
  const props = (edge.properties || {}) as Record<string, unknown>
  const visualStroke = typeof props['visual:stroke'] === 'string' ? String(props['visual:stroke']).trim() : ''
  if (visualStroke) return visualStroke
  const visualColor = typeof props['visual:color'] === 'string' ? String(props['visual:color']).trim() : ''
  if (visualColor) return visualColor
  const byLabel = schema.edgeStyles?.[edge.label]?.color
  const c = typeof byLabel === 'string' ? byLabel.trim() : ''
  if (c) return c
  return getRendererPalette(schema).edges.neutral
}

export const getNodeBaseFill = (node: GraphNode, schema: GraphSchema): string => {
  const props = (node.properties || {}) as Record<string, unknown>
  const visualFill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill']).trim() : ''
  if (visualFill) return visualFill
  const fill = typeof props['fill'] === 'string' ? String(props['fill']).trim() : ''
  if (fill) return fill
  const tagColor = getAgenticRagTagColor(node, schema)
  if (tagColor) return tagColor
  const byType = schema.nodeStyles[node.type]?.color
  if (typeof byType === 'string' && byType.trim()) return byType
  const palette = getRendererPalette(schema)
  return palette.nodes.execution
}
