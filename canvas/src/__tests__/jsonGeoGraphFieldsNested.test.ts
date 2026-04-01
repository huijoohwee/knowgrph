import { readFileSync } from 'node:fs'
import path from 'node:path'
import { computeDerivedFields } from '@/features/graph-fields/graphFields'
import { getRowFieldText, type GraphDataTableColumnKey, type UnifiedRow } from '@/features/graph-data-table/graphDataTable'
import { parseGraph } from '@/lib/graph/io/adapter'

export function testGraphFieldsDerivedIncludesNestedGeoMetadataKeys() {
  const graphData = {
    type: 'Graph',
    context: 'json',
    metadata: {},
    nodes: [
      {
        id: 'n1',
        type: 'Place',
        label: 'SIN',
        properties: {
          geo: { lat: 1.357, lng: 103.988 },
          metadata: { markdown: { title: 'Changi' } },
        },
      },
    ],
    edges: [],
  } as const

  const fields = computeDerivedFields(graphData as never)
  const ids = new Set(fields.map(f => f.id))
  if (!ids.has('node:geo.lat')) throw new Error('expected nested node:geo.lat field')
  if (!ids.has('node:geo.lng')) throw new Error('expected nested node:geo.lng field')
  if (!ids.has('node:metadata.markdown.title')) throw new Error('expected nested metadata markdown title field')
}

export function testGraphDataTableNestedPropertyColumnsReadNestedValues() {
  const row: UnifiedRow = {
    kind: 'node',
    id: 'n1',
    label: 'SIN',
    type: 'Place',
    properties: {
      geo: { lat: 1.357, lng: 103.988 },
      metadata: { markdown: { title: 'Changi Airport' } },
      'geo.lat': 'literal-priority',
    },
  }
  const dotKey = 'prop:node:geo.lat' as GraphDataTableColumnKey
  const nestedKey = 'prop:node:metadata.markdown.title' as GraphDataTableColumnKey
  const dotValue = getRowFieldText(row, dotKey)
  const nestedValue = getRowFieldText(row, nestedKey)
  if (dotValue !== 'literal-priority') {
    throw new Error(`expected direct key precedence for geo.lat, got ${dotValue}`)
  }
  if (nestedValue !== 'Changi Airport') {
    throw new Error(`expected nested metadata markdown title, got ${nestedValue}`)
  }
}

export function testSingapolyJsonGeoParsingAndGraphFields() {
  const fixturePath = path.resolve('/Users/huijoohwee/Documents/GitHub/sandbox/test-data/singapoly.json')
  let text = ''
  try {
    text = readFileSync(fixturePath, 'utf8')
  } catch {
    return
  }
  if (!text.trim()) return
  const parsed = parseGraph('singapoly.json', text)
  const nodes = parsed.data.nodes || []
  if (nodes.length === 0) throw new Error('expected parsed singapoly graph to produce nodes')
  const hasGeo = nodes.some(node => {
    const props = (node?.properties || {}) as Record<string, unknown>
    const geo = (props.geo || null) as Record<string, unknown> | null
    return !!geo && Number.isFinite(geo.lat as number) && Number.isFinite(geo.lng as number)
  })
  if (!hasGeo) throw new Error('expected singapoly parse to include geo.lat/lng properties')
  const fields = computeDerivedFields(parsed.data)
  const ids = new Set(fields.map(f => f.id))
  if (!ids.has('node:geo.lat') || !ids.has('node:geo.lng')) {
    throw new Error('expected singapoly graph fields to include node:geo.lat and node:geo.lng')
  }
}
