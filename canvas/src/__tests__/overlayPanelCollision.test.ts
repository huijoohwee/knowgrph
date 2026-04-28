import { defaultSchema } from '@/lib/graph/schema'
import { relaxOverlayPanelsWithCollision } from '@/lib/ui/relaxOverlayPanelsWithCollision'

const rectsOverlap = (a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }) => {
  const ax2 = a.left + a.width
  const ay2 = a.top + a.height
  const bx2 = b.left + b.width
  const by2 = b.top + b.height
  return a.left < bx2 && b.left < ax2 && a.top < by2 && b.top < ay2
}

export function testOverlayPanelCollisionKeepsLockedPanelFixed() {
  const a = { id: 'a', top: 0, left: 0, movable: false, width: 100, height: 100 }
  const b = { id: 'b', top: 50, left: 50, movable: true, width: 120, height: 90 }
  if (!rectsOverlap({ left: a.left, top: a.top, width: a.width, height: a.height }, { left: b.left, top: b.top, width: b.width, height: b.height })) {
    throw new Error('expected initial panels to overlap')
  }
  const resolved = relaxOverlayPanelsWithCollision({
    gapPx: 0,
    schema: defaultSchema,
    items: [a, b],
    strength: 0.9,
    iterations: 12,
    steps: 14,
  })
  const ra = resolved.find(x => x.id === 'a')
  const rb = resolved.find(x => x.id === 'b')
  if (!ra || !rb) throw new Error('expected resolved positions for both panels')
  if (Math.abs(ra.top - a.top) > 1e-9 || Math.abs(ra.left - a.left) > 1e-9) throw new Error('expected locked panel to remain fixed')
  const afterOverlap = rectsOverlap(
    { left: ra.left, top: ra.top, width: a.width, height: a.height },
    { left: rb.left, top: rb.top, width: b.width, height: b.height },
  )
  if (afterOverlap) throw new Error('expected collision solver to separate overlapping panels')
}

export function testOverlayPanelCollisionUsesPerItemSizes() {
  const a = { id: 'a', top: 0, left: 0, movable: false, width: 60, height: 160 }
  const b = { id: 'b', top: 80, left: 40, movable: true, width: 200, height: 40 }
  if (!rectsOverlap({ left: a.left, top: a.top, width: a.width, height: a.height }, { left: b.left, top: b.top, width: b.width, height: b.height })) {
    throw new Error('expected initial panels to overlap')
  }
  const resolved = relaxOverlayPanelsWithCollision({
    gapPx: 0,
    schema: defaultSchema,
    items: [a, b],
    strength: 0.9,
    iterations: 12,
    steps: 14,
  })
  const ra = resolved.find(x => x.id === 'a')
  const rb = resolved.find(x => x.id === 'b')
  if (!ra || !rb) throw new Error('expected resolved positions for both panels')
  const afterOverlap = rectsOverlap(
    { left: ra.left, top: ra.top, width: a.width, height: a.height },
    { left: rb.left, top: rb.top, width: b.width, height: b.height },
  )
  if (afterOverlap) throw new Error('expected per-item size collision resolution to separate panels')
}
