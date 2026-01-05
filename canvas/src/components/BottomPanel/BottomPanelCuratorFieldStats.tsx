import type { GraphNode, GraphEdge } from '@/lib/graph/types'

export type NumericSampleStats = {
  numericCount: number
  sampleCount: number
}

export function computeNumericSampleStatsForField(
  field: { scope: 'node' | 'edge'; key: string },
  nodes: GraphNode[],
  edges: GraphEdge[],
  numericSampleLimit: number,
): NumericSampleStats {
  let numericCount = 0
  let sampleCount = 0
  if (field.scope === 'node') {
    for (const node of nodes) {
      if (sampleCount >= numericSampleLimit) break
      const raw = node.properties[field.key as keyof typeof node.properties]
      if (raw === null || raw === undefined) continue
      sampleCount += 1
      if (typeof raw === 'number') {
        numericCount += 1
        continue
      }
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (!trimmed) continue
        const value = Number(trimmed)
        if (Number.isFinite(value)) numericCount += 1
      }
    }
  } else {
    for (const edge of edges) {
      if (sampleCount >= numericSampleLimit) break
      const raw = edge.properties[field.key as keyof typeof edge.properties]
      if (raw === null || raw === undefined) continue
      sampleCount += 1
      if (typeof raw === 'number') {
        numericCount += 1
        continue
      }
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (!trimmed) continue
        const value = Number(trimmed)
        if (Number.isFinite(value)) numericCount += 1
      }
    }
  }
  return { numericCount, sampleCount }
}

