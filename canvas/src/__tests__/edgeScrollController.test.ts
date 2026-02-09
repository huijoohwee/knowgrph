import { createEdgeScrollController } from '@/lib/canvas/edge-scroll'

export function testEdgeScrollDoesNotMoveBeforeDelay() {
  const c = createEdgeScrollController({ delayMs: 200, easeDurationMs: 0, speedPxPerSec: 1000, distancePx: 10 })
  const base = {
    pointer: { sx: 99, sy: 50, kind: 'mouse' as const },
    viewport: { w: 100, h: 100 },
    zoomK: 1,
    enabled: true,
  }
  c.update({ ...base, nowMs: 0 })
  const d1 = c.update({ ...base, nowMs: 150 })
  if (Math.abs(d1.dx) > 1e-9 || Math.abs(d1.dy) > 1e-9) throw new Error('expected no scroll before delay')
}

export function testEdgeScrollMovesAfterDelayTowardInterior() {
  const c = createEdgeScrollController({ delayMs: 100, easeDurationMs: 0, speedPxPerSec: 1000, distancePx: 10 })
  const base = {
    pointer: { sx: 99, sy: 50, kind: 'mouse' as const },
    viewport: { w: 100, h: 100 },
    zoomK: 1,
    enabled: true,
  }
  c.update({ ...base, nowMs: 0 })
  c.update({ ...base, nowMs: 120 })
  const d2 = c.update({ ...base, nowMs: 130 })
  if (!(d2.dx < 0)) throw new Error(`expected dx negative near right edge, got ${d2.dx}`)
}

export function testEdgeScrollRespectsZoomK() {
  const c1 = createEdgeScrollController({ delayMs: 0, easeDurationMs: 0, speedPxPerSec: 1000, distancePx: 10 })
  const c2 = createEdgeScrollController({ delayMs: 0, easeDurationMs: 0, speedPxPerSec: 1000, distancePx: 10 })
  const base = {
    pointer: { sx: 99, sy: 50, kind: 'mouse' as const },
    viewport: { w: 100, h: 100 },
    enabled: true,
  }
  c1.update({ ...base, zoomK: 1, nowMs: 0 })
  c2.update({ ...base, zoomK: 2, nowMs: 0 })
  const d1 = c1.update({ ...base, zoomK: 1, nowMs: 10 })
  const d2 = c2.update({ ...base, zoomK: 2, nowMs: 10 })
  if (!(Math.abs(d2.dx) < Math.abs(d1.dx))) {
    throw new Error(`expected zoomK=2 to reduce screen delta, got |d1|=${Math.abs(d1.dx)} |d2|=${Math.abs(d2.dx)}`)
  }
}

