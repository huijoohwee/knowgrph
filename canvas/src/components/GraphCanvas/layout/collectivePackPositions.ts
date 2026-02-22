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
  paddingPx?: number
  targetAspect?: number
}): Record<string, PackPos> => {
  const { nodeIds, edges, positions, nodeSize, paddingPx = 80, targetAspect = 16 / 9 } = args
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

  components.sort((a, b) => b.bbox.height - a.bbox.height)

  const totalArea = components.reduce((sum, c) => sum + (c.bbox.width + paddingPx) * (c.bbox.height + paddingPx), 0)
  const targetWidth = Math.max(
    components.reduce((m, c) => Math.max(m, c.bbox.width), 0),
    Math.sqrt(Math.max(1, totalArea) * Math.max(0.2, targetAspect)),
  )

  let x = 0
  let y = 0
  let rowH = 0
  const placements: Array<{ compIndex: number; x: number; y: number }> = []

  for (let i = 0; i < components.length; i += 1) {
    const c = components[i]
    if (x + c.bbox.width > targetWidth && x > 0) {
      x = 0
      y += rowH + paddingPx
      rowH = 0
    }
    placements.push({ compIndex: i, x, y })
    rowH = Math.max(rowH, c.bbox.height)
    x += c.bbox.width + paddingPx
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

  const arrCX = (arrMinX + arrMaxX) / 2
  const arrCY = (arrMinY + arrMaxY) / 2
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

