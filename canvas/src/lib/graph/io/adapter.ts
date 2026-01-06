import { GraphData } from '@/lib/graph/types'
import { parseCsvToGraph, graphToCombinedCsv } from '@/lib/graph/csv'
import { rawToGraphData } from '@/lib/graph/rawToGraph'
import { parseJsonLd, toJsonLd } from '@/lib/graph/jsonld/index'
import { isN8nWorkflow, parseN8nWorkflow } from '@/lib/graph/n8n'
import { isGraphRagBundle, parseGraphRagBundle } from '@/lib/graph/graphrag'

export type ParseDiagnostics = {
  format: 'csv' | 'json' | 'jsonld'
  warnings: string[]
}

export const parseGraph = (name: string, text: string): { data: GraphData; diag: ParseDiagnostics } => {
  const lower = (name || '').toLowerCase()
  if (lower.endsWith('.csv')) {
    const data = parseCsvToGraph(text)
    return { data, diag: { format: 'csv', warnings: [] } }
  }
  try {
    const json = JSON.parse(text)
    if (json && Array.isArray(json.nodes) && Array.isArray(json.edges)) {
      const n0 = json.nodes[0] || {}
      const e0 = json.edges[0] || {}
      if ((n0 && typeof n0.properties === 'object') || (e0 && typeof e0.label === 'string')) {
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
    const data = parseJsonLd(json)
    return { data, diag: { format: 'jsonld', warnings: [] } }
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
