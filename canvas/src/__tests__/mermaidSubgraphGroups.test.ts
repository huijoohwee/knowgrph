import { parseMermaidFrontmatter } from '@/features/parsers/markdownJsonLdMermaidParser'
import type { GraphData, GraphEdge, GraphNode } from '@/lib/graph/types'
import { deriveMermaidSubgraphGroups } from '@/components/GraphCanvas/layout/mermaidSubgraphGroups'

export const testMermaidSubgraphParsingAddsParentId = () => {
  const created: Array<Record<string, unknown>> = []
  const rels: Array<{ src: string; key: string; tgt: string }> = []
  parseMermaidFrontmatter(
    [
      'graph LR',
      'subgraph Outer["Outer label"]',
      '  A[Node A] --> B[Node B]',
      '  subgraph Inner["Inner label"]',
      '    C[Node C]',
      '  end',
      'end',
    ].join('\n'),
    {
      gid: 'g',
      docId: 'doc:g',
      startIndex: 1,
      ensureNode: (node) => created.push(node),
      addRel: (src, key, tgt) => rels.push({ src, key, tgt }),
      mkMeta: () => ({}),
    },
  )

  const nodes = created.filter(n => n['@type'] === 'MermaidNode')
  const subgraphs = created.filter(n => n['@type'] === 'MermaidSubgraph')
  if (subgraphs.length !== 2) throw new Error(`expected 2 subgraphs, got ${subgraphs.length}`)

  const outer = subgraphs.find(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props.subgraphName || '') === 'Outer'
  })
  if (!outer) throw new Error('expected Outer subgraph')
  const outerId = String(outer['@id'] || '')
  if (!outerId) throw new Error('expected Outer subgraph @id')

  const inner = subgraphs.find(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props.subgraphName || '') === 'Inner'
  })
  if (!inner) throw new Error('expected Inner subgraph')
  const innerProps = (inner.properties || {}) as Record<string, unknown>
  if (String(innerProps['visual:parentId'] || '') !== outerId) throw new Error('Inner should reference visual:parentId')

  const findByName = (name: string) =>
    nodes.find(n => String(((n.properties || {}) as Record<string, unknown>).nodeName || '') === name)
  const a = findByName('A')
  const b = findByName('B')
  const c = findByName('C')
  if (!a || !b || !c) throw new Error('expected Mermaid nodes A, B, C')
  const aProps = (a.properties || {}) as Record<string, unknown>
  const bProps = (b.properties || {}) as Record<string, unknown>
  const cProps = (c.properties || {}) as Record<string, unknown>
  if (String(aProps['visual:parentId'] || '') !== outerId) throw new Error('A should be parented by Outer')
  if (String(bProps['visual:parentId'] || '') !== outerId) throw new Error('B should be parented by Outer')
  if (String(cProps['visual:parentId'] || '') !== String(inner['@id'] || '')) throw new Error('C should be parented by Inner')

  for (let i = 0; i < nodes.length; i += 1) {
    const props = (nodes[i].properties || {}) as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(props, 'tags')) throw new Error('Mermaid nodes must not infer tags from subgraph names')
  }

  const hasOuterInnerRel = rels.some(r => r.src === outerId && r.key === 'hasMermaidSubgraph' && r.tgt === String(inner['@id'] || ''))
  if (!hasOuterInnerRel) throw new Error('expected hasMermaidSubgraph edge from Outer to Inner')
}

export const testMermaidSubgraphDerivationBuildsGroups = () => {
  const sgOuter: GraphNode = {
    id: 'sgOuter',
    label: 'Outer',
    type: 'MermaidSubgraph',
    properties: { label: 'Outer' },
  }
  const sgInner: GraphNode = {
    id: 'sgInner',
    label: 'Inner',
    type: 'MermaidSubgraph',
    properties: { label: 'Inner' },
  }
  const a: GraphNode = { id: 'A', label: 'A', type: 'MermaidNode', properties: {} }
  const b: GraphNode = { id: 'B', label: 'B', type: 'MermaidNode', properties: {} }
  const c: GraphNode = { id: 'C', label: 'C', type: 'MermaidNode', properties: {} }
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'sgOuter', target: 'A', label: 'hasMermaidNode', properties: {} },
    { id: 'e2', source: 'sgOuter', target: 'B', label: 'hasMermaidNode', properties: {} },
    { id: 'e3', source: 'sgOuter', target: 'sgInner', label: 'hasMermaidSubgraph', properties: {} },
    { id: 'e4', source: 'sgInner', target: 'C', label: 'hasMermaidNode', properties: {} },
  ]
  const data: GraphData = { type: 'graph', nodes: [sgOuter, sgInner, a, b, c], edges }
  const groups = deriveMermaidSubgraphGroups(data)
  if (groups.length !== 2) throw new Error(`expected 2 groups, got ${groups.length}`)
  const outer = groups.find(g => g.id === 'sgOuter')
  const inner = groups.find(g => g.id === 'sgInner')
  if (!outer || !inner) throw new Error('expected groups for sgOuter and sgInner')
  const outerMembers = new Set(outer.memberNodeIds)
  if (!outerMembers.has('A') || !outerMembers.has('B') || !outerMembers.has('C')) {
    throw new Error('Outer should include A, B, and descendant C')
  }
  const innerMembers = new Set(inner.memberNodeIds)
  if (!innerMembers.has('C') || innerMembers.size !== 1) throw new Error('Inner should include only C')
}

