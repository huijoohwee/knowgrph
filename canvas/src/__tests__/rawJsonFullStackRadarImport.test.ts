import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'

export function testRawJsonFullStackRadarImport() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const raw = {
    meta: { project: 'Radar' },
    stack: [
      { id: '01', tool: 'GitHub Actions', layer: ['SCM', 'CI/CD'], data_flow: { df_stage: 'DF-00' }, risk: 'Low' },
      { id: '02', tool: 'Reddit API', layer: ['Scraping'], data_flow: { df_stage: 'DF-01' }, risk: 'Low' },
      { id: '03', tool: 'DeepSeek', layer: ['AI Model'], data_flow: { df_stage: 'DF-02' }, risk: 'Medium' },
      { id: '04', tool: 'Cloudflare Worker', layer: ['API/Edge'], data_flow: { df_stage: 'DF-03' }, risk: 'Low' },
    ],
  }

  const res = applyParser(toParserId('json'), {
    name: 'full-stack-foss.json',
    text: JSON.stringify(raw),
  })
  if (!res) throw new Error('full stack json parse returned null')
  const graph = res.graphData
  const nodes = graph.nodes || []
  const edges = graph.edges || []
  if (nodes.length < 8) throw new Error(`expected radar hubs + tools, got ${nodes.length} nodes`)
  const hubNodes = nodes.filter(n => String(n.type || '') === 'hub')
  if (hubNodes.length < 4) throw new Error(`expected >=4 hub nodes, got ${hubNodes.length}`)
  const spokeEdges = edges.filter(e => String(e.label || '') === 'spokeTo')
  if (spokeEdges.length < 4) throw new Error(`expected spoke edges, got ${spokeEdges.length}`)
  const flowEdges = edges.filter(e => String(e.label || '') === 'pointsTo')
  if (flowEdges.length < 3) throw new Error(`expected staged flow edges, got ${flowEdges.length}`)
  const curved = flowEdges.every(e => {
    const props = (e.properties || {}) as Record<string, unknown>
    return props['kg:radarFlow'] === true && props['visual:curve'] === 'quadratic'
  })
  if (!curved) throw new Error('expected curved radar flow edge properties')
}
