import type { GraphNode } from '@/lib/graph/types'

export const GRAPH_ELEMENT_FIT_ROLE_PROPERTY = 'visual:fitRole'
export const GRAPH_ELEMENT_FIT_ROLE_BOUNDS_ONLY = 'boundsOnly'

const readRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

export const excludesGraphElementFromFitCentroid = (element: Pick<GraphNode, 'properties'> | null | undefined): boolean => {
  const props = readRecord(element?.properties)
  return props[GRAPH_ELEMENT_FIT_ROLE_PROPERTY] === GRAPH_ELEMENT_FIT_ROLE_BOUNDS_ONLY
}
