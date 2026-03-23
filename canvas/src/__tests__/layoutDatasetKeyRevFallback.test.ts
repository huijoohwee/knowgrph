import { computeLayoutDatasetKey } from '@/lib/canvas/layoutPositioning'

export const testLayoutDatasetKeyRevFallbackUsesRevision = () => {
  const empty = { nodes: [], edges: [], metadata: {} }
  const k1 = computeLayoutDatasetKey({ graphData: empty as any, graphDataRevision: 5 })
  const k2 = computeLayoutDatasetKey({ graphData: empty as any, graphDataRevision: 6 })
  if (k1 !== 'rev:5') throw new Error(`expected rev fallback, got ${k1}`)
  if (k2 !== 'rev:6') throw new Error(`expected rev fallback, got ${k2}`)
}

