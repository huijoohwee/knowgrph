export type WheelZoomIntent = 'in' | 'out'

export type ZoomWheelGuardState = {
  lastClampedOutAtMinTs: number | null
}

export function createZoomWheelGuardState(): ZoomWheelGuardState {
  return { lastClampedOutAtMinTs: null }
}

export function computeZoomWheelIntent(deltaYpx: number): WheelZoomIntent {
  return deltaYpx < 0 ? 'in' : 'out'
}

export function computeZoomWheelGuardDecision(args: {
  currentK: number
  minK: number
  maxK: number
  deltaYpx: number
  nowMs: number
  state: ZoomWheelGuardState
}): { block: boolean; nextState: ZoomWheelGuardState } {
  const currentK = Number.isFinite(args.currentK) ? args.currentK : 1
  const minK = Number.isFinite(args.minK) ? args.minK : 0.05
  const maxK = Number.isFinite(args.maxK) ? args.maxK : 8
  const nowMs = Number.isFinite(args.nowMs) ? args.nowMs : 0
  const deltaYpx = Number.isFinite(args.deltaYpx) ? args.deltaYpx : 0

  const eps = 1e-6
  const atMin = currentK <= minK + eps
  const atMax = currentK >= maxK - eps
  const intent = computeZoomWheelIntent(deltaYpx)

  const next: ZoomWheelGuardState = {
    lastClampedOutAtMinTs: atMin ? args.state.lastClampedOutAtMinTs : null,
  }

  if ((atMin && intent === 'out') || (atMax && intent === 'in')) {
    if (atMin) next.lastClampedOutAtMinTs = nowMs
    return { block: true, nextState: next }
  }

  if (atMin && intent === 'in') {
    const lastClampTs = next.lastClampedOutAtMinTs
    const ageMs = lastClampTs == null ? Infinity : nowMs - lastClampTs
    const smallReverse = Math.abs(deltaYpx) < 40
    if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs < 220 && smallReverse) {
      return { block: true, nextState: next }
    }
  }

  return { block: false, nextState: next }
}

