import fs from 'node:fs'
import path from 'node:path'
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

const resolveMermaidDocCandidates = (): string[] => {
  const cwd = process.cwd()
  return [
    path.resolve(cwd, '..', '..', 'sandbox', 'demo', 'md-demo-00.md'),
    path.resolve(cwd, '..', '..', 'huijoohwee.github.io', 'docs', 'kgc-ai-pipeline-prd-tad.md'),
  ]
}

export const testMermaidFrontmatterPipelineSupportsDemoAndKgcDocs = async () => {
  const docs = resolveMermaidDocCandidates().filter(p => fs.existsSync(p))
  if (docs.length === 0) return

  for (let i = 0; i < docs.length; i += 1) {
    const docPath = docs[i]!
    const md = fs.readFileSync(docPath, 'utf8')
    const res = await loadGraphDataFromTextViaParser(docPath, md, { applyToStore: false })
    if (!res?.graphData) throw new Error(`expected graphData for ${path.basename(docPath)}`)
    const base = res.graphData
    const baseNodes = Array.isArray(base.nodes) ? base.nodes : []
    const baseEdges = Array.isArray(base.edges) ? base.edges : []
    const isFrontmatterFlow = String((base as { context?: unknown }).context || '').trim() === 'frontmatter-flow'
    if (isFrontmatterFlow) {
      if (baseNodes.length === 0 || baseEdges.length === 0) {
        throw new Error(`expected non-empty frontmatter-flow graph for ${path.basename(docPath)}`)
      }
      continue
    }
    const filtered = filterGraphToFrontmatterMermaid(base)
    const filteredNodes = Array.isArray(filtered.nodes) ? filtered.nodes : []
    const filteredEdges = Array.isArray(filtered.edges) ? filtered.edges : []
    const hasMermaidNode = filteredNodes.some(n => String((n as { type?: unknown }).type || '') === 'MermaidNode')
    if (!hasMermaidNode) throw new Error(`expected MermaidNode for ${path.basename(docPath)}`)
    if (filteredNodes.length === 0 || filteredEdges.length === 0) {
      throw new Error(`expected non-empty frontmatter mermaid graph for ${path.basename(docPath)}`)
    }
  }
}
