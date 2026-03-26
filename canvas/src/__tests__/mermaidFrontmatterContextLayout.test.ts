import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { applyMermaidFrontmatterContextLayoutToGraphData } from '@/lib/mermaid/mermaidFrontmatterGeometry'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function testMermaidFrontmatterContextLayoutPositionsAnchorsAndBlocks() {
  const nodes: GraphNode[] = [
    {
      id: 'm1',
      label: 'S1_Port',
      type: 'MermaidNode',
      x: 100,
      y: 200,
      properties: { nodeName: 'S1_Port', mermaidScope: 'frontmatter' },
    },
    {
      id: 'a1',
      label: 'phase-1-input',
      type: 'Anchor',
      properties: { anchorId: 'phase-1-input', kind: 'html' },
      metadata: { lineStart: 10, lineEnd: 10, documentPath: 'sandbox/demo/mddemo.md' },
    },
    {
      id: 's1',
      label: 'Phase 1 Input',
      type: 'Section',
      properties: { anchor: 'phase-1-input', heading: 'Phase 1 Input', level: 4 },
      metadata: { lineStart: 11, lineEnd: 12, documentPath: 'sandbox/demo/mddemo.md' },
    },
    {
      id: 'p1',
      label: 'Paragraph 1',
      type: 'Paragraph',
      properties: { text: 'Continue to: [[#Phase 2 Transform (Mermaid S2)]]', order: 1 },
      metadata: { lineStart: 13, lineEnd: 14, documentPath: 'sandbox/demo/mddemo.md' },
    },
    {
      id: 'il1',
      label: 'phase-2-transform',
      type: 'InternalLink',
      properties: { anchorId: 'phase-2-transform', label: 'Phase 2 Transform' },
      metadata: { lineStart: 13, lineEnd: 13, documentPath: 'sandbox/demo/mddemo.md' },
    },
    {
      id: 'a2',
      label: 'phase-2-transform',
      type: 'Anchor',
      properties: { anchorId: 'phase-2-transform', kind: 'html' },
      metadata: { lineStart: 20, lineEnd: 20, documentPath: 'sandbox/demo/mddemo.md' },
    },
  ]

  const edges: GraphEdge[] = [
    { id: 'e1', source: 'm1', target: 'a1', label: 'pointsTo', properties: {} },
    { id: 'e2', source: 's1', target: 'p1', label: 'hasBlock', properties: {} },
    { id: 'e3', source: 'p1', target: 'il1', label: 'hasInternalLink', properties: {} },
    { id: 'e4', source: 'il1', target: 'a2', label: 'pointsTo', properties: {} },
  ]

  const graph: GraphData = { type: 'graph', nodes, edges, context: 'frontmatter-mermaid' }
  const out = applyMermaidFrontmatterContextLayoutToGraphData(graph)

  const byId = new Map(out.nodes.map(n => [n.id, n]))
  const a1 = byId.get('a1')
  const s1 = byId.get('s1')
  const p1 = byId.get('p1')
  const il1 = byId.get('il1')
  const a2 = byId.get('a2')

  assert(a1 && isFiniteNumber(a1.x) && isFiniteNumber(a1.y), 'expected anchor a1 positioned')
  assert(s1 && isFiniteNumber(s1.x) && isFiniteNumber(s1.y), 'expected section s1 positioned')
  assert(p1 && isFiniteNumber(p1.x) && isFiniteNumber(p1.y), 'expected paragraph p1 positioned')
  assert(il1 && isFiniteNumber(il1.x) && isFiniteNumber(il1.y), 'expected internal link il1 positioned')
  assert(a2 && isFiniteNumber(a2.x) && isFiniteNumber(a2.y), 'expected target anchor a2 positioned')
}

