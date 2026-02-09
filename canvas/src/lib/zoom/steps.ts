import type { GraphSchema } from '@/lib/graph/schema'

export type ZoomStepPolicy = {
  enabled: boolean
  steps: number[]
}

export const ZOOM_WHEEL_STEP_THRESHOLD_PX = 32
export const ZOOM_WHEEL_STEP_MAX_COUNT = 3

export function buildPow2ZoomSteps(args: { minK: number; maxK: number }): number[] {
  const minK = Number.isFinite(args.minK) ? Math.max(1e-6, args.minK) : 1e-6
  const maxK = Number.isFinite(args.maxK) ? Math.max(minK, args.maxK) : minK
  if (!(maxK > minK)) return [minK, maxK].filter(Number.isFinite)

  const minE = Math.floor(Math.log2(minK))
  const maxE = Math.ceil(Math.log2(maxK))
  const out: number[] = []
  for (let e = minE; e <= maxE; e += 1) {
    const k = Math.pow(2, e)
    if (k + 1e-12 < minK) continue
    if (k - 1e-12 > maxK) continue
    out.push(k)
  }
  out.push(minK)
  out.push(maxK)
  return coerceZoomSteps(out)
}

export function coerceZoomSteps(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const xs: number[] = []
  for (let i = 0; i < value.length; i += 1) {
    const n = typeof value[i] === 'number' ? value[i] : NaN
    if (!Number.isFinite(n) || n <= 0) continue
    xs.push(n)
  }
  xs.sort((a, b) => a - b)
  const out: number[] = []
  for (let i = 0; i < xs.length; i += 1) {
    const n = xs[i]
    const prev = out[out.length - 1]
    if (prev != null && Math.abs(prev - n) < 1e-12) continue
    out.push(n)
  }
  return out
}

export function readZoomStepPolicy(schema: GraphSchema): ZoomStepPolicy {
  const raw = schema.performance?.zoom?.steps
  const steps = coerceZoomSteps(raw)
  if (steps.length >= 2) return { enabled: true, steps }

  const minK = schema.performance?.zoom?.minScale
  const maxK = schema.performance?.zoom?.maxScale
  const fallback = buildPow2ZoomSteps({
    minK: typeof minK === 'number' && Number.isFinite(minK) ? minK : 0.05,
    maxK: typeof maxK === 'number' && Number.isFinite(maxK) ? maxK : 8,
  })
  return { enabled: fallback.length >= 2, steps: fallback }
}

export function pickNextZoomStep(args: {
  dir: 'in' | 'out'
  currentK: number
  steps: number[]
  minK: number
  maxK: number
}): number {
  const steps = Array.isArray(args.steps) ? args.steps : []
  const cur = Number.isFinite(args.currentK) ? args.currentK : 1
  const minK = Number.isFinite(args.minK) ? args.minK : 0.05
  const maxK = Number.isFinite(args.maxK) ? args.maxK : 8
  const clamped = Math.max(minK, Math.min(maxK, cur))

  const inRange = steps.filter(k => k >= minK && k <= maxK)
  if (inRange.length < 2) return clamped

  if (args.dir === 'in') {
    for (let i = 0; i < inRange.length; i += 1) {
      const k = inRange[i]
      if (k > clamped + 1e-12) return k
    }
    return inRange[inRange.length - 1]
  }

  for (let i = inRange.length - 1; i >= 0; i -= 1) {
    const k = inRange[i]
    if (k < clamped - 1e-12) return k
  }
  return inRange[0]
}

export function applyWheelStepAccumulator(args: {
  deltaYpx: number
  accumPx: number
  lastIntent: 'in' | 'out' | null
  thresholdPx?: number
  maxSteps?: number
}): { stepCount: number; nextAccumPx: number; nextIntent: 'in' | 'out' } {
  const intent: 'in' | 'out' = args.deltaYpx < 0 ? 'in' : 'out'
  const threshold = typeof args.thresholdPx === 'number' && Number.isFinite(args.thresholdPx)
    ? Math.max(1e-6, args.thresholdPx)
    : ZOOM_WHEEL_STEP_THRESHOLD_PX
  const maxSteps = typeof args.maxSteps === 'number' && Number.isFinite(args.maxSteps)
    ? Math.max(1, Math.floor(args.maxSteps))
    : ZOOM_WHEEL_STEP_MAX_COUNT
  let accumPx = args.lastIntent && args.lastIntent !== intent ? 0 : args.accumPx
  accumPx += args.deltaYpx
  const stepCountRaw = Math.floor(Math.abs(accumPx) / threshold)
  const stepCount = Math.max(0, Math.min(maxSteps, stepCountRaw))
  if (stepCount > 0) {
    accumPx -= Math.sign(accumPx) * threshold * stepCount
  }
  return { stepCount, nextAccumPx: accumPx, nextIntent: intent }
}

export function computeSteppedZoomTarget(args: {
  stepCount: number
  intent: 'in' | 'out'
  currentK: number
  steps: number[]
  minK: number
  maxK: number
}): number {
  let targetK = Number.isFinite(args.currentK) ? args.currentK : 1
  for (let i = 0; i < args.stepCount; i += 1) {
    targetK = pickNextZoomStep({
      dir: args.intent,
      currentK: targetK,
      steps: args.steps,
      minK: args.minK,
      maxK: args.maxK,
    })
  }
  return targetK
}
