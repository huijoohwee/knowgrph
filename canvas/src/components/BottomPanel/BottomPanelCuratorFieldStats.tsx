import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import { hashArrayOfObjectsSignature, hashSignatureParts } from '@/lib/hash/signature'

const NUMERIC_SAMPLE_STATS_CACHE_LIMIT = 16
const numericSampleStatsByFieldIdCache = new Map<string, Map<string, NumericSampleStats>>()

export type NumericSampleStats = {
  numericCount: number
  sampleCount: number
}

function buildNumericSampleStatsFieldSignature(
  fields: ReadonlyArray<{ id?: string; scope: 'node' | 'edge'; key: string }>,
): string {
  if (!Array.isArray(fields) || fields.length === 0) return hashSignatureParts(['numeric-sample-fields', 0])
  return hashSignatureParts([
    'numeric-sample-fields',
    hashArrayOfObjectsSignature(
      fields.map(field => ({
        id: String(field?.id || ''),
        scope: field?.scope === 'edge' ? 'edge' : 'node',
        key: String(field?.key || ''),
      })),
      { maxItems: Math.max(24, fields.length), maxKeysPerItem: 3 },
    ),
  ])
}

function readCachedNumericSampleStatsByFieldId(cacheKey: string): Map<string, NumericSampleStats> | null {
  const cached = numericSampleStatsByFieldIdCache.get(cacheKey) || null
  if (!cached) return null
  numericSampleStatsByFieldIdCache.delete(cacheKey)
  numericSampleStatsByFieldIdCache.set(cacheKey, cached)
  return cached
}

function writeCachedNumericSampleStatsByFieldId(
  cacheKey: string,
  statsByFieldId: Map<string, NumericSampleStats>,
): Map<string, NumericSampleStats> {
  numericSampleStatsByFieldIdCache.set(cacheKey, statsByFieldId)
  if (numericSampleStatsByFieldIdCache.size > NUMERIC_SAMPLE_STATS_CACHE_LIMIT) {
    const oldestKey = numericSampleStatsByFieldIdCache.keys().next().value
    if (typeof oldestKey === 'string') numericSampleStatsByFieldIdCache.delete(oldestKey)
  }
  return statsByFieldId
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

export function getCachedNumericSampleStatsByFieldId(args: {
  fields: ReadonlyArray<{ id: string; scope: 'node' | 'edge'; key: string }>
  nodes: GraphNode[]
  edges: GraphEdge[]
  numericSampleLimit: number
  graphSemanticKey?: string | null
}): Map<string, NumericSampleStats> {
  const graphSemanticKey = String(args.graphSemanticKey || '')
  const cacheKey = hashSignatureParts([
    'bottom-panel-numeric-sample-stats',
    graphSemanticKey,
    args.numericSampleLimit,
    buildNumericSampleStatsFieldSignature(args.fields),
  ])
  const cached = readCachedNumericSampleStatsByFieldId(cacheKey)
  if (cached) return cached
  const statsByFieldId = new Map<string, NumericSampleStats>()
  for (let i = 0; i < args.fields.length; i += 1) {
    const field = args.fields[i]
    statsByFieldId.set(
      String(field.id || ''),
      computeNumericSampleStatsForField(field, args.nodes, args.edges, args.numericSampleLimit),
    )
  }
  return writeCachedNumericSampleStatsByFieldId(cacheKey, statsByFieldId)
}
