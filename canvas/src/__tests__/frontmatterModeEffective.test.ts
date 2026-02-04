import type { GraphData } from '@/lib/graph/types'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export function testFrontmatterModeEffectiveNoopWhenNoSeeds() {
  const graphData: GraphData = {
    type: 'graph',
    metadata: {},
    nodes: [{ id: 'n1', type: 'Entity', label: 'n1', properties: {} }],
    edges: [],
  }
  const effective = computeEffectiveFrontmatterMode({
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    graphData,
  })
  if (effective !== false) throw new Error('expected frontmatter mode to be ineffective without seeds')

  const filtered = filterGraphToFrontmatterMermaid(graphData)
  if (filtered !== graphData) throw new Error('expected frontmatter filter to be a no-op without seeds')
}

export function testFrontmatterModeEffectiveWhenSeedsExist() {
  const graphData: GraphData = {
    type: 'graph',
    metadata: {},
    nodes: [
      { id: 'm1', type: 'MermaidNode', label: 'm1', properties: { mermaidScope: 'frontmatter' } },
      { id: 'n1', type: 'Entity', label: 'n1', properties: {} },
    ],
    edges: [{ id: 'e1', source: 'm1', target: 'n1', label: 'pointsTo', properties: {} }],
  }

  const effective = computeEffectiveFrontmatterMode({
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
    graphData,
  })
  if (effective !== true) throw new Error('expected frontmatter mode to be effective with seeds')

  const filtered = filterGraphToFrontmatterMermaid(graphData)
  if (filtered === graphData) throw new Error('expected filtered graph to be a new object when seeds exist')
  const nodeIds = new Set((filtered.nodes || []).map(n => String(n.id)))
  if (!nodeIds.has('m1') || !nodeIds.has('n1')) throw new Error('expected seed and reachable node to be included')
}
