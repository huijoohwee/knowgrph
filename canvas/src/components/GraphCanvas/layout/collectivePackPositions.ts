export type PackEdge = { source: string; target: string }
export type PackPos = { x: number; y: number }

type BBox = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
}

type Component = {
  nodeIds: string[]
  bbox: BBox
}

const computeBBox = (nodeIds: string[], positions: Record<string, PackPos>, nodeSize: { widthPx: number; heightPx: number }): BBox | null => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let valid = 0
  const w = Math.max(1, nodeSize.widthPx)
  const h = Math.max(1, nodeSize.heightPx)

  for (let i = 0; i < nodeIds.length; i += 1) {
    const id = nodeIds[i]
    const p = positions[id]
    if (!p) continue
    const x = p.x
    const y = p.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + w > maxX) maxX = x + w
    if (y + h > maxY) maxY = y + h
    valid += 1
  }

  if (valid === 0) return null
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

export const packDisjointPositions2d = (args: {
  nodeIds: string[]
  edges: PackEdge[]
  positions: Record<string, PackPos>
  nodeSize: { widthPx: number; heightPx: number }
  groups?: Array<{ memberNodeIds: string[] }>
  paddingPx?: number
  targetAspect?: number
}): Record<string, PackPos> => {
  const { nodeIds, edges, positions, nodeSize, groups, paddingPx = 80, targetAspect = 16 / 9 } = args
  if (nodeIds.length < 2) return positions

  const nodeSet = new Set(nodeIds)
  const adj = new Map<string, string[]>()
  for (let i = 0; i < nodeIds.length; i += 1) adj.set(nodeIds[i], [])
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i]
    const s = String(e.source)
    const t = String(e.target)
    if (!nodeSet.has(s) || !nodeSet.has(t)) continue
    adj.get(s)?.push(t)
    adj.get(t)?.push(s)
  }
  if (groups && groups.length > 0) {
    for (let gi = 0; gi < groups.length; gi += 1) {
      const raw = groups[gi]?.memberNodeIds
      if (!Array.isArray(raw) || raw.length < 2) continue
      const members: string[] = []
      for (let i = 0; i < raw.length; i += 1) {
        const id = String(raw[i] || '').trim()
        if (!id) continue
        if (!nodeSet.has(id)) continue
        members.push(id)
      }
      if (members.length < 2) continue
      for (let i = 1; i < members.length; i += 1) {
        const a = members[i - 1]!
        const b = members[i]!
        adj.get(a)?.push(b)
        adj.get(b)?.push(a)
      }
    }
  }

  const visited = new Set<string>()
  const components: Component[] = []

  for (let i = 0; i < nodeIds.length; i += 1) {
    const start = nodeIds[i]
    if (visited.has(start)) continue
    visited.add(start)

    const stack = [start]
    const comp: string[] = []
    while (stack.length) {
      const id = stack.pop()!
      comp.push(id)
      const neigh = adj.get(id) || []
      for (let j = 0; j < neigh.length; j += 1) {
        const nid = neigh[j]
        if (visited.has(nid)) continue
        visited.add(nid)
        stack.push(nid)
      }
    }

    const bbox = computeBBox(comp, positions, nodeSize)
    if (bbox) components.push({ nodeIds: comp, bbox })
  }

  if (components.length <= 1) return positions

  const pad = Math.max(0, Math.floor(paddingPx))
  const aspect = Number.isFinite(targetAspect) ? Math.max(0.2, Math.min(6, targetAspect)) : 16 / 9

  components.sort((a, b) => {
    const aa = a.bbox.width * a.bbox.height
    const bb = b.bbox.width * b.bbox.height
    if (aa !== bb) return bb - aa
    if (a.bbox.height !== b.bbox.height) return b.bbox.height - a.bbox.height
    return b.bbox.width - a.bbox.width
  })

  const totalArea = components.reduce((sum, c) => sum + (c.bbox.width + pad) * (c.bbox.height + pad), 0)
  const maxCompW = components.reduce((m, c) => Math.max(m, c.bbox.width), 0)
  const baseTargetW = Math.max(maxCompW, Math.sqrt(Math.max(1, totalArea) * aspect))

  const place = (wTarget: number) => {
    const targetW = Math.max(maxCompW, Math.floor(wTarget))
    let x = 0
    let y = 0
    let rowH = 0
    const placements: Array<{ compIndex: number; x: number; y: number }> = []
    for (let i = 0; i < components.length; i += 1) {
      const c = components[i]
      if (x + c.bbox.width > targetW && x > 0) {
        x = 0
        y += rowH + pad
        rowH = 0
      }
      placements.push({ compIndex: i, x, y })
      rowH = Math.max(rowH, c.bbox.height)
      x += c.bbox.width + pad
    }
    let arrMinX = Infinity
    let arrMinY = Infinity
    let arrMaxX = -Infinity
    let arrMaxY = -Infinity
    for (let i = 0; i < placements.length; i += 1) {
      const p = placements[i]
      const c = components[p.compIndex]
      arrMinX = Math.min(arrMinX, p.x)
      arrMinY = Math.min(arrMinY, p.y)
      arrMaxX = Math.max(arrMaxX, p.x + c.bbox.width)
      arrMaxY = Math.max(arrMaxY, p.y + c.bbox.height)
    }
    const width = Math.max(1, arrMaxX - arrMinX)
    const height = Math.max(1, arrMaxY - arrMinY)
    return { placements, bbox: { minX: arrMinX, minY: arrMinY, maxX: arrMaxX, maxY: arrMaxY, width, height } }
  }

  const candidates = (() => {
    const mult = [0.62, 0.78, 0.9, 1, 1.15, 1.35, 1.65]
    const xs: number[] = []
    for (let i = 0; i < mult.length; i += 1) xs.push(baseTargetW * mult[i]!)
    xs.push(maxCompW)
    const uniq = Array.from(new Set(xs.map(v => Math.max(maxCompW, Math.floor(v)))))
    uniq.sort((a, b) => a - b)
    return uniq
  })()

  let best = place(baseTargetW)
  let bestScore = Infinity
  for (let i = 0; i < candidates.length; i += 1) {
    const cur = place(candidates[i]!)
    const w = cur.bbox.width
    const h = cur.bbox.height
    const ratio = w / Math.max(1e-9, h)
    const area = w * h
    const ratioPenalty = Math.abs(ratio - aspect) * area * 0.08
    const longSidePenalty = Math.max(w, h) * pad * 0.75
    const score = area + ratioPenalty + longSidePenalty
    if (score < bestScore) {
      bestScore = score
      best = cur
    }
  }

  const placements = best.placements

  const arrCX = (best.bbox.minX + best.bbox.maxX) / 2
  const arrCY = (best.bbox.minY + best.bbox.maxY) / 2
  const shiftX = -arrCX
  const shiftY = -arrCY

  const out: Record<string, PackPos> = { ...positions }
  for (let i = 0; i < placements.length; i += 1) {
    const p = placements[i]
    const c = components[p.compIndex]
    const dx = (p.x + shiftX) - c.bbox.minX
    const dy = (p.y + shiftY) - c.bbox.minY
    for (let j = 0; j < c.nodeIds.length; j += 1) {
      const id = c.nodeIds[j]
      const pos = positions[id]
      if (!pos) continue
      out[id] = { x: pos.x + dx, y: pos.y + dy }
    }
  }

  return out
}
