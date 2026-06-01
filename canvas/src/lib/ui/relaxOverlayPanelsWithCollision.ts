import type { GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { createBboxCollideForce } from '@/components/GraphCanvas/layout/overlap'
import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'

export function relaxOverlayPanelsWithCollision(args: {
  schema: GraphSchema
  items: Array<{
    id: string
    left: number
    top: number
    width: number
    height: number
    movable: boolean
  }>
  obstacles?: Array<{
    id: string
    left: number
    top: number
    width: number
    height: number
  }>
  gapPx: number
  strength: number
  iterations: number
  steps: number
  anchorStrength?: number
  maxAnchorShiftPx?: number
  maxSpeedPxPerStep?: number
}): Array<{ id: string; left: number; top: number }> {
  const stableSeedFromIds = (ids: string[]): number => {
    let seed = 2166136261
    for (let i = 0; i < ids.length; i += 1) {
      const s = ids[i]
      for (let j = 0; j < s.length; j += 1) {
        seed ^= s.charCodeAt(j)
        seed = Math.imul(seed, 16777619)
      }
    }
    return seed >>> 0
  }

  const mulberry32 = (a: number) => {
    return () => {
      let t = (a += 0x6d2b79f5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const schema = args.schema
  const gapPx = Number.isFinite(args.gapPx) ? Math.max(0, args.gapPx) : 0
  const strength = Number.isFinite(args.strength) ? Math.max(0, args.strength) : 0.9
  const iterations = Number.isFinite(args.iterations) ? Math.max(1, Math.floor(args.iterations)) : 10
  const steps = Number.isFinite(args.steps) ? Math.max(1, Math.floor(args.steps)) : 12
  const anchorStrength = Number.isFinite(args.anchorStrength) ? Math.max(0, args.anchorStrength as number) : 0.06
  const maxAnchorShiftPx = (() => {
    const raw = args.maxAnchorShiftPx
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.max(40, raw)
    const n = Math.max(1, args.items.length)
    const base = 60 + gapPx * 3.5
    return Math.max(80, Math.min(520, Math.sqrt(n) * base))
  })()
  const maxSpeedPxPerStep = Number.isFinite(args.maxSpeedPxPerStep) ? Math.max(0, args.maxSpeedPxPerStep as number) : 220

  const proxyNodes: Array<GraphNode & { vx?: number; vy?: number; fx?: number; fy?: number }> = []
  const anchorsById = new Map<string, { x: number; y: number }>()
  for (let i = 0; i < args.items.length; i += 1) {
    const it = args.items[i]
    const id = String(it?.id || '').trim()
    if (!id) continue
    const width = Number.isFinite(it.width) ? Math.max(1, it.width) : 1
    const height = Number.isFinite(it.height) ? Math.max(1, it.height) : 1
    const left = Number.isFinite(it.left) ? it.left : 0
    const top = Number.isFinite(it.top) ? it.top : 0
    const cx = left + width * 0.5
    const cy = top + height * 0.5
    anchorsById.set(id, { x: cx, y: cy })
    proxyNodes.push({
      id,
      type: 'OverlayPanel',
      label: '',
      properties: {
        'visual:shape': 'rect',
        'visual:width': width,
        'visual:height': height,
      } as unknown as GraphNode['properties'],
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      ...(it.movable ? {} : { fx: cx, fy: cy }),
    })
  }

  const obstacles = Array.isArray(args.obstacles) ? args.obstacles : []
  for (let i = 0; i < obstacles.length; i += 1) {
    const it = obstacles[i]
    const id = String(it?.id || '').trim()
    if (!id) continue
    const width = Number.isFinite(it.width) ? Math.max(1, it.width) : 1
    const height = Number.isFinite(it.height) ? Math.max(1, it.height) : 1
    const left = Number.isFinite(it.left) ? it.left : 0
    const top = Number.isFinite(it.top) ? it.top : 0
    const cx = left + width * 0.5
    const cy = top + height * 0.5
    proxyNodes.push({
      id: `__obstacle__:${id}`,
      type: 'OverlayObstacle',
      label: '',
      properties: {
        'visual:shape': 'rect',
        'visual:width': width,
        'visual:height': height,
      } as unknown as GraphNode['properties'],
      x: cx,
      y: cy,
      vx: 0,
      vy: 0,
      fx: cx,
      fy: cy,
    })
  }

  if (proxyNodes.length < 2 || (args.items.length < 2 && obstacles.length === 0)) {
    return args.items.map(it => ({ id: it.id, left: it.left, top: it.top }))
  }

  const force = createBboxCollideForce({
    schema,
    paddingX: gapPx,
    paddingY: gapPx,
    strength,
    iterations,
  })
  const seed = stableSeedFromIds(proxyNodes.map(n => String(n.id || '')).sort((a, b) => a.localeCompare(b)))
  force.initialize(proxyNodes, mulberry32(seed))
  const applyForce = force as unknown as (alpha: number) => void
  const applyAnchor = (alpha: number) => {
    if (!(anchorStrength > 0) || !(alpha > 0)) return
    for (let i = 0; i < proxyNodes.length; i += 1) {
      const n = proxyNodes[i]
      const id = String(n.id || '')
      if (!id || id.startsWith('__obstacle__:')) continue
      const fx = (n as unknown as { fx?: unknown }).fx
      const fy = (n as unknown as { fy?: unknown }).fy
      if (typeof fx === 'number' && Number.isFinite(fx)) continue
      if (typeof fy === 'number' && Number.isFinite(fy)) continue
      const a = anchorsById.get(id)
      if (!a) continue
      const nx = typeof n.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : a.x
      const ny = typeof n.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : a.y
      const vx0 = typeof (n as unknown as { vx?: unknown }).vx === 'number' && Number.isFinite((n as unknown as { vx: number }).vx)
        ? (n as unknown as { vx: number }).vx
        : 0
      const vy0 = typeof (n as unknown as { vy?: unknown }).vy === 'number' && Number.isFinite((n as unknown as { vy: number }).vy)
        ? (n as unknown as { vy: number }).vy
        : 0
      const vx = vx0 + (a.x - nx) * anchorStrength * alpha
      const vy = vy0 + (a.y - ny) * anchorStrength * alpha
      if (maxSpeedPxPerStep > 0) {
        const mag = Math.hypot(vx, vy)
        if (mag > maxSpeedPxPerStep) {
          const s = maxSpeedPxPerStep / Math.max(1e-9, mag)
          ;(n as unknown as { vx: number }).vx = vx * s
          ;(n as unknown as { vy: number }).vy = vy * s
          continue
        }
      }
      ;(n as unknown as { vx: number }).vx = vx
      ;(n as unknown as { vy: number }).vy = vy
    }
  }

  runRelaxSteps({
    nodes: proxyNodes,
    steps,
    forces: [applyForce, applyAnchor],
    maxOps: 40_000,
    integrate: node => {
      integrateNodePositionWithVelocity(node, { damping: 0.25 })
      const id = String((node as unknown as { id?: unknown }).id || '')
      if (!id || id.startsWith('__obstacle__:')) return
      const fx = (node as unknown as { fx?: unknown }).fx
      const fy = (node as unknown as { fy?: unknown }).fy
      if (typeof fx === 'number' && Number.isFinite(fx)) return
      if (typeof fy === 'number' && Number.isFinite(fy)) return
      const a = anchorsById.get(id)
      if (!a) return
      const nx = typeof (node as unknown as { x?: unknown }).x === 'number' && Number.isFinite((node as unknown as { x: number }).x)
        ? (node as unknown as { x: number }).x
        : a.x
      const ny = typeof (node as unknown as { y?: unknown }).y === 'number' && Number.isFinite((node as unknown as { y: number }).y)
        ? (node as unknown as { y: number }).y
        : a.y
      const dx = nx - a.x
      const dy = ny - a.y
      if (Math.abs(dx) <= maxAnchorShiftPx && Math.abs(dy) <= maxAnchorShiftPx) return
      const cx = a.x + Math.max(-maxAnchorShiftPx, Math.min(maxAnchorShiftPx, dx))
      const cy = a.y + Math.max(-maxAnchorShiftPx, Math.min(maxAnchorShiftPx, dy))
      ;(node as unknown as { x: number }).x = cx
      ;(node as unknown as { y: number }).y = cy
    },
  })

  const tryCompactTowardsAnchors = () => {
    const rectsById = new Map<string, { w: number; h: number }>()
    for (let i = 0; i < args.items.length; i += 1) {
      const it = args.items[i]
      const id = String(it?.id || '').trim()
      if (!id) continue
      const w = Number.isFinite(it.width) ? Math.max(1, it.width) : 1
      const h = Number.isFinite(it.height) ? Math.max(1, it.height) : 1
      rectsById.set(id, { w, h })
    }

    const obstacleRects = obstacles.map(o => ({
      left: o.left,
      top: o.top,
      right: o.left + o.width,
      bottom: o.top + o.height,
    }))

    const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => {
      return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    }

    const getRect = (id: string, cx: number, cy: number) => {
      const sz = rectsById.get(id) || { w: 1, h: 1 }
      const halfW = sz.w * 0.5
      const halfH = sz.h * 0.5
      return { left: cx - halfW - gapPx, top: cy - halfH - gapPx, right: cx + halfW + gapPx, bottom: cy + halfH + gapPx }
    }

    const ordered = proxyNodes
      .filter(n => {
        const id = String(n.id || '')
        if (!id || id.startsWith('__obstacle__:')) return false
        const fx = (n as unknown as { fx?: unknown }).fx
        const fy = (n as unknown as { fy?: unknown }).fy
        if (typeof fx === 'number' && Number.isFinite(fx)) return false
        if (typeof fy === 'number' && Number.isFinite(fy)) return false
        return true
      })
      .map(n => String(n.id || ''))
      .sort((a, b) => a.localeCompare(b))

    if (ordered.length < 2) return

    const getNodeCenter = (id: string) => {
      const n = proxyNodes.find(x => String(x.id || '') === id) || null
      const sz = rectsById.get(id) || { w: 1, h: 1 }
      const fallback = { x: sz.w * 0.5, y: sz.h * 0.5 }
      const x = n && typeof n.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : fallback.x
      const y = n && typeof n.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : fallback.y
      return { x, y }
    }

    const setNodeCenter = (id: string, x: number, y: number) => {
      const n = proxyNodes.find(t => String(t.id || '') === id) || null
      if (!n) return
      ;(n as unknown as { x: number }).x = x
      ;(n as unknown as { y: number }).y = y
    }

    const wouldCollide = (id: string, cx: number, cy: number) => {
      const r = getRect(id, cx, cy)
      for (let i = 0; i < obstacleRects.length; i += 1) {
        if (overlaps(r, obstacleRects[i]!)) return true
      }
      for (let i = 0; i < ordered.length; i += 1) {
        const otherId = ordered[i]!
        if (otherId === id) continue
        const c = getNodeCenter(otherId)
        const or = getRect(otherId, c.x, c.y)
        if (overlaps(r, or)) return true
      }
      return false
    }

    for (let pass = 0; pass < 6; pass += 1) {
      for (let i = 0; i < ordered.length; i += 1) {
        const id = ordered[i]!
        const a = anchorsById.get(id)
        if (!a) continue
        const cur = getNodeCenter(id)
        const dx = a.x - cur.x
        const dy = a.y - cur.y
        const dist = Math.hypot(dx, dy)
        if (!(dist > 1)) continue

        const maxStep = Math.min(48, dist)
        let t = Math.min(0.65, maxStep / Math.max(1e-9, dist))
        const bestDist = dist
        let moved = false
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const nx = cur.x + dx * t
          const ny = cur.y + dy * t
          const clampedDx = Math.max(-maxAnchorShiftPx, Math.min(maxAnchorShiftPx, nx - a.x))
          const clampedDy = Math.max(-maxAnchorShiftPx, Math.min(maxAnchorShiftPx, ny - a.y))
          const cx = a.x + clampedDx
          const cy = a.y + clampedDy
          if (!wouldCollide(id, cx, cy)) {
            const d2 = Math.hypot(a.x - cx, a.y - cy)
            if (d2 < bestDist - 0.5) {
              setNodeCenter(id, cx, cy)
              moved = true
            }
            break
          }
          t *= 0.5
        }
        if (moved) continue
      }
    }

    for (let pass = 0; pass < 4; pass += 1) {
      let movedAny = false
      for (let i = 0; i < ordered.length; i += 1) {
        const id = ordered[i]!
        const a = anchorsById.get(id)
        const sz = rectsById.get(id)
        if (!a || !sz) continue
        const cur = getNodeCenter(id)
        const curRect = getRect(id, cur.x, cur.y)
        const obstacle = obstacleRects.find(o => overlaps(curRect, o)) || null
        if (!obstacle) continue
        const clampToAnchorShift = (candidate: { x: number; y: number }) => ({
          x: a.x + Math.max(-maxAnchorShiftPx, Math.min(maxAnchorShiftPx, candidate.x - a.x)),
          y: a.y + Math.max(-maxAnchorShiftPx, Math.min(maxAnchorShiftPx, candidate.y - a.y)),
        })
        const candidates = [
          { x: obstacle.left - sz.w * 0.5 - gapPx, y: cur.y },
          { x: obstacle.right + sz.w * 0.5 + gapPx, y: cur.y },
          { x: cur.x, y: obstacle.top - sz.h * 0.5 - gapPx },
          { x: cur.x, y: obstacle.bottom + sz.h * 0.5 + gapPx },
        ]
          .map(clampToAnchorShift)
          .filter(c => !wouldCollide(id, c.x, c.y))
          .sort((left, right) => {
            const da = Math.hypot(left.x - a.x, left.y - a.y)
            const db = Math.hypot(right.x - a.x, right.y - a.y)
            if (da !== db) return da - db
            return (left.y - right.y) || (left.x - right.x)
          })
        const best = candidates[0] || null
        if (!best) continue
        if (Math.abs(best.x - cur.x) <= 0.5 && Math.abs(best.y - cur.y) <= 0.5) continue
        setNodeCenter(id, best.x, best.y)
        movedAny = true
      }
      if (!movedAny) break
    }
  }

  tryCompactTowardsAnchors()

  const out: Array<{ id: string; left: number; top: number }> = []
  for (let i = 0; i < args.items.length; i += 1) {
    const it = args.items[i]
    const panelId = String(it?.id || '').trim()
    if (!panelId) continue
    const n = proxyNodes.find(x => String(x.id || '') === panelId) || null
    const x = n && typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : it.left + it.width * 0.5
    const y = n && typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : it.top + it.height * 0.5
    out.push({ id: panelId, left: x - it.width * 0.5, top: y - it.height * 0.5 })
  }
  return out
}
