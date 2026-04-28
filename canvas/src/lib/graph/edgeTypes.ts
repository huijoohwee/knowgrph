import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphEdge } from '@/lib/graph/types'
import { readRadarForceConfig } from '@/lib/graph/radarForces'

export type GlobalEdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep'

export const GLOBAL_EDGE_TYPES: GlobalEdgeType[] = ['bezier', 'straight', 'step', 'smoothstep']

export const GLOBAL_EDGE_TYPE_OPTIONS: ReadonlyArray<{ value: GlobalEdgeType; label: string }> = [
  { value: 'bezier', label: 'Bezier (default)' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smoothstep' },
] as const

export const normalizeGlobalEdgeType = (raw: unknown): GlobalEdgeType => {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'straight' || value === 'step' || value === 'smoothstep' || value === 'bezier') return value
  return 'bezier'
}

export const readGlobalEdgeType = (schema: GraphSchema | null | undefined): GlobalEdgeType =>
  normalizeGlobalEdgeType(schema?.layout?.edges && typeof schema.layout.edges === 'object' ? (schema.layout.edges as { type?: unknown }).type : '')

export const readEffectiveEdgeTypeFor2dRenderer = (args: {
  schema: GraphSchema | null | undefined
  canvas2dRenderer?: unknown
}): GlobalEdgeType => {
  const renderer = String(args.canvas2dRenderer || '').trim().toLowerCase()
  if (renderer === 'd3') return 'straight'
  return readGlobalEdgeType(args.schema)
}

export function getGlobalEdgeTypeOptionsFor2dRenderer(canvas2dRenderer?: unknown): ReadonlyArray<{ value: GlobalEdgeType; label: string }> {
  const renderer = String(canvas2dRenderer || '').trim().toLowerCase()
  if (renderer === 'd3') return GLOBAL_EDGE_TYPE_OPTIONS.filter(option => option.value === 'straight')
  return GLOBAL_EDGE_TYPE_OPTIONS
}

export const withGlobalEdgeType = (schema: GraphSchema, nextEdgeTypeRaw: unknown): GraphSchema => {
  const nextEdgeType = normalizeGlobalEdgeType(nextEdgeTypeRaw)
  if (readGlobalEdgeType(schema) === nextEdgeType) return schema
  const layout = schema.layout || {}
  const edges = layout.edges || {}
  return {
    ...schema,
    layout: {
      ...layout,
      edges: {
        ...edges,
        type: nextEdgeType,
      },
    },
  }
}

export type EdgePathCurveOptions = {
  bend: number
  orbitShift: number
  orbital: boolean
  phase: -1 | 1
}

const readFiniteNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

const edgePhaseSign = (edgeId: string): -1 | 1 => {
  let hash = 0
  for (let i = 0; i < edgeId.length; i += 1) hash = ((hash << 5) - hash + edgeId.charCodeAt(i)) | 0
  return (hash & 1) === 0 ? -1 : 1
}

export const readEdgePathCurveOptions = (
  edge: GraphEdge,
  schema: GraphSchema | null | undefined,
): EdgePathCurveOptions | null => {
  const props = ((edge as unknown as { properties?: unknown }).properties || {}) as Record<string, unknown>
  const curveMode = String(props['visual:curve'] || '').trim().toLowerCase()
  const interpolator = String(props['visual:curveInterpolator'] || '').trim().toLowerCase()
  const radarFlow = props['kg:radarFlow'] === true
  const hasCurveHint = curveMode === 'quadratic' || radarFlow || typeof props['visual:curveBend'] !== 'undefined'
  if (!hasCurveHint) return null
  const radarCfg = schema ? readRadarForceConfig(schema) : null
  const bendRaw = readFiniteNumber(props['visual:curveBend'])
  const bendFallback = radarFlow && radarCfg ? radarCfg.flowCurveBend : 0.18
  const bend = Math.max(-0.8, Math.min(0.8, bendRaw != null ? bendRaw : bendFallback))
  const orbitRaw = readFiniteNumber(props['visual:orbitShift'])
  const orbitFallback = radarFlow && radarCfg ? radarCfg.flowOrbitShift : 0.06
  const orbital = radarFlow || interpolator === 'orbital'
  const orbitShift = Math.max(0, Math.min(0.45, orbitRaw != null ? orbitRaw : orbitFallback))
  const phase = (() => {
    if (Math.abs(bend) > 1e-6) return bend < 0 ? -1 : 1
    if (radarFlow) return 1
    return edgePhaseSign(String((edge as { id?: unknown }).id || ''))
  })()
  return { bend, orbitShift, orbital, phase }
}

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
  curve?: EdgePathCurveOptions | null
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
  const dist = Math.max(1, Math.hypot(dx, dy))
  const curve = args.curve || null
  const bend = curve ? Math.max(-0.8, Math.min(0.8, curve.bend)) : 0
  const bendSign = bend < 0 ? -1 : bend > 0 ? 1 : curve ? curve.phase : 1
  const bendAbs = Math.max(0, Math.min(0.8, Math.abs(bend)))
  const orbitPolarity = bendAbs > 0 ? bendSign : curve ? curve.phase : 1
  const orbitMag = curve && curve.orbital ? dist * Math.max(0, Math.min(0.45, curve.orbitShift)) * orbitPolarity : 0
  if (type === 'bezier') {
    const nx = -dy / dist
    const ny = dx / dist
    const mag = dist * bendAbs * 0.7 * bendSign
    const c1x = sx + dx * 0.26 + nx * (mag * 0.85 + orbitMag * 0.5)
    const c1y = sy + dy * 0.26 + ny * (mag * 0.85 + orbitMag * 0.5)
    const c2x = tx - dx * 0.26 + nx * (mag * 1.1 + orbitMag)
    const c2y = ty - dy * 0.26 + ny * (mag * 1.1 + orbitMag)
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
    const baseR = Math.min(24, Math.max(2, Math.min(Math.abs(mx - sx), dyAbs * 0.5)))
    const radialSoftness = curve?.orbital ? 0.88 : 1
    const r = Math.max(2, baseR * (bendAbs > 0 ? Math.max(0.4, (0.7 + bendAbs) * radialSoftness) : 1))
    const sySign = bendAbs > 0 ? bendSign : dy >= 0 ? 1 : -1
    const yA = sy + sySign * r
    const yB = ty - sySign * r
    return `M${sx},${sy} L${mx - r},${sy} Q${mx},${sy} ${mx},${yA} L${mx},${yB} Q${mx},${ty} ${mx + r},${ty} L${tx},${ty}`
  }
  const my = (sy + ty) * 0.5
  const dxAbs = Math.abs(dx)
  const baseR = Math.min(24, Math.max(2, Math.min(Math.abs(my - sy), dxAbs * 0.5)))
  const radialSoftness = curve?.orbital ? 0.88 : 1
  const r = Math.max(2, baseR * (bendAbs > 0 ? Math.max(0.4, (0.7 + bendAbs) * radialSoftness) : 1))
  const sxSign = bendAbs > 0 ? bendSign : dx >= 0 ? 1 : -1
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
  curve?: EdgePathCurveOptions | null
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
  const dist = Math.max(1, Math.hypot(dx, dy))
  const curve = args.curve || null
  const bend = curve ? Math.max(-0.8, Math.min(0.8, curve.bend)) : 0
  const bendSign = bend < 0 ? -1 : bend > 0 ? 1 : curve ? curve.phase : 1
  const bendAbs = Math.max(0, Math.min(0.8, Math.abs(bend)))
  const orbitPolarity = bendAbs > 0 ? bendSign : curve ? curve.phase : 1
  const orbitMag = curve && curve.orbital ? dist * Math.max(0, Math.min(0.45, curve.orbitShift)) * orbitPolarity : 0
  ctx.moveTo(sx, sy)
  if (type === 'straight') {
    ctx.lineTo(tx, ty)
    return
  }
  if (type === 'bezier') {
    const nx = -dy / dist
    const ny = dx / dist
    const mag = dist * bendAbs * 0.7 * bendSign
    const c1x = sx + dx * 0.26 + nx * (mag * 0.85 + orbitMag * 0.5)
    const c1y = sy + dy * 0.26 + ny * (mag * 0.85 + orbitMag * 0.5)
    const c2x = tx - dx * 0.26 + nx * (mag * 1.1 + orbitMag)
    const c2y = ty - dy * 0.26 + ny * (mag * 1.1 + orbitMag)
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
    const baseR = Math.min(24, Math.max(2, Math.min(Math.abs(mx - sx), dyAbs * 0.5)))
    const radialSoftness = curve?.orbital ? 0.88 : 1
    const r = Math.max(2, baseR * (bendAbs > 0 ? Math.max(0.4, (0.7 + bendAbs) * radialSoftness) : 1))
    const sySign = bendAbs > 0 ? bendSign : dy >= 0 ? 1 : -1
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
  const baseR = Math.min(24, Math.max(2, Math.min(Math.abs(my - sy), dxAbs * 0.5)))
  const radialSoftness = curve?.orbital ? 0.88 : 1
  const r = Math.max(2, baseR * (bendAbs > 0 ? Math.max(0.4, (0.7 + bendAbs) * radialSoftness) : 1))
  const sxSign = bendAbs > 0 ? bendSign : dx >= 0 ? 1 : -1
  const xA = sx + sxSign * r
  const xB = tx - sxSign * r
  ctx.lineTo(sx, my - r)
  ctx.quadraticCurveTo(sx, my, xA, my)
  ctx.lineTo(xB, my)
  ctx.quadraticCurveTo(tx, my, tx, my + r)
  ctx.lineTo(tx, ty)
}
