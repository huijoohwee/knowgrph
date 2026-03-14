import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'
import { computeEffectiveFrontmatterMode } from '@/lib/graph/frontmatterMode'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'
import { deriveSceneGroups } from '@/lib/scene/sceneDerivation'
import { useGraphStore } from '@/hooks/useGraphStore'

export const testMermaidFrontmatterModeKeepsMermaidNodesAndGroups = async () => {
  const md = [
    '---',
    'mermaid: |',
    '  graph TD',
    '    subgraph G1 [Group A]',
    '      X[Node X] --> Y[Node Y]',
    '    end',
    '    X -.-> |edge label| Z[Node Z]',
    '---',
    '',
    '# Title',
  ].join('\n')

  const res = await loadGraphDataFromTextViaParser('inline.md', md, { applyToStore: false })
  if (!res?.graphData) throw new Error('expected graphData')

  const base = res.graphData
  const types = new Set((base.nodes || []).map(n => String((n as { type?: unknown }).type || '')))
  if (!types.has('MermaidNode')) throw new Error('expected MermaidNode nodes from frontmatter mermaid')
  if (!types.has('MermaidSubgraph')) throw new Error('expected MermaidSubgraph nodes from frontmatter mermaid')

  const effective = computeEffectiveFrontmatterMode({
    graphData: base,
    frontmatterModeEnabled: true,
    documentSemanticMode: 'document',
  })
  if (!effective) throw new Error('expected effective frontmatter mode when frontmatter mermaid exists')

  const frontmatterGraph = filterGraphToFrontmatterMermaid(base)
  const fmTypes = new Set((frontmatterGraph.nodes || []).map(n => String((n as { type?: unknown }).type || '')))
  if (!fmTypes.has('MermaidNode')) throw new Error('expected MermaidNode nodes in filtered frontmatter graph')
  if (!fmTypes.has('MermaidSubgraph')) throw new Error('expected MermaidSubgraph nodes in filtered frontmatter graph')

  const edges = Array.isArray(frontmatterGraph.edges)
    ? (frontmatterGraph.edges as Array<{ label?: unknown; source?: unknown; target?: unknown }>)
    : []
  const hasMembership = edges.some(e => String(e.label || '') === 'hasMermaidNode')
  if (!hasMembership) throw new Error('expected hasMermaidNode edges for subgraph membership')
  const hasPointsTo = edges.some(e => String(e.label || '') === 'pointsTo')
  if (!hasPointsTo) throw new Error('expected pointsTo edges from mermaid arrows')

  const schema = useGraphStore.getState().schema
  const groups = deriveSceneGroups({
    graphData: frontmatterGraph,
    graphDataRevision: 0,
    schema,
    documentSemanticMode: 'document',
    frontmatterModeEnabled: true,
  })
  if (!groups) throw new Error('expected groups derivation')
  const hasGroupA = (groups.allGroups || []).some(g => String((g as { label?: unknown }).label || '').includes('Group A'))
  if (!hasGroupA) throw new Error('expected Mermaid subgraph to produce a group')
}

