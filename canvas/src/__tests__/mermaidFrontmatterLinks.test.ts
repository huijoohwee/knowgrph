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

  const anchorPhase1 = findNode(nodes, n => n.type === 'Anchor' && String(n.properties?.anchorId || '') === 'phase-1-input')
  const anchorPhase2 = findNode(nodes, n => n.type === 'Anchor' && String(n.properties?.anchorId || '') === 'phase-2-transform')
  const anchorPhase3 = findNode(nodes, n => n.type === 'Anchor' && String(n.properties?.anchorId || '') === 'phase-3-report')
  const anchorPhase4 = findNode(nodes, n => n.type === 'Anchor' && String(n.properties?.anchorId || '') === 'phase-4-output')
  assert(anchorPhase1, 'expected Anchor for phase-1-input')
  assert(anchorPhase2, 'expected Anchor for phase-2-transform')
  assert(anchorPhase3, 'expected Anchor for phase-3-report')
  assert(anchorPhase4, 'expected Anchor for phase-4-output')

  const mermaidPort = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S1_Port')
  const mermaidDecide = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S2_Decide')
  const mermaidRender = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S3_Render')
  const mermaidPub = findNode(nodes, n => n.type === 'MermaidNode' && String(n.properties?.nodeName || '') === 'S4_Pub')
  assert(mermaidPort, 'expected MermaidNode S1_Port')
  assert(mermaidDecide, 'expected MermaidNode S2_Decide')
  assert(mermaidRender, 'expected MermaidNode S3_Render')
  assert(mermaidPub, 'expected MermaidNode S4_Pub')

  assert(
    hasEdge(edges, { source: mermaidPort.id, target: anchorPhase1.id, label: 'pointsTo' }),
    'expected Mermaid click S1_Port to pointsTo #phase-1-input',
  )
  assert(
    hasEdge(edges, { source: mermaidDecide.id, target: anchorPhase2.id, label: 'pointsTo' }),
    'expected Mermaid click S2_Decide to pointsTo #phase-2-transform',
  )
  assert(
    hasEdge(edges, { source: mermaidRender.id, target: anchorPhase3.id, label: 'pointsTo' }),
    'expected Mermaid click S3_Render to pointsTo #phase-3-report',
  )
  assert(
    hasEdge(edges, { source: mermaidPub.id, target: anchorPhase4.id, label: 'pointsTo' }),
    'expected Mermaid click S4_Pub to pointsTo #phase-4-output',
  )

  const blockAnchor = findNode(nodes, n => n.type === 'Anchor' && String(n.properties?.anchorId || '') === '^mermaid-s2-decide')
  assert(blockAnchor, 'expected injected block Anchor ^mermaid-s2-decide')

  const blockLink = findNode(nodes, n => n.type === 'InternalLink' && String(n.properties?.anchorId || '') === '^mermaid-s2-decide')
  assert(blockLink, 'expected InternalLink to #^mermaid-s2-decide')
  assert(
    hasEdge(edges, { source: blockLink.id, target: blockAnchor.id, label: 'pointsTo' }),
    'expected InternalLink #^mermaid-s2-decide to pointsTo the Anchor node',
  )

  const hasSubgraph = nodes.some(n => n.type === 'MermaidSubgraph')
  assert(hasSubgraph, 'expected MermaidSubgraph nodes to be included in frontmatter mermaid view')

  const headings = new Set(
    nodes
      .filter(n => n.type === 'Section')
      .map(n => String((n.properties as Record<string, unknown>)?.heading || '').trim())
      .filter(Boolean),
  )
  assert(headings.has('Phase 1 Input (Mermaid S1)'), 'expected Section: Phase 1 Input (Mermaid S1)')
  assert(headings.has('Phase 2 Transform (Mermaid S2)'), 'expected Section: Phase 2 Transform (Mermaid S2)')
  assert(headings.has('Phase 3 Report (Mermaid S3)'), 'expected Section: Phase 3 Report (Mermaid S3)')
  assert(headings.has('Phase 4 Output (Mermaid S4)'), 'expected Section: Phase 4 Output (Mermaid S4)')

  const hasContinueParagraph = nodes.some(n => {
    if (n.type !== 'Paragraph') return false
    const text = String((n.properties as Record<string, unknown>)?.text || '')
    return text.includes('Continue to:')
  })
  assert(hasContinueParagraph, 'expected navigation paragraph content to be included')

  const hasAggregatorParagraph = nodes.some(n => {
    if (n.type !== 'Paragraph') return false
    const text = String((n.properties as Record<string, unknown>)?.text || '')
    return text.includes('Aggregator DB represents an ingest junction')
  })
  assert(!hasAggregatorParagraph, 'expected plain narrative paragraph content to be excluded by criteria')
}
