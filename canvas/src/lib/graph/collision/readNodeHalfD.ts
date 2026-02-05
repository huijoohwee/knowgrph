import type { GraphNode } from '@/lib/graph/types'

export function readNodeHalfD(node: GraphNode): number {
  const props = (node.properties || {}) as Record<string, unknown>
  const halfDRaw = props['visual:halfD'] ?? props['collision:halfD']
  if (typeof halfDRaw === 'number' && Number.isFinite(halfDRaw)) return Math.max(0, halfDRaw)
  const depthRaw = props['visual:depth']
  if (typeof depthRaw === 'number' && Number.isFinite(depthRaw)) return Math.max(0, depthRaw) / 2
  return 0
}

