import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'
import { measureGraphElementCenterSet } from '@/lib/canvas/graph-elements/centroid'

export type ArrangeAction2d =
  | 'align-left'
  | 'align-center-x'
  | 'align-right'
  | 'align-top'
  | 'align-center-y'
  | 'align-bottom'
  | 'distribute-x'
  | 'distribute-y'

export type ArrangeItemRect = {
  id: string
  cx: number
  cy: number
  w: number
  h: number
}

export function computeWorldCentroid(items: readonly { x: number; y: number }[]): { x: number; y: number } | null {
  const metrics = measureGraphElementCenterSet(items)
  return metrics ? { x: metrics.centroidX, y: metrics.centroidY } : null
}

export function computeArrangeCenters(args: {
  action: ArrangeAction2d
  items: readonly ArrangeItemRect[]
  refId?: string | null
  minSpacing?: number
}): Record<string, { cx: number; cy: number }> {
  const action = args.action
  const items = Array.isArray(args.items) ? args.items : []
  if (items.length < 2) return {}

  if (action === 'distribute-x' || action === 'distribute-y') {
    if (items.length < 3) return {}
    const axis = action === 'distribute-x' ? 'x' : 'y'
    const minSpacing = Number.isFinite(args.minSpacing) ? Math.max(0, Number(args.minSpacing)) : 24
    const next = computeEvenlyDistributedPositions({
      nodes: items.map(n => ({ id: n.id, x: n.cx, y: n.cy })),
      axis,
      minSpacing,
    })
    const out: Record<string, { cx: number; cy: number }> = {}
    for (const [id, p] of Object.entries(next)) {
      out[id] = { cx: p.x, cy: p.y }
    }
    return out
  }

  const byId = new Map<string, ArrangeItemRect>()
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!
    const id = String(it.id || '').trim()
    if (!id) continue
    byId.set(id, it)
  }
  const refId = String(args.refId || '').trim()
  const ref = (refId && byId.get(refId)) || items[0]!
  const left = ref.cx - ref.w / 2
  const right = ref.cx + ref.w / 2
  const top = ref.cy - ref.h / 2
  const bottom = ref.cy + ref.h / 2
  const out: Record<string, { cx: number; cy: number }> = {}
  for (let i = 0; i < items.length; i += 1) {
    const n = items[i]!
    const id = String(n.id || '').trim()
    if (!id) continue
    let cx = n.cx
    let cy = n.cy
    if (action === 'align-left') cx = left + n.w / 2
    if (action === 'align-right') cx = right - n.w / 2
    if (action === 'align-center-x') cx = ref.cx
    if (action === 'align-top') cy = top + n.h / 2
    if (action === 'align-bottom') cy = bottom - n.h / 2
    if (action === 'align-center-y') cy = ref.cy
    out[id] = { cx, cy }
  }
  return out
}
