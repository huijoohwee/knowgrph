import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildFullStackRadarGraph } from '@/lib/graph/fullStackRadarGraph'

export const testFullStackRadarGraphReusesSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'graph', 'fullStackRadarGraph.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from './value'")) {
    throw new Error('expected full-stack radar graph to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('isPlainObject(v) ? (v as Record<string, unknown>) : null')) {
    throw new Error('expected full-stack radar graph object coercion to reuse the shared plain-object guard')
  }
  if (text.includes("v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null")) {
    throw new Error('expected full-stack radar graph to stop coercing objects inline')
  }
}

export const testFullStackRadarGraphBuildsClusteredRadar = () => {
  const graph = buildFullStackRadarGraph({
    stack: [
      { id: 'scraper', tool: 'Scraper', layer: ['scraping'], risk: 'medium', data_flow: { df_stage: '1' } },
      { id: 'api', tool: 'API Gateway', layer: ['api'], risk: 'high', data_flow: { df_stage: '2' }, critical_path: { status: 'P0' } },
      { id: 'ai', tool: 'Model Worker', layer: ['ai'], risk: 'medium', data_flow: { df_stage: '3' } },
      { id: 'frontend', tool: 'Frontend', layer: ['frontend'], risk: 'low', data_flow: { df_stage: '4' } },
    ],
  })
  if (!graph) throw new Error('expected full-stack radar graph to build for valid radar input')
  if (graph.nodes.length < 8) throw new Error(`expected hub and tool nodes to be built, got ${graph.nodes.length}`)
  if (graph.edges.length < 4) throw new Error(`expected spoke and flow edges to be built, got ${graph.edges.length}`)
  const hubCount = graph.nodes.filter(node => (node.properties as Record<string, unknown> | undefined)?.['kg:radarHub'] === true).length
  if (hubCount < 4) throw new Error(`expected one hub per cluster, got ${hubCount}`)
}
