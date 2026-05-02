import { GraphData } from '@/lib/graph/types'
import { isPlainObject } from '@/lib/graph/value'
import { parseCsvToGraph, graphToCombinedCsv } from '@/lib/graph/csv'
import { rawToGraphData } from '@/lib/graph/rawToGraph'
import { parseJsonLd, toJsonLd } from '@/lib/graph/jsonld/index'
import { isN8nWorkflow, parseN8nWorkflow } from '@/lib/graph/n8n'
import { isGraphRagBundle, parseGraphRagBundle } from '@/lib/graph/graphrag'
import { tryParseWidgetImportGraphData } from '@/lib/graph/io/widgetImport'
import { tryBuildGeodataGraphDataFromJson, tryBuildGeodataGraphDataFromJsonText } from '@/lib/graph/io/geodataJson'
import { buildGraphDataFromFeatureCollection } from '@/lib/graph/io/geojsonToGraphData'
import { pmfVoxelToGraphData } from '@/lib/graph/io/pmfVoxel'
import { coerceGeoJsonToFeatureCollection } from '@/lib/gympgrph/api'
import { tryBuildGrabMapsGraphDataFromJson } from '@/lib/graph/io/grabmaps'

export type ParseDiagnostics = {
  format: 'csv' | 'json' | 'jsonld'
  warnings: string[]
}

const readPlainObject = (value: unknown): Record<string, unknown> | null => {
  return isPlainObject(value) ? (value as Record<string, unknown>) : null
}

export const parseGraphFromJson = (
  name: string,
  json: unknown,
  opts?: {
    textForGeoJsonTextFallback?: string
    attemptedFastGeo?: boolean
  },
): { data: GraphData; diag: ParseDiagnostics } => {
  const attemptedFastGeo = opts?.attemptedFastGeo === true
  const isPmfVoxelPayload = (() => {
    const obj = readPlainObject(json)
    if (!obj) return false
    const layers = obj.layers
    if (!Array.isArray(layers) || layers.length === 0) return false
    let hasLayerNodes = false
    for (let i = 0; i < layers.length; i += 1) {
      const layer = readPlainObject(layers[i])
      if (!layer) continue
      const nodes = layer.nodes
      if (Array.isArray(nodes) && nodes.length > 0) {
        hasLayerNodes = true
        break
      }
    }
    if (!hasLayerNodes) return false
    const meta = obj.meta
    return !!readPlainObject(meta)
  })()
  if (isPmfVoxelPayload) {
    const data = pmfVoxelToGraphData(json)
    return { data, diag: { format: 'json', warnings: [] } }
  }

  const widget = tryParseWidgetImportGraphData(json)
  if (widget) {
    return { data: widget.graphData, diag: { format: 'json', warnings: widget.warnings } }
  }

  const jsonRecord = readPlainObject(json)
  if (jsonRecord && Array.isArray(jsonRecord.nodes) && Array.isArray(jsonRecord.edges)) {
    const n0 = readPlainObject(jsonRecord.nodes[0]) || {}
    const e0 = readPlainObject(jsonRecord.edges[0]) || {}
    if (readPlainObject(n0.properties) || typeof e0.label === 'string') {
      return { data: json as GraphData, diag: { format: 'json', warnings: [] } }
    }
    const data = rawToGraphData(json)
    return { data, diag: { format: 'json', warnings: [] } }
  }

  if (isGraphRagBundle(json)) {
    const data = parseGraphRagBundle(json)
    return { data, diag: { format: 'json', warnings: [] } }
  }
  if (isN8nWorkflow(json)) {
    const { graphData, warnings } = parseN8nWorkflow(json)
    return { data: graphData, diag: { format: 'json', warnings } }
  }

  if (jsonRecord) {
    const t = jsonRecord.type
    if (t === 'FeatureCollection' || t === 'Feature') {
      const directGeoGraph = buildGraphDataFromFeatureCollection({
        featureCollection: json,
        sourcePath: name,
        sourceHash: '',
      })
      if (directGeoGraph && directGeoGraph.nodes.length > 0) {
        return { data: directGeoGraph, diag: { format: 'json', warnings: [] } }
      }
      try {
        const normalized = coerceGeoJsonToFeatureCollection(json as never)
        const geoGraph = buildGraphDataFromFeatureCollection({
          featureCollection: normalized,
          sourcePath: name,
          sourceHash: '',
        })
        if (geoGraph && geoGraph.nodes.length > 0) {
          return { data: geoGraph, diag: { format: 'json', warnings: [] } }
        }
      } catch {
        void 0
      }
    }
  }

  const grab = tryBuildGrabMapsGraphDataFromJson({ name, json })
  if (grab) {
    return { data: grab.graphData, diag: { format: 'json', warnings: grab.warnings } }
  }

  const nestedGeo = tryBuildGeodataGraphDataFromJson({ name, json, maxRecords: 15000 })
  if (nestedGeo) {
    return { data: nestedGeo.graphData, diag: { format: 'json', warnings: nestedGeo.warnings } }
  }

  if (!attemptedFastGeo) {
    const text = opts?.textForGeoJsonTextFallback
    if (typeof text === 'string' && text) {
      const geo = tryBuildGeodataGraphDataFromJsonText({ name, text, maxRecords: 15000 })
      if (geo) {
        return { data: geo.graphData, diag: { format: 'json', warnings: geo.warnings } }
      }
    }
  }

  const raw = rawToGraphData(json)
  if ((raw.nodes && raw.nodes.length > 0) || (raw.edges && raw.edges.length > 0)) {
    return { data: raw, diag: { format: 'json', warnings: [] } }
  }
  const data = parseJsonLd(json)
  return { data, diag: { format: 'jsonld', warnings: [] } }
}

export const parseGraph = (name: string, text: string): { data: GraphData; diag: ParseDiagnostics } => {
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.csv')) {
    const data = parseCsvToGraph(text)
    return { data, diag: { format: 'csv', warnings: [] } }
  }

  const attemptedFastGeo = text.length > 1_000_000
  const fastGeo = attemptedFastGeo ? tryBuildGeodataGraphDataFromJsonText({ name, text }) : null
  if (fastGeo) {
    return { data: fastGeo.graphData, diag: { format: 'json', warnings: fastGeo.warnings } }
  }

  try {
    const json = JSON.parse(text)
    return parseGraphFromJson(name, json, { textForGeoJsonTextFallback: text, attemptedFastGeo })
  } catch {
    const data = parseJsonLd(text)
    return { data, diag: { format: 'jsonld', warnings: [] } }
  }
}

export const exportAsJsonLdBlob = (data: GraphData): Blob => {
  const jsonld = toJsonLd(data)
  return new Blob([JSON.stringify(jsonld, null, 2)], { type: 'application/ld+json' })
}

export const exportAsRawJsonBlob = (data: GraphData): Blob => {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

export const exportAsCombinedCsvBlob = (data: GraphData): Blob => {
  const csv = graphToCombinedCsv(data)
  return new Blob([csv], { type: 'text/csv' })
}

const escapeXml = (value: string): string => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const jsonValueToString = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const graphToGraphML = (data: GraphData): string => {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns">')
  lines.push('  <graph edgedefault="directed">')
  data.nodes.forEach(node => {
    lines.push(`    <node id="${escapeXml(node.id)}">`)
    lines.push(`      <data key="label">${escapeXml(node.label)}</data>`)
    lines.push(`      <data key="type">${escapeXml(node.type)}</data>`)
    Object.entries(node.properties || {}).forEach(([key, value]) => {
      lines.push(`      <data key="${escapeXml(key)}">${escapeXml(jsonValueToString(value))}</data>`)
    })
    lines.push('    </node>')
  })
  data.edges.forEach(edge => {
    lines.push(
      `    <edge id="${escapeXml(edge.id)}" source="${escapeXml(String(edge.source))}" target="${escapeXml(
        String(edge.target),
      )}">`,
    )
    lines.push(`      <data key="label">${escapeXml(edge.label)}</data>`)
    Object.entries(edge.properties || {}).forEach(([key, value]) => {
      lines.push(`      <data key="${escapeXml(key)}">${escapeXml(jsonValueToString(value))}</data>`)
    })
    lines.push('    </edge>')
  })
  lines.push('  </graph>')
  lines.push('</graphml>')
  return lines.join('\n')
}

const escapeCypherString = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

const normalizeCypherKey = (key: string): string => {
  const cleaned = key.replace(/[^A-Za-z0-9_]/g, '_')
  if (!cleaned) return '_'
  if (/^[0-9]/.test(cleaned)) return `_${cleaned}`
  return cleaned
}

const propsToCypher = (props: Record<string, unknown>): string => {
  const entries: string[] = []
  Object.entries(props).forEach(([key, value]) => {
    const k = normalizeCypherKey(key)
    const v =
      value === null || value === undefined
        ? 'null'
        : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : `'${escapeCypherString(jsonValueToString(value))}'`
    entries.push(`${k}: ${v}`)
  })
  if (entries.length === 0) return '{}'
  return `{ ${entries.join(', ')} }`
}

export const graphToCypher = (data: GraphData): string => {
  const lines: string[] = []
  const varById = new Map<string, string>()
  data.nodes.forEach((node, index) => {
    const v = `n${index}`
    varById.set(node.id, v)
    const label = node.type ? `:${normalizeCypherKey(node.type)}` : ''
    const props = {
      id: node.id,
      label: node.label,
      ...node.properties,
    }
    lines.push(`CREATE (${v}${label} ${propsToCypher(props)});`)
  })
  data.edges.forEach((edge, index) => {
    const sourceVar = varById.get(String(edge.source)) || `s${index}`
    const targetVar = varById.get(String(edge.target)) || `t${index}`
    const relType = edge.label ? `:${normalizeCypherKey(edge.label)}` : ''
    const props = {
      id: edge.id,
      ...edge.properties,
    }
    lines.push(`CREATE (${sourceVar})-[r${index}${relType} ${propsToCypher(props)}]->(${targetVar});`)
  })
  return lines.join('\n')
}

export const exportAsGraphMlBlob = (data: GraphData): Blob => {
  const xml = graphToGraphML(data)
  return new Blob([xml], { type: 'application/graphml+xml' })
}

export const exportAsCypherBlob = (data: GraphData): Blob => {
  const text = graphToCypher(data)
  return new Blob([text], { type: 'text/plain' })
}
