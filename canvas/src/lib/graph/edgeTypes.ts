import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphEdge } from '@/lib/graph/types'
import { readRadarForceConfig } from '@/lib/graph/radarForces'

export type GlobalEdgeType = 'bezier' | 'straight' | 'step' | 'smoothstep'
export type GlobalEdgeColorOption = 'blue' | 'lightBlue'

export const GLOBAL_EDGE_TYPES: GlobalEdgeType[] = ['bezier', 'straight', 'step', 'smoothstep']
export const DEFAULT_GLOBAL_EDGE_STROKE_WIDTH_PX = 1.5
export const DEFAULT_GLOBAL_EDGE_COLOR = 'var(--kg-canvas-accent)'
export const LIGHT_BLUE_GLOBAL_EDGE_COLOR = 'var(--kg-canvas-edge-stroke)'
const ALLOWED_GLOBAL_EDGE_COLORS = new Set<string>([DEFAULT_GLOBAL_EDGE_COLOR, LIGHT_BLUE_GLOBAL_EDGE_COLOR])

export const GLOBAL_EDGE_TYPE_OPTIONS: ReadonlyArray<{ value: GlobalEdgeType; label: string }> = [
  { value: 'bezier', label: 'Bezier (default)' },
  { value: 'straight', label: 'Straight' },
  { value: 'step', label: 'Step' },
  { value: 'smoothstep', label: 'Smoothstep' },
] as const

export const GLOBAL_EDGE_COLOR_OPTIONS: ReadonlyArray<{ value: string; key: GlobalEdgeColorOption; label: string }> = [
  { value: DEFAULT_GLOBAL_EDGE_COLOR, key: 'blue', label: 'Blue (default)' },
  { value: LIGHT_BLUE_GLOBAL_EDGE_COLOR, key: 'lightBlue', label: 'Light Blue' },
] as const

export const normalizeGlobalEdgeType = (raw: unknown): GlobalEdgeType => {
  const value = String(raw || '').trim().toLowerCase()
  if (value === 'straight' || value === 'step' || value === 'smoothstep' || value === 'bezier') return value
  return 'bezier'
}

export const readGlobalEdgeType = (schema: GraphSchema | null | undefined): GlobalEdgeType =>
  normalizeGlobalEdgeType(schema?.layout?.edges && typeof schema.layout.edges === 'object' ? (schema.layout.edges as { type?: unknown }).type : '')

export const readGlobalEdgeColor = (schema: GraphSchema | null | undefined): string => {
  const raw = schema?.layout?.edges && typeof schema.layout.edges === 'object'
    ? (schema.layout.edges as { color?: unknown }).color
    : null
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return DEFAULT_GLOBAL_EDGE_COLOR
  return ALLOWED_GLOBAL_EDGE_COLORS.has(value) ? value : DEFAULT_GLOBAL_EDGE_COLOR
}

export const withGlobalEdgeColor = (schema: GraphSchema, nextColorRaw: unknown): GraphSchema => {
  const candidate = typeof nextColorRaw === 'string' ? nextColorRaw.trim() : ''
  const nextColor = ALLOWED_GLOBAL_EDGE_COLORS.has(candidate) ? candidate : DEFAULT_GLOBAL_EDGE_COLOR
  if (readGlobalEdgeColor(schema) === nextColor) return schema
  const layout = schema.layout || {}
  const edges = layout.edges || {}
  return {
    ...schema,
    layout: {
      ...layout,
      edges: {
        ...edges,
        color: nextColor,
      },
    },
  }
}

const readPortHandleStrokeWidthFallback = (schema: GraphSchema | null | undefined): number => {
  const raw = schema?.behavior?.portHandles && typeof schema.behavior.portHandles === 'object'
    ? (schema.behavior.portHandles as { strokeWidth?: unknown }).strokeWidth
    : null
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  return DEFAULT_GLOBAL_EDGE_STROKE_WIDTH_PX
}

export const readGlobalEdgeThicknessPx = (schema: GraphSchema | null | undefined): number => {
  const raw = schema?.layout?.edges && typeof schema.layout.edges === 'object'
    ? (schema.layout.edges as { strokeWidthPx?: unknown }).strokeWidthPx
    : null
  const fallback = readPortHandleStrokeWidthFallback(schema)
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.max(0.5, Math.min(12, raw))
  return Math.max(0.5, Math.min(12, fallback))
}

export const readGlobalEdgeAnimationEnabled = (schema: GraphSchema | null | undefined): boolean => {
  const raw = schema?.layout?.edges && typeof schema.layout.edges === 'object'
    ? (schema.layout.edges as { animated?: unknown }).animated
    : null
  if (typeof raw === 'boolean') return raw
  return true
}

export const readEffectiveEdgeTypeFor2dRenderer = (args: {
  schema: GraphSchema | null | undefined
  canvas2dRenderer?: unknown
}): GlobalEdgeType => readGlobalEdgeType(args.schema)

export function getGlobalEdgeTypeOptionsFor2dRenderer(_canvas2dRenderer?: unknown): ReadonlyArray<{ value: GlobalEdgeType; label: string }> {
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

export const withGlobalEdgeThicknessPx = (schema: GraphSchema, nextStrokeWidthRaw: unknown): GraphSchema => {
  const parsed = typeof nextStrokeWidthRaw === 'number' ? nextStrokeWidthRaw : Number(nextStrokeWidthRaw)
  const nextStrokeWidthPx = Number.isFinite(parsed) ? Math.max(0.5, Math.min(12, parsed)) : readGlobalEdgeThicknessPx(schema)
  if (Math.abs(readGlobalEdgeThicknessPx(schema) - nextStrokeWidthPx) <= 1e-6) return schema
  const layout = schema.layout || {}
  const edges = layout.edges || {}
  return {
    ...schema,
    layout: {
      ...layout,
      edges: {
        ...edges,
        strokeWidthPx: nextStrokeWidthPx,
      },
    },
  }
}

export const withGlobalEdgeAnimationEnabled = (schema: GraphSchema, animated: boolean): GraphSchema => {
  const nextAnimated = animated !== false
  if (readGlobalEdgeAnimationEnabled(schema) === nextAnimated) return schema
  const layout = schema.layout || {}
  const edges = layout.edges || {}
  return {
    ...schema,
    layout: {
      ...layout,
      edges: {
        ...edges,
        animated: nextAnimated,
      },
    },
  }
}

const EDGE_ANIMATION_STYLE_ID = 'kg-edge-animation-style'

export const ensureEdgeAnimationStyleElement = (doc: Document | null | undefined): void => {
  if (!doc) return
  if (doc.getElementById(EDGE_ANIMATION_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = EDGE_ANIMATION_STYLE_ID
  style.textContent = '@keyframes kg-edge-dash-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -24; } }'
  doc.head?.appendChild(style)
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

const clampNumber = (value: number, min: number, max: number): number => {
  if (!(Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max))) return value
  if (min > max) return value
  return Math.min(max, Math.max(min, value))
}

const clampBezierControlPointsToLocalCorridor = (args: {
  sx: number
  sy: number
  tx: number
  ty: number
  axis: 'x' | 'y'
  dist: number
  c1x: number
  c1y: number
  c2x: number
  c2y: number
}) => {
  const { sx, sy, tx, ty, axis, dist } = args
  const minX = Math.min(sx, tx)
  const maxX = Math.max(sx, tx)
  const minY = Math.min(sy, ty)
  const maxY = Math.max(sy, ty)
  const crossSpan = axis === 'x' ? Math.abs(ty - sy) : Math.abs(tx - sx)
  // Keep large orbital curves readable by limiting cross-axis drift to a
  // local corridor around the source/target pair instead of allowing runaway
  // control points on tall frontmatter routes.
  const crossAxisLimit = Math.max(32, Math.min(220, crossSpan * 0.9 + dist * 0.08))
  if (axis === 'x') {
    return {
      c1x: clampNumber(args.c1x, minX, maxX),
      c1y: clampNumber(args.c1y, minY - crossAxisLimit, maxY + crossAxisLimit),
      c2x: clampNumber(args.c2x, minX, maxX),
      c2y: clampNumber(args.c2y, minY - crossAxisLimit, maxY + crossAxisLimit),
    }
  }
  return {
    c1x: clampNumber(args.c1x, minX - crossAxisLimit, maxX + crossAxisLimit),
    c1y: clampNumber(args.c1y, minY, maxY),
    c2x: clampNumber(args.c2x, minX - crossAxisLimit, maxX + crossAxisLimit),
    c2y: clampNumber(args.c2y, minY, maxY),
  }
}

const resolveBezierHandleReach = (args: {
  axis: 'x' | 'y'
  dx: number
  dy: number
  span: number
  orbitMag: number
}) => {
  const { axis, dx, dy, span, orbitMag } = args
  const crossSpan = axis === 'x' ? Math.abs(dy) : Math.abs(dx)
  const baseHandleReach = Math.max(20, Math.min(180, span * 0.5))
  const orbitalBoost = Math.abs(orbitMag) > 1e-6 ? 24 : 0
  // Keep long 16:9 frontmatter runs from reading as parallel rails: let them
  // commit toward the target earlier, but stay below the fully wide legacy
  // handle reach so local routes do not balloon again.
  const longRunTurnReach = 78 + crossSpan * 0.18 + span * 0.045 + orbitalBoost
  return Math.max(20, Math.min(baseHandleReach, 164 + orbitalBoost, longRunTurnReach))
}

const computeBezierControlPoints = (args: {
  sx: number
  sy: number
  tx: number
  ty: number
  axis: 'x' | 'y'
  bendSign: -1 | 1
  bendAbs: number
  orbitMag: number
  dist: number
}) => {
  const { sx, sy, tx, ty, axis, bendSign, bendAbs, orbitMag, dist } = args
  const dx = tx - sx
  const dy = ty - sy
  const dirX = dx < 0 ? -1 : 1
  const dirY = dy < 0 ? -1 : 1
  const span = axis === 'x' ? Math.abs(dx) : Math.abs(dy)
  // Keep the default curve shape axis-led with bounded handle reach for stable readability.
  const handleReach = resolveBezierHandleReach({ axis, dx, dy, span, orbitMag })
  let c1x = axis === 'x' ? sx + dirX * handleReach : sx
  let c1y = axis === 'y' ? sy + dirY * handleReach : sy
  let c2x = axis === 'x' ? tx - dirX * handleReach : tx
  let c2y = axis === 'y' ? ty - dirY * handleReach : ty
  const nx = -dy / dist
  const ny = dx / dist
  const bendMag = dist * bendAbs * 0.7 * bendSign
  const c1Normal = bendMag * 0.82 + orbitMag * 0.45
  const c2Normal = bendMag * 1.06 + orbitMag
  c1x += nx * c1Normal
  c1y += ny * c1Normal
  c2x += nx * c2Normal
  c2y += ny * c2Normal
  return clampBezierControlPointsToLocalCorridor({
    sx,
    sy,
    tx,
    ty,
    axis,
    dist,
    c1x,
    c1y,
    c2x,
    c2y,
  })
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
    const { c1x, c1y, c2x, c2y } = computeBezierControlPoints({
      sx,
      sy,
      tx,
      ty,
      axis,
      bendSign,
      bendAbs,
      orbitMag,
      dist,
    })
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
    const { c1x, c1y, c2x, c2y } = computeBezierControlPoints({
      sx,
      sy,
      tx,
      ty,
      axis,
      bendSign,
      bendAbs,
      orbitMag,
      dist,
    })
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
