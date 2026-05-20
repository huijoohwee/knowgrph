import { summarizeDesignTokens } from '@/features/design/designTokenSummary'
import type { GraphData } from '@/lib/graph/types'

const makeGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    {
      id: 'frame-a',
      label: 'Frame A',
      type: 'Frame',
      properties: {
        fill: '#FF0000',
        stroke: '#111111',
        gap: 12,
        padding: 16,
        fontSize: 14,
      },
    },
    {
      id: 'frame-b',
      label: 'Frame B',
      type: 'Frame',
      properties: {
        backgroundColor: '#ff0000',
        borderRadius: 8,
        fontWeight: 600,
      },
    },
  ],
  edges: [],
})

export function testDesignTokenSummaryExtractsDesignTokens() {
  const summary = summarizeDesignTokens({ graphData: makeGraph(), graphRevision: 1, maxEntries: 8 })
  if (!summary.semanticKey) throw new Error('expected design token summary to expose a semantic key')
  const red = summary.colorEntries.find(entry => entry.value === '#ff0000')
  if (!red || red.count !== 2) throw new Error(`expected shared red token count; got ${JSON.stringify(summary.colorEntries)}`)
  if (!summary.typeEntries.some(entry => entry.value === 'Frame' && entry.count === 2)) {
    throw new Error(`expected type summary to count frame nodes; got ${JSON.stringify(summary.typeEntries)}`)
  }
  if (!summary.spacingEntries.some(entry => entry.value === 'gap:12')) {
    throw new Error(`expected spacing tokens; got ${JSON.stringify(summary.spacingEntries)}`)
  }
  if (!summary.typographyEntries.some(entry => entry.value === 'fontSize:14')) {
    throw new Error(`expected typography tokens; got ${JSON.stringify(summary.typographyEntries)}`)
  }
}

export function testDesignTokenSummaryReusesSemanticKeyedCache() {
  const graph = makeGraph()
  const first = summarizeDesignTokens({ graphData: graph, graphRevision: 7, maxEntries: 8 })
  const second = summarizeDesignTokens({ graphData: graph, graphRevision: 7, maxEntries: 8 })
  if (first !== second) throw new Error('expected unchanged graph revision to reuse semantic-keyed token summary cache')
}
