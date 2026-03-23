import type { GraphSchema } from '@/lib/graph/schema'
import {
  DEFAULT_DRAG_CHARGE_MAG_MAX,
  DEFAULT_DRAG_CHARGE_MAG_MIN,
  DEFAULT_DRAG_CHARGE_SCALE,
  DEFAULT_DRAG_DISTANCE_MAX,
} from '@/lib/graph/layoutDefaults'

export type Physics2dTuning = {
  chargeScale: number
  collideStrengthScale: number
  bboxStrengthScale: number
  velocityDecayBias: number
  maxSpeedScale: number
  strictOverlapScale: number
  labelNudgeScale: number
  dragChargeScale: number
  dragDistanceMaxPx: number
}

export const DEFAULT_PHYSICS2D_TUNING: Physics2dTuning = {
  chargeScale: 1,
  collideStrengthScale: 1,
  bboxStrengthScale: 1,
  velocityDecayBias: 0,
  maxSpeedScale: 1,
  strictOverlapScale: 1,
  labelNudgeScale: 1,
  dragChargeScale: DEFAULT_DRAG_CHARGE_SCALE,
  dragDistanceMaxPx: DEFAULT_DRAG_DISTANCE_MAX,
}

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v)

export const readPhysics2dTuning = (schema: GraphSchema | null | undefined): Physics2dTuning => {
  const f = schema?.layout?.forces
  const readNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  const chargeScale = clamp(readNum((f as { physics2dChargeScale?: unknown })?.physics2dChargeScale) ?? DEFAULT_PHYSICS2D_TUNING.chargeScale, 0.1, 2)
  const collideStrengthScale = clamp(
    readNum((f as { physics2dCollideStrengthScale?: unknown })?.physics2dCollideStrengthScale) ?? DEFAULT_PHYSICS2D_TUNING.collideStrengthScale,
    0.1,
    2,
  )
  const bboxStrengthScale = clamp(
    readNum((f as { physics2dBboxStrengthScale?: unknown })?.physics2dBboxStrengthScale) ?? DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale,
    0.1,
    2,
  )
  const velocityDecayBias = clamp(
    readNum((f as { physics2dVelocityDecayBias?: unknown })?.physics2dVelocityDecayBias) ?? DEFAULT_PHYSICS2D_TUNING.velocityDecayBias,
    -0.25,
    0.25,
  )
  const maxSpeedScale = clamp(
    readNum((f as { physics2dMaxSpeedScale?: unknown })?.physics2dMaxSpeedScale) ?? DEFAULT_PHYSICS2D_TUNING.maxSpeedScale,
    0.3,
    3,
  )
  const strictOverlapScale = clamp(
    readNum((f as { physics2dStrictOverlapScale?: unknown })?.physics2dStrictOverlapScale) ?? DEFAULT_PHYSICS2D_TUNING.strictOverlapScale,
    0.3,
    3,
  )
  const labelNudgeScale = clamp(
    readNum((f as { physics2dLabelNudgeScale?: unknown })?.physics2dLabelNudgeScale) ?? DEFAULT_PHYSICS2D_TUNING.labelNudgeScale,
    0.2,
    3,
  )
  const dragChargeScale = clamp(
    readNum((f as { physics2dDragChargeScale?: unknown })?.physics2dDragChargeScale) ?? DEFAULT_PHYSICS2D_TUNING.dragChargeScale,
    0.1,
    1,
  )
  const dragDistanceMaxPx = clamp(
    readNum((f as { physics2dDragDistanceMaxPx?: unknown })?.physics2dDragDistanceMaxPx) ?? DEFAULT_PHYSICS2D_TUNING.dragDistanceMaxPx,
    120,
    6000,
  )
  return {
    chargeScale,
    collideStrengthScale,
    bboxStrengthScale,
    velocityDecayBias,
    maxSpeedScale,
    strictOverlapScale,
    labelNudgeScale,
    dragChargeScale,
    dragDistanceMaxPx,
  }
}

export const computeIdealSpacing2d = (args: { width: number; height: number; nodeCount: number }): number => {
  const w = typeof args.width === 'number' && Number.isFinite(args.width) ? args.width : 0
  const h = typeof args.height === 'number' && Number.isFinite(args.height) ? args.height : 0
  const n = Math.max(1, Math.floor(args.nodeCount || 0))
  const frameW = w > 100 ? w : 1
  const frameH = h > 100 ? h : 1
  const frameArea = frameW * frameH
  return Math.max(48, Math.min(240, Math.sqrt(frameArea / n) * 1.45))
}

export const computeChargeStrength2d = (args: {
  schema: GraphSchema
  isKeywordGraph: boolean
  disjointEnabled: boolean
  idealSpacing: number
  nodeCount: number
  edgeCount: number
  tuning?: Physics2dTuning
}): number => {
  const raw = args.schema.layout?.forces?.charge
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw

  const tuning = args.tuning || readPhysics2dTuning(args.schema)

  if (args.disjointEnabled) return -30

  const density = args.edgeCount / Math.max(1, args.nodeCount)
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120

  if (args.isKeywordGraph) {
    const mag = Math.max(120, Math.min(520, spacing * (density < 0.35 ? 1.6 : 2.2)))
    return -mag * tuning.chargeScale
  }

  const mag = Math.max(60, Math.min(420, spacing * (density < 0.35 ? 1.15 : 1.55)))
  return -mag * tuning.chargeScale
}

export const computeChargeDistanceMin2d = (idealSpacing: number): number => {
  const spacing = typeof idealSpacing === 'number' && Number.isFinite(idealSpacing) ? idealSpacing : 120
  return Math.max(2, Math.min(48, spacing * 0.22))
}

export const computeCollideRadiusMax2d = (idealSpacing: number): number => {
  const spacing = typeof idealSpacing === 'number' && Number.isFinite(idealSpacing) ? idealSpacing : 120
  return Math.max(28, Math.min(260, spacing * 1.15))
}

export const clampCollideRadius2d = (r: number, radiusMax: number): number => {
  const rr = typeof r === 'number' && Number.isFinite(r) ? r : 0
  const max = typeof radiusMax === 'number' && Number.isFinite(radiusMax) && radiusMax > 0 ? radiusMax : 220
  return Math.max(1, Math.min(rr, max))
}

export const computeCollideStrength2d = (args: { isKeywordGraph: boolean; nodeCount: number; idealSpacing: number; tuning?: Physics2dTuning }): number => {
  const n = Math.max(0, Math.floor(args.nodeCount))
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120
  const sizeFactor = n <= 220 ? 0.78 : n <= 650 ? 0.64 : n <= 1600 ? 0.52 : 0.44
  const spacingFactor = spacing <= 90 ? 0.9 : spacing >= 180 ? 1.06 : 1
  const keywordFactor = args.isKeywordGraph ? 0.86 : 1
  const base = Math.max(0.25, Math.min(0.88, sizeFactor * spacingFactor * keywordFactor))
  const scale = args.tuning ? args.tuning.collideStrengthScale : DEFAULT_PHYSICS2D_TUNING.collideStrengthScale
  return clamp(base * scale, 0.05, 1)
}

export const computeVelocityDecay2d = (args: { nodeCount: number; idealSpacing: number; isKeywordGraph: boolean; tuning?: Physics2dTuning }): number => {
  const n = Math.max(0, Math.floor(args.nodeCount))
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120
  const sizeFactor = n <= 180 ? 0.46 : n <= 520 ? 0.5 : n <= 1400 ? 0.54 : 0.58
  const spacingFactor = spacing <= 90 ? 0.52 : spacing >= 180 ? 0.48 : 0.5
  const keywordFactor = args.isKeywordGraph ? -0.02 : 0
  const base = Math.max(0.35, Math.min(0.72, sizeFactor + (spacingFactor - 0.5) + keywordFactor))
  const bias = args.tuning ? args.tuning.velocityDecayBias : DEFAULT_PHYSICS2D_TUNING.velocityDecayBias
  return clamp(base + bias, 0.2, 0.9)
}

export const computeMaxSpeed2d = (args: { idealSpacing: number; alpha: number; tuning?: Physics2dTuning }): number => {
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120
  const alpha = typeof args.alpha === 'number' && Number.isFinite(args.alpha) ? args.alpha : 0
  const base = clamp(spacing * 0.33, 6, 22)
  const alphaScale = clamp(0.65 + alpha * 0.55, 0.65, 1.15)
  const baseSpeed = base * alphaScale
  const scale = args.tuning ? args.tuning.maxSpeedScale : DEFAULT_PHYSICS2D_TUNING.maxSpeedScale
  return clamp(baseSpeed * scale, 1, 240)
}

export const computeDragChargeStrength2d = (baseChargeStrength: number, tuning?: Physics2dTuning): number => {
  const base = typeof baseChargeStrength === 'number' && Number.isFinite(baseChargeStrength) ? baseChargeStrength : 0
  if (base === 0) return 0
  const sign = base < 0 ? -1 : 1
  const mag = Math.abs(base)
  const scale = tuning ? tuning.dragChargeScale : DEFAULT_PHYSICS2D_TUNING.dragChargeScale
  const tunedMag = clamp(mag * scale, DEFAULT_DRAG_CHARGE_MAG_MIN, DEFAULT_DRAG_CHARGE_MAG_MAX)
  return sign * tunedMag
}

export const computeDragDistanceMax2d = (savedDistanceMax: number | undefined, tuning?: Physics2dTuning): number => {
  const base = typeof savedDistanceMax === 'number' && Number.isFinite(savedDistanceMax) && savedDistanceMax > 0 ? savedDistanceMax : Number.POSITIVE_INFINITY
  const cap = tuning ? tuning.dragDistanceMaxPx : DEFAULT_PHYSICS2D_TUNING.dragDistanceMaxPx
  const tuned = base < cap ? base : cap
  return tuned
}

export const computeBboxCollideStrength2d = (args: {
  baseStrength: number
  nodeCount: number
  idealSpacing: number
  isKeywordGraph: boolean
  tuning?: Physics2dTuning
}): number => {
  const base = typeof args.baseStrength === 'number' && Number.isFinite(args.baseStrength) ? Math.max(0, args.baseStrength) : 0
  if (base <= 0) return 0

  const n = Math.max(0, Math.floor(args.nodeCount))
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120
  const nFactor = n <= 220 ? 0.85 : n <= 800 ? 0.75 : n <= 2000 ? 0.62 : 0.55
  const spacingFactor = spacing <= 90 ? 0.9 : spacing >= 180 ? 1.0 : 0.95
  const keywordFactor = args.isKeywordGraph ? 0.9 : 1
  const tuning = args.tuning
  const scale = tuning ? tuning.bboxStrengthScale : DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale
  return Math.max(0, Math.min(0.85, base * nFactor * spacingFactor * keywordFactor * scale))
}

export const computeBboxCollideIterations2d = (args: { baseIterations: number; nodeCount: number }): number => {
  const base = typeof args.baseIterations === 'number' && Number.isFinite(args.baseIterations) ? Math.max(1, Math.floor(args.baseIterations)) : 1
  const n = Math.max(0, Math.floor(args.nodeCount))
  if (n <= 450) return base
  if (n <= 1600) return Math.max(1, Math.min(base, 3))
  return Math.max(1, Math.min(base, 2))
}

export const computeGroupBboxCollideStrength2d = (args: {
  baseStrength: number
  nodeCount: number
  idealSpacing: number
  isKeywordGraph: boolean
  tuning?: Physics2dTuning
}): number => {
  const base = typeof args.baseStrength === 'number' && Number.isFinite(args.baseStrength) ? Math.max(0, args.baseStrength) : 0
  if (base <= 0) return 0

  const n = Math.max(0, Math.floor(args.nodeCount))
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120
  const nFactor = n <= 220 ? 0.75 : n <= 800 ? 0.68 : n <= 2000 ? 0.58 : 0.52
  const spacingFactor = spacing <= 90 ? 0.9 : spacing >= 180 ? 1.0 : 0.95
  const keywordFactor = args.isKeywordGraph ? 0.9 : 1
  const tuning = args.tuning
  const scale = tuning ? tuning.bboxStrengthScale : DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale
  return Math.max(0, Math.min(0.7, base * nFactor * spacingFactor * keywordFactor * scale))
}

export const computeGroupBboxCollideIterations2d = (args: { baseIterations: number; nodeCount: number }): number => {
  const base = typeof args.baseIterations === 'number' && Number.isFinite(args.baseIterations) ? Math.max(1, Math.floor(args.baseIterations)) : 1
  const n = Math.max(0, Math.floor(args.nodeCount))
  if (n <= 450) return base
  if (n <= 1600) return Math.max(1, Math.min(base, 3))
  return Math.max(1, Math.min(base, 2))
}

export type StrictOverlapTuning2d = {
  steps: number
  minIntervalTicks: number
  alphaMax: number
  forceAlphaForStep: (step: number) => number
  nodeBboxStrengthScale: number
  groupBboxStrengthScale: number
  pullToBaseStrength: number
  integrateDamping: number
  maxShiftPx: number
}

export const computeStrictOverlapTuning2d = (args: {
  nodeCount: number
  tick: number
  lastStrictOverlapTick: number
  alpha: number
  maxPaddingPx: number
  idealSpacing: number
  tuning?: Physics2dTuning
}): StrictOverlapTuning2d => {
  const n = Math.max(0, Math.floor(args.nodeCount))
  const tick = Math.max(0, Math.floor(args.tick))
  const lastTick = Math.max(-1, Math.floor(args.lastStrictOverlapTick))
  const alpha = typeof args.alpha === 'number' && Number.isFinite(args.alpha) ? args.alpha : 0
  const maxPad = typeof args.maxPaddingPx === 'number' && Number.isFinite(args.maxPaddingPx) ? Math.max(0, args.maxPaddingPx) : 0
  const spacing = typeof args.idealSpacing === 'number' && Number.isFinite(args.idealSpacing) ? args.idealSpacing : 120

  const steps = (() => {
    if (n < 2) return 0
    if (n > 3200) return 0
    if (tick < 8) return 0
    if (alpha > 0.085) return 0
    const minInterval = alpha > 0.06 ? 72 : alpha > 0.035 ? 120 : 168
    if (tick - lastTick < minInterval) return 0
    if (n <= 120) return 2
    if (n <= 520) return 1
    return 1
  })()

  const scale = args.tuning ? args.tuning.strictOverlapScale : DEFAULT_PHYSICS2D_TUNING.strictOverlapScale
  const bboxScale = args.tuning ? args.tuning.bboxStrengthScale : DEFAULT_PHYSICS2D_TUNING.bboxStrengthScale
  const maxShiftBase = Math.max(18, Math.min(Math.min(90, spacing * 0.55), 18 + maxPad * 0.62))
  const maxShiftPx = clamp(maxShiftBase * scale, 12, 160)

  return {
    steps,
    minIntervalTicks: alpha > 0.06 ? 72 : alpha > 0.035 ? 120 : 168,
    alphaMax: 0.085,
    forceAlphaForStep: (step: number) => {
      const s = Math.max(0, Math.floor(step))
      return Math.max(0.05, 0.28 - s * 0.06)
    },
    nodeBboxStrengthScale: clamp(0.62 * scale * bboxScale, 0.08, 3),
    groupBboxStrengthScale: clamp(0.55 * scale * bboxScale, 0.08, 3),
    pullToBaseStrength: 0.035,
    integrateDamping: 0.68,
    maxShiftPx,
  }
}

export type GroupLabelRelaxTuning2d = {
  steps: number
  pushGain: number
  pullGain: number
  integrateDamping: number
}

export const computeGroupLabelRelaxTuning2d = (args: { nodeCount: number; labelMode: 'compact' | 'wrap'; tuning?: Physics2dTuning }): GroupLabelRelaxTuning2d => {
  const n = Math.max(0, Math.floor(args.nodeCount))
  const baseSteps = n <= 800 ? 10 : 8
  const modeFactor = args.labelMode === 'compact' ? 0.9 : 1
  const nudgeScale = args.tuning ? args.tuning.labelNudgeScale : DEFAULT_PHYSICS2D_TUNING.labelNudgeScale
  return {
    steps: baseSteps,
    pushGain: clamp(0.32 * modeFactor * nudgeScale, 0.05, 1.25),
    pullGain: 0.01,
    integrateDamping: 0.62,
  }
}
