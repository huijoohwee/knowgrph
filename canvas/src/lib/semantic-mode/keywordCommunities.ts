export type WeightedNeighbor = { id: string; w: number }

export const computeLabelPropagationCommunities = (args: {
  nodeIds: string[]
  neighbors: Map<string, WeightedNeighbor[]>
  iterations: number
}): Map<string, string> => {
  const nodeIds = [...args.nodeIds].map(id => String(id || '').trim()).filter(Boolean)
  nodeIds.sort((a, b) => a.localeCompare(b))

  const labels = new Map<string, string>()
  for (let i = 0; i < nodeIds.length; i += 1) labels.set(nodeIds[i]!, nodeIds[i]!)

  const iters = Math.max(1, Math.min(32, Math.floor(args.iterations)))
  for (let iter = 0; iter < iters; iter += 1) {
    let changed = false
    for (let i = 0; i < nodeIds.length; i += 1) {
      const id = nodeIds[i]!
      const neigh = args.neighbors.get(id) || []
      if (neigh.length === 0) continue

      const weightByLabel = new Map<string, number>()
      for (let j = 0; j < neigh.length; j += 1) {
        const nb = neigh[j]!
        const nbId = String(nb.id || '').trim()
        if (!nbId) continue
        const nbLabel = labels.get(nbId) || nbId
        const w = typeof nb.w === 'number' && Number.isFinite(nb.w) && nb.w > 0 ? nb.w : 0
        if (w <= 0) continue
        weightByLabel.set(nbLabel, (weightByLabel.get(nbLabel) || 0) + w)
      }
      if (weightByLabel.size === 0) continue

      let bestLabel = labels.get(id) || id
      let bestW = -1
      weightByLabel.forEach((w, l) => {
        if (w > bestW) {
          bestW = w
          bestLabel = l
          return
        }
        if (w === bestW && l.localeCompare(bestLabel) < 0) bestLabel = l
      })

      const cur = labels.get(id) || id
      if (bestLabel !== cur) {
        labels.set(id, bestLabel)
        changed = true
      }
    }
    if (!changed) break
  }

  return labels
}

export const compressCommunityLabels = (args: {
  labelsByNodeId: Map<string, string>
  neighbors: Map<string, WeightedNeighbor[]>
  maxCommunities: number
}): Map<string, number> => {
  const max = Math.max(2, Math.min(64, Math.floor(args.maxCommunities)))
  const labelsByNodeId = new Map(args.labelsByNodeId)

  if (args.neighbors.size === 0) {
    const ids = Array.from(labelsByNodeId.keys()).map(id => String(id || '').trim()).filter(Boolean)
    ids.sort((a, b) => a.localeCompare(b))
    const out = new Map<string, number>()
    for (let i = 0; i < ids.length; i += 1) out.set(ids[i]!, (i % max) + 1)
    return out
  }

  const buildNodesByLabel = () => {
    const out = new Map<string, string[]>()
    labelsByNodeId.forEach((label, nodeId) => {
      const arr = out.get(label) || []
      arr.push(nodeId)
      out.set(label, arr)
    })
    out.forEach(arr => arr.sort((a, b) => a.localeCompare(b)))
    return out
  }

  let nodesByLabel = buildNodesByLabel()

  const totalCommunityWeight = (label: string): number => {
    const nodes = nodesByLabel.get(label) || []
    const nodeSet = new Set(nodes)
    let w = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const id = nodes[i]!
      const neigh = args.neighbors.get(id) || []
      for (let j = 0; j < neigh.length; j += 1) {
        const nb = neigh[j]!
        if (nodeSet.has(nb.id)) w += nb.w
      }
    }
    return w
  }

  while (nodesByLabel.size > max) {
    const labels = Array.from(nodesByLabel.entries()).map(([label, nodes]) => ({ label, size: nodes.length }))
    labels.sort((a, b) => a.size - b.size || a.label.localeCompare(b.label))
    const smallest = labels[0]
    if (!smallest) break
    const smallLabel = smallest.label
    const smallNodes = nodesByLabel.get(smallLabel) || []
    if (smallNodes.length === 0) {
      nodesByLabel.delete(smallLabel)
      continue
    }

    let changed = false
    for (let i = 0; i < smallNodes.length; i += 1) {
      const id = smallNodes[i]!
      const neigh = args.neighbors.get(id) || []
      let bestTarget: string | null = null
      let bestW = -1
      for (let j = 0; j < neigh.length; j += 1) {
        const nb = neigh[j]!
        const nbLabel = labelsByNodeId.get(nb.id) || null
        if (!nbLabel || nbLabel === smallLabel || !nodesByLabel.has(nbLabel)) continue
        const w = nb.w
        if (w > bestW) {
          bestW = w
          bestTarget = nbLabel
        } else if (w === bestW && bestTarget && nbLabel.localeCompare(bestTarget) < 0) {
          bestTarget = nbLabel
        }
      }
      if (bestTarget) {
        labelsByNodeId.set(id, bestTarget)
        changed = true
      }
    }

    if (!changed) {
      const target = Array.from(nodesByLabel.entries())
        .filter(([label]) => label !== smallLabel)
        .map(([label, nodes]) => ({ label, size: nodes.length }))
        .sort((a, b) => b.size - a.size || a.label.localeCompare(b.label))[0]?.label || null
      if (!target) break
      for (let i = 0; i < smallNodes.length; i += 1) labelsByNodeId.set(smallNodes[i]!, target)
    }

    nodesByLabel = buildNodesByLabel()
  }

  const communities = Array.from(nodesByLabel.entries()).map(([label, nodes]) => ({
    label,
    size: nodes.length,
    weight: totalCommunityWeight(label),
  }))
  communities.sort((a, b) => b.weight - a.weight || b.size - a.size || a.label.localeCompare(b.label))

  const idByLabel = new Map<string, number>()
  for (let i = 0; i < communities.length; i += 1) idByLabel.set(communities[i]!.label, i + 1)

  const out = new Map<string, number>()
  labelsByNodeId.forEach((label, nodeId) => {
    const cid = idByLabel.get(label)
    if (cid != null) out.set(nodeId, cid)
  })
  return out
}
