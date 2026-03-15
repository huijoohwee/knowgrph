import { computeGroupResizeBottomRight } from '@/lib/canvas/groupResizeMath2d'

export function testGroupResizeMathSnapsWhenEnabled() {
  const next0 = computeGroupResizeBottomRight({
    startBounds: { x: 0, y: 0, w: 100, h: 100 },
    startWorld: { x: 0, y: 0 },
    world: { x: 4, y: 4 },
    minW: 24,
    minH: 24,
    snapGrid: { enabled: true, size: 10 },
    altDown: false,
  })
  if (next0.w !== 100 || next0.h !== 100) throw new Error(`expected snap down to 100, got ${next0.w}x${next0.h}`)

  const next1 = computeGroupResizeBottomRight({
    startBounds: { x: 0, y: 0, w: 100, h: 100 },
    startWorld: { x: 0, y: 0 },
    world: { x: 6, y: 6 },
    minW: 24,
    minH: 24,
    snapGrid: { enabled: true, size: 10 },
    altDown: false,
  })
  if (next1.w !== 110 || next1.h !== 110) throw new Error(`expected snap up to 110, got ${next1.w}x${next1.h}`)
}

export function testGroupResizeMathDisablesSnapOnAlt() {
  const next = computeGroupResizeBottomRight({
    startBounds: { x: 0, y: 0, w: 100, h: 100 },
    startWorld: { x: 0, y: 0 },
    world: { x: 6, y: 6 },
    minW: 24,
    minH: 24,
    snapGrid: { enabled: true, size: 10 },
    altDown: true,
  })
  if (next.w !== 106 || next.h !== 106) throw new Error(`expected raw 106 when altDown, got ${next.w}x${next.h}`)
}

