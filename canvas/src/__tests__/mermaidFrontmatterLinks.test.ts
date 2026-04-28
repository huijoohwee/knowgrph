import { buildMarkdownJsonLd } from '@/features/parsers/default'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { readSandboxDemoText, toDocumentPath } from '@/tests/lib/sandboxRoot'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const findNode = (nodes: GraphNode[], predicate: (n: GraphNode) => boolean): GraphNode | null => {
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    if (n && predicate(n)) return n
  }
  return null
}

const hasEdge = (edges: GraphEdge[], args: { source: string; target: string; label: string }): boolean => {
  const src = String(args.source || '')
  const tgt = String(args.target || '')
  const label = String(args.label || '')
  if (!src || !tgt || !label) return false
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    if (!e) continue
    if (String(e.label || '') !== label) continue
    if (String(e.source || '') !== src) continue
    if (String(e.target || '') !== tgt) continue
    return true
  }
  return false
}

export const testMermaidFrontmatterClickAnchorsAndBlockLinks = () => {
  const demo = readSandboxDemoText({ preferBasename: 'mddemo.md' })
  if (!demo) return

  const docPath = toDocumentPath(demo.path) || 'mddemo.md'
  const jsonld = buildMarkdownJsonLd(docPath, demo.text)
  const graphData = parseJsonLd(jsonld)
  const filtered = filterGraphToFrontmatterMermaid(graphData)

  const nodes = Array.isArray(filtered.nodes) ? filtered.nodes : []
  const edges = Array.isArray(filtered.edges) ? filtered.edges : []

  const mermaidPort = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S1_Port')
  const mermaidDecide = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S2_Decide')
  const mermaidRender = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S3_Render')
  const mermaidPub = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S4_Pub')
  assert(mermaidPort, 'expected MermaidNode S1_Port')
  assert(mermaidDecide, 'expected MermaidNode S2_Decide')
  assert(mermaidRender, 'expected MermaidNode S3_Render')
  assert(mermaidPub, 'expected MermaidNode S4_Pub')

  const hasSubgraph = nodes.some(n => n.type === 'MermaidSubgraph')
  assert(hasSubgraph, 'expected MermaidSubgraph nodes to be included in frontmatter mermaid view')
  const disallowedTypes = new Set(['Anchor', 'InternalLink', 'Paragraph', 'Section', 'List', 'ListItem'])
  const leaked = nodes.find(n => disallowedTypes.has(String(n.type || ''))) || null
  assert(!leaked, `expected pure frontmatter mermaid view without leaked context node type ${String(leaked?.type || '')}`)
  const leakedPointsTo = edges.find(e => {
    if (String(e.label || '') !== 'pointsTo') return false
    const source = findNode(nodes, n => String(n.id) === String(e.source || ''))
    const target = findNode(nodes, n => String(n.id) === String(e.target || ''))
    const sourceType = String(source?.type || '')
    const targetType = String(target?.type || '')
    return sourceType !== 'MermaidNode' || (targetType !== 'MermaidNode' && targetType !== 'MermaidSubgraph')
  }) || null
  assert(!leakedPointsTo, 'expected pure frontmatter mermaid pointsTo edges to stay within Mermaid nodes/subgraphs only')
}
