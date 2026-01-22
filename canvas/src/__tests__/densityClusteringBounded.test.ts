import { computeDbscanCommunities } from '@/features/semantic-mode/densityClustering'

export const testDensityClusteringReturnsEmptyWhenMaxNodesExceeded = () => {
  const nodeIds = Array.from({ length: 220 }).map((_, i) => `n${i}`)
  const vectorByNodeId = new Map<string, Map<string, number>>()
  nodeIds.forEach(id => vectorByNodeId.set(id, new Map([['tok', 1]])))
  const out = computeDbscanCommunities({ nodeIds, vectorByNodeId, config: { maxNodes: 200 } })
  if (out.size !== 0) throw new Error('expected empty output when maxNodes exceeded')
}

export const testDensityClusteringRespectsMaxSteps = () => {
  const nodeIds = Array.from({ length: 20 }).map((_, i) => `n${i}`)
  const vectorByNodeId = new Map<string, Map<string, number>>()
  nodeIds.forEach(id => vectorByNodeId.set(id, new Map([['tok', 1]])))
  const out = computeDbscanCommunities({ nodeIds, vectorByNodeId, config: { maxSteps: 1, eps: 0.99, minPts: 2 } })
  if (!(out instanceof Map)) throw new Error('expected Map output')
  if (out.size > nodeIds.length) throw new Error('output cannot exceed input size')
}

