export type UndirectedNeighbors = Map<string, string[]>

const clampNumber = (v: number, min: number, max: number): number => {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, v))
}

export const buildUndirectedNeighbors = (args: { nodeIds: string[]; edges: Array<{ source: unknown; target: unknown }> }): UndirectedNeighbors => {
  const nodeSet = new Set(args.nodeIds.filter(Boolean))
  const out = new Map<string, string[]>()
  for (let i = 0; i < args.nodeIds.length; i += 1) {
    const id = args.nodeIds[i]
    if (id) out.set(id, [])
  }
  for (let i = 0; i < args.edges.length; i += 1) {
    const e = args.edges[i]!
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t) continue
    if (s === t) continue
    if (!nodeSet.has(s) || !nodeSet.has(t)) continue
    const a = out.get(s) || []
    a.push(t)
    out.set(s, a)
    const b = out.get(t) || []
    b.push(s)
    out.set(t, b)
  }
  out.forEach((arr, k) => {
    const uniq = Array.from(new Set(arr)).filter(Boolean).sort((a, b) => a.localeCompare(b))
    out.set(k, uniq)
  })
  return out
}

export const computeGraphDensity = (nodeCount: number, edgeCountDirected: number): number => {
  if (nodeCount < 2) return 0
  return edgeCountDirected / (nodeCount * (nodeCount - 1))
}

export const computeClusteringCoefficient = (args: { nodeIds: string[]; undirectedNeighbors: UndirectedNeighbors }): number => {
  const nodes = args.nodeIds.slice().filter(Boolean)
  if (nodes.length === 0) return 0
  const neighborSetById = new Map<string, Set<string>>()
  for (let i = 0; i < nodes.length; i += 1) {
    const id = nodes[i]!
    neighborSetById.set(id, new Set((args.undirectedNeighbors.get(id) || []).filter(Boolean)))
  }
  let sum = 0
  let count = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const id = nodes[i]!
    const nbs = Array.from(neighborSetById.get(id) || new Set<string>())
    const k = nbs.length
    if (k < 2) {
      count += 1
      continue
    }
    let links = 0
    for (let a = 0; a < k; a += 1) {
      const na = nbs[a]!
      const naSet = neighborSetById.get(na) || new Set<string>()
      for (let b = a + 1; b < k; b += 1) {
        const nb = nbs[b]!
        if (naSet.has(nb)) links += 1
      }
    }
    const possible = (k * (k - 1)) / 2
    sum += possible > 0 ? links / possible : 0
    count += 1
  }
  return count > 0 ? sum / count : 0
}

export type ShortestPathStats = { diameter: number; avgPathLength: number }

export const computeShortestPathStats = (args: {
  nodeIds: string[]
  undirectedNeighbors: UndirectedNeighbors
  maxNodes: number
  maxSteps: number
}): ShortestPathStats => {
  const nodes = args.nodeIds.slice().filter(Boolean).sort((a, b) => a.localeCompare(b))
  if (nodes.length === 0) return { diameter: 0, avgPathLength: 0 }
  if (nodes.length > args.maxNodes) return { diameter: 0, avgPathLength: 0 }
  let steps = 0
  let diameter = 0
  let sumDist = 0
  let pairCount = 0
  for (let i = 0; i < nodes.length; i += 1) {
    if (steps > args.maxSteps) break
    const start = nodes[i]!
    const dist = new Map<string, number>()
    const queue: string[] = [start]
    dist.set(start, 0)
    for (let qi = 0; qi < queue.length; qi += 1) {
      if (steps > args.maxSteps) break
      const cur = queue[qi]!
      const cd = dist.get(cur) || 0
      const nbs = args.undirectedNeighbors.get(cur) || []
      for (let j = 0; j < nbs.length; j += 1) {
        steps += 1
        if (steps > args.maxSteps) break
        const nb = nbs[j]!
        if (dist.has(nb)) continue
        dist.set(nb, cd + 1)
        queue.push(nb)
      }
    }
    nodes.forEach((other, j) => {
      if (j <= i) return
      const d = dist.get(other)
      if (typeof d !== 'number') return
      if (d > diameter) diameter = d
      sumDist += d
      pairCount += 1
    })
  }
  return { diameter, avgPathLength: pairCount > 0 ? sumDist / pairCount : 0 }
}

export const computeBetweennessCentrality = (args: {
  nodeIds: string[]
  undirectedNeighbors: UndirectedNeighbors
  maxNodes: number
  maxSteps: number
}): Map<string, number> => {
  const nodes = args.nodeIds.slice().filter(Boolean).sort((a, b) => a.localeCompare(b))
  const out = new Map<string, number>()
  if (nodes.length === 0) return out
  if (nodes.length > args.maxNodes) return out
  nodes.forEach(n => out.set(n, 0))

  let steps = 0
  for (let sIdx = 0; sIdx < nodes.length; sIdx += 1) {
    if (steps > args.maxSteps) break
    const s = nodes[sIdx]!
    const stack: string[] = []
    const pred = new Map<string, string[]>()
    const sigma = new Map<string, number>()
    const dist = new Map<string, number>()
    nodes.forEach(v => {
      pred.set(v, [])
      sigma.set(v, 0)
      dist.set(v, -1)
    })
    sigma.set(s, 1)
    dist.set(s, 0)
    const queue: string[] = [s]
    for (let qi = 0; qi < queue.length; qi += 1) {
      if (steps > args.maxSteps) break
      const v = queue[qi]!
      stack.push(v)
      const vDist = dist.get(v) || 0
      const nbs = args.undirectedNeighbors.get(v) || []
      for (let ni = 0; ni < nbs.length; ni += 1) {
        steps += 1
        if (steps > args.maxSteps) break
        const w = nbs[ni]!
        if ((dist.get(w) || -1) < 0) {
          queue.push(w)
          dist.set(w, vDist + 1)
        }
        if ((dist.get(w) || -1) === vDist + 1) {
          sigma.set(w, (sigma.get(w) || 0) + (sigma.get(v) || 0))
          const p = pred.get(w) || []
          p.push(v)
          pred.set(w, p)
        }
      }
    }

    const delta = new Map<string, number>()
    nodes.forEach(v => delta.set(v, 0))
    while (stack.length > 0) {
      if (steps > args.maxSteps) break
      const w = stack.pop()!
      const wPred = pred.get(w) || []
      for (let pi = 0; pi < wPred.length; pi += 1) {
        const v = wPred[pi]!
        const sigV = sigma.get(v) || 0
        const sigW = sigma.get(w) || 0
        if (sigW > 0) {
          delta.set(v, (delta.get(v) || 0) + (sigV / sigW) * (1 + (delta.get(w) || 0)))
        }
      }
      if (w !== s) out.set(w, (out.get(w) || 0) + (delta.get(w) || 0))
    }
  }

  const max = Math.max(...Array.from(out.values()))
  if (max > 0) {
    out.forEach((v, k) => out.set(k, clampNumber(v / max, 0, 1)))
  }
  return out
}
