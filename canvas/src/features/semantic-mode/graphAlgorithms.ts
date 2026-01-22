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

export const computeHITS = (args: {
  nodeIds: string[]
  edges: Array<{ source: unknown; target: unknown }>
  iterations?: number
}): { hubs: Map<string, number>; authorities: Map<string, number> } => {
  const nodes = [...args.nodeIds].filter(Boolean).sort((a, b) => a.localeCompare(b))
  const n = nodes.length
  if (n === 0) return { hubs: new Map(), authorities: new Map() }

  const iterations = typeof args.iterations === 'number' && Number.isFinite(args.iterations) ? Math.max(1, Math.min(100, Math.floor(args.iterations))) : 20

  // Build directed adjacency
  const inMap = new Map<string, string[]>() // u <- [v, ...]
  const outMap = new Map<string, string[]>() // u -> [v, ...]
  nodes.forEach(id => {
    inMap.set(id, [])
    outMap.set(id, [])
  })

  const nodeSet = new Set(nodes)
  for (const e of args.edges) {
    const s = String(e.source || '')
    const t = String(e.target || '')
    if (!s || !t || s === t) continue
    if (!nodeSet.has(s) || !nodeSet.has(t)) continue
    
    outMap.get(s)?.push(t)
    inMap.get(t)?.push(s)
  }

  let hubs = new Map<string, number>()
  let auth = new Map<string, number>()
  nodes.forEach(id => {
    hubs.set(id, 1)
    auth.set(id, 1)
  })

  for (let it = 0; it < iterations; it += 1) {
    // Update authorities
    let normAuth = 0
    nodes.forEach(u => {
      let a = 0
      const incoming = inMap.get(u) || []
      for (const v of incoming) {
        a += hubs.get(v) || 0
      }
      auth.set(u, a)
      normAuth += a * a
    })
    normAuth = Math.sqrt(normAuth)
    if (normAuth > 0) {
      nodes.forEach(u => auth.set(u, (auth.get(u) || 0) / normAuth))
    }

    // Update hubs
    let normHubs = 0
    nodes.forEach(u => {
      let h = 0
      const outgoing = outMap.get(u) || []
      for (const v of outgoing) {
        h += auth.get(v) || 0
      }
      hubs.set(u, h)
      normHubs += h * h
    })
    normHubs = Math.sqrt(normHubs)
    if (normHubs > 0) {
      nodes.forEach(u => hubs.set(u, (hubs.get(u) || 0) / normHubs))
    }
  }

  return { hubs, authorities: auth }
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

