import { coerceWheelFallback, resolveWheelAnchor } from '@/lib/canvas/wheel-anchor'

export function testWheelAnchorFallsBackWhenClientCoordsOutsideRect() {
  const rect = { left: 100, top: 50, width: 400, height: 300 }
  const res = resolveWheelAnchor({ rect, clientX: 0, clientY: 0, fallback: { sx: 123, sy: 234 } })
  if (res.source !== 'fallback') {
    throw new Error(`expected fallback anchor, got ${res.source}`)
  }
  if (res.sx !== 123 || res.sy !== 234) {
    throw new Error(`expected fallback coords 123,234; got ${res.sx},${res.sy}`)
  }
}

export function testWheelAnchorClampsNearEdgeToPreventJump() {
  const rect = { left: 100, top: 50, width: 400, height: 300 }
  const res = resolveWheelAnchor({ rect, clientX: 95, clientY: 60, fallback: { sx: 200, sy: 200 } })
  if (res.source !== 'event') {
    throw new Error(`expected event anchor, got ${res.source}`)
  }
  if (res.sx !== 0 || res.sy !== 10) {
    throw new Error(`expected clamped coords 0,10; got ${res.sx},${res.sy}`)
  }
}

export function testWheelAnchorUsesCenterWhenNoFallback() {
  const rect = { left: 10, top: 10, width: 200, height: 100 }
  const res = resolveWheelAnchor({ rect, clientX: -999, clientY: -999, fallback: null })
  if (res.source !== 'center') {
    throw new Error(`expected center anchor, got ${res.source}`)
  }
  if (res.sx !== 100 || res.sy !== 50) {
    throw new Error(`expected center coords 100,50; got ${res.sx},${res.sy}`)
  }
}

export function testWheelFallbackRejectsStalePoint() {
  const now = 1_000
  const fb = coerceWheelFallback({ fallback: { sx: 1, sy: 2, ts: 0 }, nowMs: now, maxAgeMs: 200 })
  if (fb !== null) {
    throw new Error('expected stale fallback to be rejected')
  }
}

export function testWheelFallbackAcceptsFreshPoint() {
  const now = 1_000
  const fb = coerceWheelFallback({ fallback: { sx: 3, sy: 4, ts: 950 }, nowMs: now, maxAgeMs: 200 })
  if (!fb || fb.sx !== 3 || fb.sy !== 4) {
    throw new Error('expected fresh fallback to be accepted')
  }
}
