export type DesignLayerState = {
  order: string[]
  hiddenById: Record<string, boolean>
}

export type DesignLayerNode = {
  id: string
  label: string
  type?: string
}

const normId = (v: unknown): string => String(v || '').trim()

export function normalizeDesignLayerState(args: {
  prev: DesignLayerState
  nodes: DesignLayerNode[]
}): DesignLayerState {
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const byId = new Map<string, DesignLayerNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const id = normId(n?.id)
    if (!id) continue
    if (byId.has(id)) continue
    byId.set(id, { id, label: String(n.label || id), type: n.type })
  }

  const prev = args.prev || { order: [], hiddenById: {} }
  const prevOrder = Array.isArray(prev.order) ? prev.order : []
  const outOrder: string[] = []
  const used = new Set<string>()
  for (let i = 0; i < prevOrder.length; i += 1) {
    const id = normId(prevOrder[i])
    if (!id) continue
    if (!byId.has(id)) continue
    if (used.has(id)) continue
    used.add(id)
    outOrder.push(id)
  }

  const missing: DesignLayerNode[] = []
  for (const [id, n] of byId.entries()) {
    if (used.has(id)) continue
    missing.push(n)
  }
  missing.sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id)))
  for (let i = 0; i < missing.length; i += 1) {
    outOrder.push(missing[i].id)
  }

  const nextHiddenById: Record<string, boolean> = {}
  const prevHidden = prev.hiddenById && typeof prev.hiddenById === 'object' ? prev.hiddenById : {}
  for (const id of outOrder) {
    if (prevHidden[id] === true) nextHiddenById[id] = true
  }

  return { order: outOrder, hiddenById: nextHiddenById }
}

export function toggleDesignLayerHidden(hiddenById: Record<string, boolean>, id: string): Record<string, boolean> {
  const key = normId(id)
  if (!key) return hiddenById
  const cur = hiddenById && typeof hiddenById === 'object' ? hiddenById : {}
  const next = { ...cur }
  if (cur[key] === true) {
    delete next[key]
  } else {
    next[key] = true
  }
  return next
}

export function moveDesignLayer(args: { order: string[]; id: string; dir: 'up' | 'down' }): string[] {
  const order = Array.isArray(args.order) ? args.order : []
  const id = normId(args.id)
  if (!id) return order
  const idx = order.indexOf(id)
  if (idx < 0) return order
  const nextIdx = args.dir === 'up' ? idx - 1 : idx + 1
  if (nextIdx < 0 || nextIdx >= order.length) return order
  const next = order.slice()
  const tmp = next[nextIdx]
  next[nextIdx] = next[idx]
  next[idx] = tmp
  return next
}
