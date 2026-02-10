import { resolveGroupCollisions, type CollisionGroupItem } from '@/lib/graph/collision/boxCollision'

export function resolveOverlayPanelCollisions(args: {
  items: Array<{ id: string; top: number; left: number; movable: boolean; width?: number; height?: number }>
  panelSize: { width: number; height: number }
  gapPx: number
  strength: number
  iterations: number
}): Array<{ id: string; top: number; left: number }> {
  const w0 = Number.isFinite(args.panelSize?.width) ? Math.max(0, args.panelSize.width) : 0
  const h0 = Number.isFinite(args.panelSize?.height) ? Math.max(0, args.panelSize.height) : 0
  if (w0 <= 0 || h0 <= 0) return args.items.map(it => ({ id: it.id, top: it.top, left: it.left }))
  const gapPx = Number.isFinite(args.gapPx) ? Math.max(0, args.gapPx) : 0
  const strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : 0.8
  const iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : 6

  const nodes: Array<{ vx?: number; vy?: number }> = args.items.map(() => ({ vx: 0, vy: 0 }))
  const groups: CollisionGroupItem[] = args.items.map((it, i) => {
    const w = typeof it.width === 'number' && Number.isFinite(it.width) ? Math.max(0, it.width) : w0
    const h = typeof it.height === 'number' && Number.isFinite(it.height) ? Math.max(0, it.height) : h0
    const cx = it.left + w * 0.5
    const cy = it.top + h * 0.5
    return {
      id: it.id,
      cx,
      cy,
      halfW: w * 0.5,
      halfH: h * 0.5,
      gap: gapPx,
      movableIdxs: it.movable ? [i] : [],
    }
  })

  for (let k = 0; k < iterations; k += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      nodes[i].vx = 0
      nodes[i].vy = 0
    }

    resolveGroupCollisions({
      groups,
      nodes,
      strength,
      touchEpsilon: 1,
      skipSameGroup: true,
    })

    for (let i = 0; i < groups.length; i += 1) {
      const g = groups[i]
      const n = nodes[i]
      const vx = typeof n?.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
      const vy = typeof n?.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
      if (!vx && !vy) continue
      if (!g.movableIdxs || g.movableIdxs.length === 0) continue
      g.cx += vx
      g.cy += vy
    }
  }

  return groups.map(g => ({
    id: String(g.id || ''),
    top: g.cy - (typeof g.halfH === 'number' && Number.isFinite(g.halfH) ? g.halfH : h0 * 0.5),
    left: g.cx - (typeof g.halfW === 'number' && Number.isFinite(g.halfW) ? g.halfW : w0 * 0.5),
  }))
}
