import type { GraphData } from './types'
import { parseCsvToGraph } from './csv'
import { rawToGraphData } from './rawToGraph'
import { parseJsonLd } from './jsonld/index'
import { isN8nWorkflow, parseN8nWorkflow } from './n8n'
import { isGraphRagBundle, parseGraphRagBundle } from './graphrag'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export const parseTextToGraph = (name: string, text: string): GraphData | null => {
  const lowerName = (name || '').toLowerCase()
  const content = text || ''
  if (lowerName.endsWith('.csv')) {
    return parseCsvToGraph(content)
  }
  const json = JSON.parse(content) as unknown
  if (isRecord(json)) {
    const jsonWithNodes = json as { nodes?: unknown; edges?: unknown }
    const nodesValue = jsonWithNodes.nodes
    const edgesValue = jsonWithNodes.edges
    if (Array.isArray(nodesValue) && Array.isArray(edgesValue)) {
      const n0 = (nodesValue[0] ?? {}) as Record<string, unknown>
      const e0 = (edgesValue[0] ?? {}) as Record<string, unknown>
      const hasGraphShape = (n0 && typeof n0.properties === 'object') || (e0 && typeof e0.label === 'string')
      if (hasGraphShape) {
        return json as unknown as GraphData
      }
      return rawToGraphData(json as Record<string, unknown>)
    }
  }
  if (isGraphRagBundle(json)) {
    return parseGraphRagBundle(json)
  }
  if (isN8nWorkflow(json)) {
    return parseN8nWorkflow(json).graphData
  }
  return parseJsonLd(json)
}
