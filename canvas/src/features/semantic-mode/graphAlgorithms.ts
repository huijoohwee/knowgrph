export const computeConnectedComponents = (args: {
  nodeIds: string[]
  undirectedNeighbors: Map<string, string[]>
}): Map<string, number> => {
  const nodes = [...args.nodeIds].filter(Boolean).sort((a, b) => a.localeCompare(b))
  const visited = new Set<string>()
  const out = new Map<string, number>()
  let communityId = 0

  for (let i = 0; i < nodes.length; i += 1) {
    const start = nodes[i]!
    if (visited.has(start)) continue
    const queue: string[] = [start]
    visited.add(start)
    out.set(start, communityId)
    for (let qi = 0; qi < queue.length; qi += 1) {
      const cur = queue[qi]!
      const nbs = (args.undirectedNeighbors.get(cur) || []).slice().sort((a, b) => a.localeCompare(b))
      for (let j = 0; j < nbs.length; j += 1) {
        const nb = nbs[j]!
        if (visited.has(nb)) continue
        visited.add(nb)
        out.set(nb, communityId)
        queue.push(nb)
      }
    }
    communityId += 1
  }

  return out
}

export const computePageRank = (args: {
  nodeIds: string[]
  neighbors: Map<string, string[]>
  iterations?: number
  damping?: number
}): Map<string, number> => {
  const nodes = [...args.nodeIds].filter(Boolean).sort((a, b) => a.localeCompare(b))
  const n = nodes.length
  const out = new Map<string, number>()
  if (n === 0) return out

  const damping = typeof args.damping === 'number' && Number.isFinite(args.damping) ? Math.max(0, Math.min(1, args.damping)) : 0.85
  const iterations = typeof args.iterations === 'number' && Number.isFinite(args.iterations) ? Math.max(1, Math.min(100, Math.floor(args.iterations))) : 20

  let pr = new Map<string, number>()
  const init = 1 / n
  for (let i = 0; i < n; i += 1) pr.set(nodes[i]!, init)

  for (let it = 0; it < iterations; it += 1) {
    const next = new Map<string, number>()
    const base = (1 - damping) / n
    for (let i = 0; i < n; i += 1) next.set(nodes[i]!, base)

    let danglingTotal = 0
    for (let i = 0; i < n; i += 1) {
      const id = nodes[i]!
      const outs = (args.neighbors.get(id) || []).filter(Boolean)
      const rank = pr.get(id) || 0
      if (outs.length === 0) {
        danglingTotal += rank
        continue
      }
      const share = rank / outs.length
      for (let j = 0; j < outs.length; j += 1) {
        const nb = outs[j]!
        if (!next.has(nb)) continue
        next.set(nb, (next.get(nb) || 0) + damping * share)
      }
    }

    if (danglingTotal > 0) {
      const add = (damping * danglingTotal) / n
      for (let i = 0; i < n; i += 1) {
        const id = nodes[i]!
        next.set(id, (next.get(id) || 0) + add)
      }
    }

    pr = next
  }

  let sum = 0
  for (let i = 0; i < n; i += 1) sum += pr.get(nodes[i]!) || 0
  if (!(sum > 0)) sum = 1
  for (let i = 0; i < n; i += 1) {
    const id = nodes[i]!
    out.set(id, (pr.get(id) || 0) / sum)
  }
  return out
}

