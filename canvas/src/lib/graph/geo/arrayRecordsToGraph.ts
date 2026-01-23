import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import { isPlainObject } from '@/lib/graph/value'
import { deriveGeoFromRecord, deriveIdFromRecord, deriveLabelFromRecord } from '@/lib/graph/geo/recordHeuristics'

export function arrayRecordsToGraphData(raw: unknown): GraphData | null {
  const entries: Array<{ key: string; value: Record<string, unknown> }> = (() => {
    if (Array.isArray(raw)) {
      if (raw.length === 0) return []
      const out: Array<{ key: string; value: Record<string, unknown> }> = []
      for (let i = 0; i < raw.length; i += 1) {
        const v = raw[i]
        if (!isPlainObject(v)) continue
        out.push({ key: String(i), value: v })
      }
      return out
    }
    if (isPlainObject(raw)) {
      const out: Array<{ key: string; value: Record<string, unknown> }> = []
      for (const [k, v] of Object.entries(raw)) {
        if (!isPlainObject(v)) continue
        out.push({ key: k, value: v })
      }
      return out
    }
    return []
  })()
  if (entries.length === 0) return null

  const nodes: GraphNode[] = []
  for (let i = 0; i < entries.length; i += 1) {
    const rec = entries[i].value
    const key = entries[i].key.trim()
    const id = deriveIdFromRecord(rec) ?? (key ? key : `row:${i}`)
    const label = deriveLabelFromRecord(rec, id)
    const type = typeof rec.type === 'string' && rec.type.trim() ? rec.type.trim() : 'Entity'

    const props: Record<string, JSONValue> = { ...(rec as Record<string, JSONValue>) }
    const geo = deriveGeoFromRecord(rec)
    if (geo) props.geo = geo as unknown as JSONValue

    nodes.push({
      id,
      label,
      type,
      properties: props,
      metadata: {
        provenance: {
          kind: 'records',
        },
      },
    })
  }

  const graphData: GraphData = {
    type: 'Graph',
    context: 'records',
    nodes,
    edges: [],
    metadata: {
      ingestionMetrics: {
        kind: 'records',
        rowCount: nodes.length,
      },
    },
  }
  return graphData
}
