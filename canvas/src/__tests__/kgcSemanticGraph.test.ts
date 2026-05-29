import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { builtInParsers, toParserId } from '@/features/parsers'
import {
  KGC_SEMANTIC_GRAPH_KIND,
  parseKgcSemanticGraphFromMarkdown,
} from '@/features/parsers/kgcSemanticGraph'
import { parseWorkspaceKgcSemanticGraphDataCached } from '@/hooks/active-graph-data/workspaceStructuredGraph'
import {
  ancestorsKgcSemanticNodeIds,
  bfsKgcSemanticPath,
  descendantsKgcSemanticNodeIds,
  filterKgcSemanticNodeIdsByType,
  searchKgcSemanticNodeIds,
} from '@/lib/graph/kgcSemanticQuery'
import type { GraphData } from '@/lib/graph/types'

const arrow = '\u2192'

const buildKgcSemanticFixture = () => [
  '---',
  'title: "Portable Economics Contract"',
  'schema: "kgc-computing-flow/v1"',
  'node_types:',
  '  - metric',
  '  - lever',
  '  - cost',
  'edge_predicates:',
  '  - caps',
  '  - drives',
  '---',
  '',
  '# Portable Economics Contract',
  '',
  'Template placeholders `@node:{type}:{id}` and `@edge:{predicate}:{source}->{target}` are docs, not graph declarations.',
  '',
  'Declare `@node:metric:prompt_tokens` and `@node:lever:token_budget` in prose.',
  '',
  `Trace budget with \`@edge:caps:token_budget${arrow}prompt_tokens\`.`,
  `Trace actual spend with \`@edge:drives:prompt_tokens${arrow}estimated_cost_usd\`.`,
].join('\n')

const requireGraph = (): GraphData => {
  const parsed = parseKgcSemanticGraphFromMarkdown({
    name: 'portable-economics.md',
    text: buildKgcSemanticFixture(),
  })
  if (!parsed) throw new Error('expected KGC semantic graph parse result')
  if (parsed.warnings.length !== 0) throw new Error(`expected no parser warnings, got ${parsed.warnings.join('; ')}`)
  return parsed.graphData
}

export function testKgcSemanticGraphParsesTypedSigilsWithoutLegacyRemap() {
  const graph = requireGraph()
  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.kind !== KGC_SEMANTIC_GRAPH_KIND) throw new Error('expected KGC semantic graph metadata kind')
  if (typeof meta.graphSemanticKey !== 'string' || !meta.graphSemanticKey) {
    throw new Error('expected KGC semantic graph to publish a shared graph semantic key')
  }
  const nodeById = new Map((graph.nodes || []).map(node => [String(node.id), node]))
  const prompt = nodeById.get('prompt_tokens')
  const budget = nodeById.get('token_budget')
  const estimated = nodeById.get('estimated_cost_usd')
  if (!prompt || !budget || !estimated) throw new Error('expected explicit and inferred KGC nodes')
  if (prompt.type !== 'metric') throw new Error(`expected prompt_tokens type metric, got ${prompt.type}`)
  if (budget.type !== 'lever') throw new Error(`expected token_budget type lever, got ${budget.type}`)
  if ((estimated.properties || {})['kgc:inferredFromEdge'] !== true) {
    throw new Error('expected edge-only endpoint to be marked as inferred, not duplicated')
  }
  const caps = (graph.edges || []).find(edge => edge.label === 'caps')
  const drives = (graph.edges || []).find(edge => edge.label === 'drives')
  if (!caps || caps.source !== 'token_budget' || caps.target !== 'prompt_tokens') {
    throw new Error('expected caps edge to retain directed source and target')
  }
  if (!drives || drives.source !== 'prompt_tokens' || drives.target !== 'estimated_cost_usd') {
    throw new Error('expected drives edge to retain directed source and target')
  }

  const legacyOnly = parseKgcSemanticGraphFromMarkdown({
    name: 'legacy.md',
    text: ['# Legacy', 'A legacy reference `@node:n-trigger` should stay a reference, not a typed node.'].join('\n'),
  })
  if (legacyOnly) throw new Error('expected untyped legacy @node reference to stay out of the KGC typed graph parser')
}

export function testKgcSemanticQueryEnginePathFilterSearchAncestorsDescendants() {
  const graph = requireGraph()
  const path = bfsKgcSemanticPath({
    graphData: graph,
    startId: 'token_budget',
    endId: 'estimated_cost_usd',
  })
  if (path.join('>') !== 'token_budget>prompt_tokens>estimated_cost_usd') {
    throw new Error(`expected shortest directed budget path, got ${path.join('>')}`)
  }
  const levers = filterKgcSemanticNodeIdsByType({ graphData: graph, type: 'lever' })
  if (levers.join(',') !== 'token_budget') throw new Error(`expected lever filter to return token_budget, got ${levers.join(',')}`)
  const search = searchKgcSemanticNodeIds({ graphData: graph, term: 'estimated cost' })
  if (search.join(',') !== 'estimated_cost_usd') throw new Error(`expected search to find estimated_cost_usd, got ${search.join(',')}`)
  const ancestors = ancestorsKgcSemanticNodeIds({ graphData: graph, nodeId: 'estimated_cost_usd' })
  if (ancestors.join(',') !== 'prompt_tokens,token_budget') {
    throw new Error(`expected transitive ancestors, got ${ancestors.join(',')}`)
  }
  const descendants = descendantsKgcSemanticNodeIds({ graphData: graph, nodeId: 'token_budget' })
  if (descendants.join(',') !== 'estimated_cost_usd,prompt_tokens') {
    throw new Error(`expected transitive descendants, got ${descendants.join(',')}`)
  }
}

export function testWorkspaceKgcSemanticGraphFeedsActiveRendererGraphWithDocumentStructure() {
  const graph = parseWorkspaceKgcSemanticGraphDataCached({
    markdownName: 'portable-economics.md',
    markdownText: buildKgcSemanticFixture(),
  })
  if (!graph) throw new Error('expected workspace KGC semantic graph')
  const nodeIds = new Set((graph.nodes || []).map(node => String(node.id || '')))
  if (!nodeIds.has('token_budget') || !nodeIds.has('prompt_tokens')) {
    throw new Error('expected workspace graph to include KGC semantic nodes')
  }
  if (!nodeIds.has('doc:md:portable-economics')) {
    throw new Error('expected workspace graph to retain Markdown document structure nodes')
  }
  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.kind !== KGC_SEMANTIC_GRAPH_KIND || meta.graphKind !== KGC_SEMANTIC_GRAPH_KIND) {
    throw new Error('expected workspace graph metadata to preserve KGC semantic graph kind')
  }
}

export function testKgcSemanticGraphSuppressesKeywordReDerivationInActiveGraphOwner() {
  const source = readFileSync(resolve(process.cwd(), 'src/hooks/active-graph-data/useActiveGraphData.impl.ts'), 'utf8')
  const structuredLine = source
    .split('\n')
    .find(line => line.includes('const hasStructuredWorkspaceGraph =')) || ''
  if (!structuredLine.includes('workspaceKgcSemanticGraphData')) {
    throw new Error('expected KGC semantic Markdown to count as a structured workspace graph and suppress keyword re-derivation')
  }
}

export function testMarkdownParserMergesKgcSemanticGraphIntoNeutralMarkdownGraph() {
  const parser = builtInParsers.find(spec => spec.id === toParserId('markdown'))
  if (!parser) throw new Error('expected built-in markdown parser')
  const result = parser.parse('portable-economics.md', buildKgcSemanticFixture())
  const graph = result.graphData
  const nodeIds = new Set((graph.nodes || []).map(node => String(node.id || '')))
  if (!nodeIds.has('doc:md:portable-economics')) throw new Error('expected Markdown parser to retain document node')
  if (!nodeIds.has('token_budget') || !nodeIds.has('estimated_cost_usd')) {
    throw new Error('expected Markdown parser to merge KGC semantic nodes')
  }
  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.kind !== KGC_SEMANTIC_GRAPH_KIND) throw new Error('expected merged graph kind to be KGC semantic')
}
