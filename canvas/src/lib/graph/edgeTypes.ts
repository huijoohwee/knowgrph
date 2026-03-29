import type { GraphSchema } from '@/lib/graph/schema'

export type GlobalEdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep'

export const GLOBAL_EDGE_TYPES: GlobalEdgeType[] = ['bezier', 'straight', 'step', 'smoothstep']

export const normalizeGlobalEdgeType = (raw: unknown): GlobalEdgeType => {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'straight' || value === 'step' || value === 'smoothstep' || value === 'bezier') return value
  return 'bezier'
}

export const readGlobalEdgeType = (schema: GraphSchema | null | undefined): GlobalEdgeType =>
  normalizeGlobalEdgeType(schema?.layout?.edges && typeof schema.layout.edges === 'object' ? (schema.layout.edges as { type?: unknown }).type : '')

const resolveAxis = (rankdir: 'TB' | 'LR' | null | undefined, sx: number, sy: number, tx: number, ty: number): 'x' | 'y' => {
  if (rankdir === 'LR') return 'x'
  if (rankdir === 'TB') return 'y'
  const dx = Math.abs(tx - sx)
  const dy = Math.abs(ty - sy)
  return dx >= dy ? 'x' : 'y'
}

export const buildEdgePathD = (args: {
  edgeType: GlobalEdgeType
  sx: number
  sy: number
  tx: number
  ty: number
  rankdir?: 'TB' | 'LR' | null
}): string => {
  const sx = Number.isFinite(args.sx) ? args.sx : 0
  const sy = Number.isFinite(args.sy) ? args.sy : 0
  const tx = Number.isFinite(args.tx) ? args.tx : sx
  const ty = Number.isFinite(args.ty) ? args.ty : sy
  const type = normalizeGlobalEdgeType(args.edgeType)
  if (type === 'straight') return `M${sx},${sy} L${tx},${ty}`
  const axis = resolveAxis(args.rankdir, sx, sy, tx, ty)
  const dx = tx - sx
  const dy = ty - sy
  if (type === 'bezier') {
    const c = 0.5
    const c1x = axis === 'x' ? sx + dx * c : sx
    const c1y = axis === 'x' ? sy : sy + dy * c
    const c2x = axis === 'x' ? tx - dx * c : tx
    const c2y = axis === 'x' ? ty : ty - dy * c
    return `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`
  }
  if (type === 'step') {
    if (axis === 'x') {
      const mx = (sx + tx) * 0.5
      return `M${sx},${sy} L${mx},${sy} L${mx},${ty} L${tx},${ty}`
    }
    const my = (sy + ty) * 0.5
    return `M${sx},${sy} L${sx},${my} L${tx},${my} L${tx},${ty}`
  }
  if (axis === 'x') {
    const mx = (sx + tx) * 0.5
    const dyAbs = Math.abs(dy)
    const r = Math.min(24, Math.max(2, Math.min(Math.abs(mx - sx), dyAbs * 0.5)))
    const sySign = dy >= 0 ? 1 : -1
    const yA = sy + sySign * r
    const yB = ty - sySign * r
    return `M${sx},${sy} L${mx - r},${sy} Q${mx},${sy} ${mx},${yA} L${mx},${yB} Q${mx},${ty} ${mx + r},${ty} L${tx},${ty}`
  }
  const my = (sy + ty) * 0.5
  const dxAbs = Math.abs(dx)
  const r = Math.min(24, Math.max(2, Math.min(Math.abs(my - sy), dxAbs * 0.5)))
  const sxSign = dx >= 0 ? 1 : -1
  const xA = sx + sxSign * r
  const xB = tx - sxSign * r
  return `M${sx},${sy} L${sx},${my - r} Q${sx},${my} ${xA},${my} L${xB},${my} Q${tx},${my} ${tx},${my + r} L${tx},${ty}`
}

export const traceEdgePathOnCanvas = (args: {
  ctx: CanvasRenderingContext2D
  edgeType: GlobalEdgeType
  sx: number
  sy: number
  tx: number
  ty: number
  rankdir?: 'TB' | 'LR' | null
}) => {
  const { ctx } = args
  const sx = Number.isFinite(args.sx) ? args.sx : 0
  const sy = Number.isFinite(args.sy) ? args.sy : 0
  const tx = Number.isFinite(args.tx) ? args.tx : sx
  const ty = Number.isFinite(args.ty) ? args.ty : sy
  const type = normalizeGlobalEdgeType(args.edgeType)
  const axis = resolveAxis(args.rankdir, sx, sy, tx, ty)
  const dx = tx - sx
  const dy = ty - sy
  ctx.moveTo(sx, sy)
  if (type === 'straight') {
    ctx.lineTo(tx, ty)
    return
  }
  if (type === 'bezier') {
    const c = 0.5
    const c1x = axis === 'x' ? sx + dx * c : sx
    const c1y = axis === 'x' ? sy : sy + dy * c
    const c2x = axis === 'x' ? tx - dx * c : tx
    const c2y = axis === 'x' ? ty : ty - dy * c
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty)
    return
  }
  if (type === 'step') {
    if (axis === 'x') {
      const mx = (sx + tx) * 0.5
      ctx.lineTo(mx, sy)
      ctx.lineTo(mx, ty)
      ctx.lineTo(tx, ty)
      return
    }
    const my = (sy + ty) * 0.5
    ctx.lineTo(sx, my)
    ctx.lineTo(tx, my)
    ctx.lineTo(tx, ty)
    return
  }
  if (axis === 'x') {
    const mx = (sx + tx) * 0.5
    const dyAbs = Math.abs(dy)
    const r = Math.min(24, Math.max(2, Math.min(Math.abs(mx - sx), dyAbs * 0.5)))
    const sySign = dy >= 0 ? 1 : -1
    const yA = sy + sySign * r
    const yB = ty - sySign * r
    ctx.lineTo(mx - r, sy)
    ctx.quadraticCurveTo(mx, sy, mx, yA)
    ctx.lineTo(mx, yB)
    ctx.quadraticCurveTo(mx, ty, mx + r, ty)
    ctx.lineTo(tx, ty)
    return
  }
  const my = (sy + ty) * 0.5
  const dxAbs = Math.abs(dx)
  const r = Math.min(24, Math.max(2, Math.min(Math.abs(my - sy), dxAbs * 0.5)))
  const sxSign = dx >= 0 ? 1 : -1
  const xA = sx + sxSign * r
  const xB = tx - sxSign * r
  ctx.lineTo(sx, my - r)
  ctx.quadraticCurveTo(sx, my, xA, my)
  ctx.lineTo(xB, my)
  ctx.quadraticCurveTo(tx, my, tx, my + r)
  ctx.lineTo(tx, ty)
}
