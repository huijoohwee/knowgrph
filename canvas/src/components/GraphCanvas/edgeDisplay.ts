import type { GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readFlowEdgeDisplayLabel } from '@/lib/graph/flowPorts'

export const isKeywordEdge = (e: GraphEdge): boolean => {
  const props = (e.properties || {}) as Record<string, unknown>
  const kind = typeof props['keyword:kind'] === 'string' ? String(props['keyword:kind']).trim() : ''
  return !!kind
}

export const shouldShowEdgeArrow = (e: GraphEdge, schema: GraphSchema): boolean => {
  if (schema.edgeStyles[e.label]?.arrow) return true
  if (!isKeywordEdge(e)) return false
  const props = (e.properties || {}) as Record<string, unknown>
  const directed = props['keyword:directed']
  if (typeof directed === 'boolean') return directed
  return true
}

export const getEdgeLabelForDisplay = (e: GraphEdge): string => {
  const flowLabel = String(readFlowEdgeDisplayLabel(e) || '').trim()
  if (flowLabel) return flowLabel
  const label = String(e.label || '').trim()
  if (!isKeywordEdge(e)) return label
  const clean = label.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return clean || label
}

