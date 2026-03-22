import { computeLayoutDatasetKey } from '@/lib/canvas/layoutPositioning'

export const testLayoutDatasetKeyStableAcrossRevision = () => {
  const graphData = {
    nodes: Array.from({ length: 120 }).map((_, i) => ({ id: `n${i}`, type: 'Node', properties: {} })),
    edges: Array.from({ length: 180 }).map((_, i) => ({ source: `n${i % 120}`, target: `n${(i * 7) % 120}`, label: 'rel' })),
    metadata: {},
  }

  const k1 = computeLayoutDatasetKey({ graphData: graphData as any, graphDataRevision: 1 })
  const k2 = computeLayoutDatasetKey({ graphData: graphData as any, graphDataRevision: 2 })
  if (k1 !== k2) throw new Error(`expected datasetKey stable across revision bumps, got ${k1} vs ${k2}`)

  const graphData2 = {
    ...graphData,
    nodes: [...graphData.nodes, { id: 'n_new', type: 'Node', properties: {} }],
  }
  const k3 = computeLayoutDatasetKey({ graphData: graphData2 as any, graphDataRevision: 3 })
  if (k3 === k2) throw new Error('expected datasetKey to change when graph shape changes')
}

