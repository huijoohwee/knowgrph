import { computeArrangeCenters } from '@/lib/canvas/arrange2d'

export function testArrange2dDistributeReturnsCenters() {
  const next = computeArrangeCenters({
    action: 'distribute-x',
    items: [
      { id: 'a', cx: 0, cy: 0, w: 10, h: 10 },
      { id: 'b', cx: 5, cy: 0, w: 10, h: 10 },
      { id: 'c', cx: 100, cy: 0, w: 10, h: 10 },
    ],
    minSpacing: 0,
  })
  const a = next.a
  const b = next.b
  const c = next.c
  if (!a || !b || !c) throw new Error('expected centers for all ids')
  if (!Number.isFinite(a.cx) || !Number.isFinite(a.cy)) throw new Error('expected finite center for a')
  if (!Number.isFinite(b.cx) || !Number.isFinite(b.cy)) throw new Error('expected finite center for b')
  if (!Number.isFinite(c.cx) || !Number.isFinite(c.cy)) throw new Error('expected finite center for c')
}

