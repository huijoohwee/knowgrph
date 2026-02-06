import { computeZoomWheelGuardDecision, createZoomWheelGuardState } from '@/lib/canvas/zoom-wheel-guard'

export async function testZoomWheelGuardBlocksBounceAtMinScale() {
  let state = createZoomWheelGuardState()
  const minK = 0.1
  const maxK = 8
  const t0 = 1_000

  {
    const res = computeZoomWheelGuardDecision({
      currentK: minK,
      minK,
      maxK,
      deltaYpx: 120,
      nowMs: t0,
      state,
    })
    state = res.nextState
    if (!res.block) throw new Error('expected clamp-out at minK to be blocked')
  }

  {
    const res = computeZoomWheelGuardDecision({
      currentK: minK,
      minK,
      maxK,
      deltaYpx: -10,
      nowMs: t0 + 80,
      state,
    })
    state = res.nextState
    if (!res.block) throw new Error('expected small reverse at minK to be blocked')
  }

  {
    const res = computeZoomWheelGuardDecision({
      currentK: minK,
      minK,
      maxK,
      deltaYpx: -80,
      nowMs: t0 + 500,
      state,
    })
    state = res.nextState
    if (res.block) throw new Error('expected deliberate zoom-in after pause to be allowed')
  }
}

