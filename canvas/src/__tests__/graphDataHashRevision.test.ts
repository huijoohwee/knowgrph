import { useGraphStore } from '@/hooks/useGraphStore'

export function testGraphDataMetadataHashIncludesRevision() {
  const store = useGraphStore.getState()
  store.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as never)
  const g1 = useGraphStore.getState().graphData as { metadata?: Record<string, unknown> } | null
  const h1 = typeof g1?.metadata?.hash === 'string' ? String(g1?.metadata?.hash) : ''
  if (!h1.startsWith('rev:')) throw new Error(`expected metadata.hash to start with rev:, got ${JSON.stringify(h1)}`)

  store.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as never)
  const g2 = useGraphStore.getState().graphData as { metadata?: Record<string, unknown> } | null
  const h2 = typeof g2?.metadata?.hash === 'string' ? String(g2?.metadata?.hash) : ''
  if (!h2.startsWith('rev:')) throw new Error(`expected metadata.hash to start with rev:, got ${JSON.stringify(h2)}`)
  if (h2 === h1) throw new Error(`expected metadata.hash to change across setGraphData calls, got ${JSON.stringify(h2)}`)
}

