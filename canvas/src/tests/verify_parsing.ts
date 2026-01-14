import {
  applyParser,
  builtInParsers,
  registerParser,
  resetParsers,
  toParserId,
  type ParseInput,
  type ParseResult,
  type ParserSpec,
} from '../features/parsers'
import { buildMarkdownJsonLd } from '../features/parsers/default'

export type ParserSmokeCheckResult = {
  parserId: string
  ok: boolean
  warningCount: number
  nodeCount: number
  edgeCount: number
}

const countGraph = (res: ParseResult): { nodes: number; edges: number } => {
  const graph = res.graphData
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.length : 0
  const edges = Array.isArray(graph.edges) ? graph.edges.length : 0
  return { nodes, edges }
}

export const verifyBuiltInParsersSmoke = (): ParserSmokeCheckResult[] => {
  resetParsers()
  builtInParsers.forEach((p: ParserSpec) => registerParser(p))

  const inputsByParserId: Record<string, ParseInput> = {
    csv: { name: 'demo.csv', text: 'id,label\nn1,Node 1\n' },
    json: { name: 'demo.json', text: JSON.stringify({ hello: 'world' }) },
    jsonld: {
      name: 'demo.jsonld',
      text: JSON.stringify(buildMarkdownJsonLd('file://demo.md', '# Title\n')),
    },
    markdown: { name: 'demo.md', text: '# Title\n\nParagraph.\n' },
    n8n: {
      name: 'workflow.json',
      text: JSON.stringify({ name: 'demo', nodes: [], connections: {}, settings: {} }),
    },
  }

  return builtInParsers.map((spec: ParserSpec) => {
    const parserId = String(spec.id)
    const input = inputsByParserId[parserId] ?? { name: `demo.${parserId}`, text: '' }
    const res = applyParser(toParserId(parserId), input)
    if (!res) {
      return { parserId, ok: false, warningCount: 0, nodeCount: 0, edgeCount: 0 }
    }
    const { nodes, edges } = countGraph(res)
    const warnings = Array.isArray(res.warnings) ? res.warnings : []
    return {
      parserId,
      ok: true,
      warningCount: warnings.length,
      nodeCount: nodes,
      edgeCount: edges,
    }
  })
}
