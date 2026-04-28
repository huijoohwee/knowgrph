import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { type GraphSchema, getAgenticRagTagColor, getRendererPalette } from '@/lib/graph/schema'
import { readGlobalEdgeColor } from '@/lib/graph/edgeTypes'

const readVisualString = (props: Record<string, unknown>, key: string): string => {
  const raw = props[key]
  return typeof raw === 'string' ? raw.trim() : ''
}

export const getEdgeBaseStroke = (edge: GraphEdge, schema: GraphSchema): string => {
  const safeEdge = (edge && typeof edge === 'object' ? edge : null) as
    | { label?: unknown; properties?: unknown }
    | null
  const rawProps = safeEdge?.properties
  const props =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {}
  const visualStroke = readVisualString(props, 'visual:stroke')
  if (visualStroke) return visualStroke
  const visualColor = readVisualString(props, 'visual:color')
  if (visualColor) return visualColor
  const label = typeof safeEdge?.label === 'string' ? safeEdge.label : ''
  const byLabel = schema.edgeStyles?.[label]?.color
  const c = typeof byLabel === 'string' ? byLabel.trim() : ''
  if (c) return c
  const globalEdgeColor = readGlobalEdgeColor(schema)
  if (globalEdgeColor) return globalEdgeColor
  return getRendererPalette(schema).edges.neutral
}

export const getNodeBaseFill = (node: GraphNode, schema: GraphSchema): string => {
  const safeNode = (node && typeof node === 'object' ? node : null) as
    | { type?: unknown; properties?: unknown }
    | null
  const rawProps = safeNode?.properties
  const props =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {}
  const visualFill = readVisualString(props, 'visual:fill')
  if (visualFill) return visualFill
  const fill = readVisualString(props, 'fill')
  if (fill) return fill
  const tagColor = getAgenticRagTagColor(node, schema)
  if (tagColor) return tagColor
  const nodeType = typeof safeNode?.type === 'string' ? safeNode.type : ''
  const byType = schema.nodeStyles[nodeType]?.color
  if (typeof byType === 'string' && byType.trim()) return byType
  const palette = getRendererPalette(schema)
  return palette.nodes.execution
}

export const getNodeBaseStroke = (node: GraphNode, schema: GraphSchema): string => {
  const safeNode = (node && typeof node === 'object' ? node : null) as
    | { type?: unknown; properties?: unknown }
    | null
  const rawProps = safeNode?.properties
  const props =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {}
  const visualStroke = readVisualString(props, 'visual:stroke')
  if (visualStroke) return visualStroke
  const nodeType = typeof safeNode?.type === 'string' ? safeNode.type : ''
  const byType = schema.nodeStroke?.[nodeType]?.color
  if (typeof byType === 'string' && byType.trim()) return byType.trim()
  return 'var(--kg-canvas-node-stroke)'
}

export const getNodeLabelColor = (node: GraphNode, schema: GraphSchema): string => {
  const safeNode = (node && typeof node === 'object' ? node : null) as { properties?: unknown } | null
  const rawProps = safeNode?.properties
  const props =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {}
  const visualLabelColor = readVisualString(props, 'visual:labelColor')
  if (visualLabelColor) return visualLabelColor
  const visualColor = readVisualString(props, 'visual:color')
  if (visualColor) return visualColor
  const labelColor = schema.labelStyles?.color
  if (typeof labelColor === 'string' && labelColor.trim()) return labelColor.trim()
  return 'var(--kg-canvas-label-fill)'
}

export const getEdgeLabelColor = (edge: GraphEdge, schema: GraphSchema): string => {
  const safeEdge = (edge && typeof edge === 'object' ? edge : null) as { properties?: unknown } | null
  const rawProps = safeEdge?.properties
  const props =
    rawProps && typeof rawProps === 'object' && !Array.isArray(rawProps)
      ? (rawProps as Record<string, unknown>)
      : {}
  const visualLabelColor = readVisualString(props, 'visual:labelColor')
  if (visualLabelColor) return visualLabelColor
  const visualColor = readVisualString(props, 'visual:color')
  if (visualColor) return visualColor
  const visualStroke = readVisualString(props, 'visual:stroke')
  if (visualStroke) return visualStroke
  return getEdgeBaseStroke(edge, schema)
}
