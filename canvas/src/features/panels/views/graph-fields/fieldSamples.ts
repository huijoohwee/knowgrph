import type { GraphData, JSONValue } from '@/lib/graph/types'
import type { GraphField } from '@/features/graph-fields/graphFields'

export type FieldSampleFreq = {
  value: string
  count: number
}

export function computeFieldValueFrequencies(
  graphData: GraphData | null,
  field: GraphField | null,
): FieldSampleFreq[] {
  if (!graphData || !field) return []
  const { scope, key } = field
  const ENTITY_SCAN_LIMIT = 5_000
  const UNIQUE_SUGGESTION_LIMIT = 500
  const freqs = new Map<string, number>()

  const add = (raw: string) => {
    const cleaned = raw.trim()
    if (!cleaned) return
    if (cleaned.length > 500) return
    freqs.set(cleaned, (freqs.get(cleaned) || 0) + 1)
  }

  const collect = (value: JSONValue | undefined | null) => {
    if (value === null || typeof value === 'undefined') return
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') add(item)
        else if (typeof item === 'number' && Number.isFinite(item)) add(String(item))
        else if (typeof item === 'boolean') add(item ? 'true' : 'false')
        if (freqs.size >= UNIQUE_SUGGESTION_LIMIT) return
      }
      return
    }
    if (typeof value === 'string') add(value)
    else if (typeof value === 'number' && Number.isFinite(value)) add(String(value))
    else if (typeof value === 'boolean') add(value ? 'true' : 'false')
  }

  const scanNodes = (graphData.nodes || []).slice(0, ENTITY_SCAN_LIMIT)
  const scanEdges = (graphData.edges || []).slice(0, ENTITY_SCAN_LIMIT)

  if (scope === 'node') {
    for (const node of scanNodes) {
      const props = node?.properties || {}
      collect(props[key] as JSONValue | undefined)
      if (freqs.size >= UNIQUE_SUGGESTION_LIMIT) break
    }
  } else {
    for (const edge of scanEdges) {
      const props = edge?.properties || {}
      collect(props[key] as JSONValue | undefined)
      if (freqs.size >= UNIQUE_SUGGESTION_LIMIT) break
    }
  }

  const entries = Array.from(freqs.entries())
  entries.sort((a, b) => {
    const diff = b[1] - a[1]
    if (diff !== 0) return diff
    return a[0].localeCompare(b[0])
  })
  return entries.slice(0, 200).map(([value, count]) => ({ value, count }))
}
