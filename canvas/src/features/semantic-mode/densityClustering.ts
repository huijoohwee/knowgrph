const clampNumber = (v: number, min: number, max: number): number => {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

const cosineSimilarity = (a: Map<string, number>, b: Map<string, number>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  a.forEach((va, key) => {
    normA += va * va
    const vb = b.get(key)
    if (typeof vb === 'number') dot += va * vb
  })
  b.forEach((vb) => {
    normB += vb * vb
  })
  if (!(normA > 0) || !(normB > 0)) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export type DensityClusteringConfig = {
  eps: number
  minPts: number
  maxNodes: number
  maxSteps: number
}

export const DEFAULT_DENSITY_CLUSTERING_CONFIG: DensityClusteringConfig = {
  eps: 0.55,
  minPts: 2,
  maxNodes: 200,
  maxSteps: 120_000,
}

export function computeDbscanCommunities(args: {
  nodeIds: string[]
  vectorByNodeId: Map<string, Map<string, number>>
  config?: Partial<DensityClusteringConfig>
}): Map<string, number> {
  const cfg = { ...DEFAULT_DENSITY_CLUSTERING_CONFIG, ...(args.config || {}) }
  cfg.eps = clampNumber(cfg.eps, 0.05, 0.99)
  cfg.minPts = Math.max(1, Math.floor(cfg.minPts))
  cfg.maxNodes = Math.max(10, Math.floor(cfg.maxNodes))
  cfg.maxSteps = Math.max(1_000, Math.floor(cfg.maxSteps))

  const nodes = args.nodeIds.slice().filter(Boolean).sort((a, b) => a.localeCompare(b))
  const out = new Map<string, number>()
  if (nodes.length === 0) return out
  if (nodes.length > cfg.maxNodes) return out

  const labels = new Map<string, number>()
  const visited = new Set<string>()
  let clusterId = 0
  let steps = 0

  const dist = (aId: string, bId: string): number => {
    const a = args.vectorByNodeId.get(aId) || new Map<string, number>()
    const b = args.vectorByNodeId.get(bId) || new Map<string, number>()
    const sim = cosineSimilarity(a, b)
    return 1 - sim
  }

  const regionQuery = (id: string): string[] => {
    const neighbors: string[] = []
    for (let i = 0; i < nodes.length; i += 1) {
      const other = nodes[i]!
      steps += 1
      if (steps > cfg.maxSteps) break
      if (other === id) continue
      if (dist(id, other) <= cfg.eps) neighbors.push(other)
    }
    neighbors.sort((a, b) => a.localeCompare(b))
    return neighbors
  }

  const expandCluster = (id: string, neighbors: string[], cid: number) => {
    labels.set(id, cid)
    for (let i = 0; i < neighbors.length; i += 1) {
      if (steps > cfg.maxSteps) break
      const nb = neighbors[i]!
      if (!visited.has(nb)) {
        visited.add(nb)
        const nbNeighbors = regionQuery(nb)
        if (nbNeighbors.length + 1 >= cfg.minPts) {
          for (let j = 0; j < nbNeighbors.length; j += 1) {
            const nn = nbNeighbors[j]!
            if (!neighbors.includes(nn)) neighbors.push(nn)
          }
          neighbors.sort((a, b) => a.localeCompare(b))
        }
      }
      if (!labels.has(nb)) labels.set(nb, cid)
    }
  }

  for (let i = 0; i < nodes.length; i += 1) {
    if (steps > cfg.maxSteps) break
    const id = nodes[i]!
    if (visited.has(id)) continue
    visited.add(id)
    const neighbors = regionQuery(id)
    if (neighbors.length + 1 < cfg.minPts) {
      labels.set(id, -1)
      continue
    }
    clusterId += 1
    expandCluster(id, neighbors, clusterId)
  }

  labels.forEach((cid, id) => {
    if (cid >= 0) out.set(id, cid)
  })
  return out
}

