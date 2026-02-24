import { computeCenteredTransformToWorldPoint } from '@/lib/canvas/centerTransform'
import { computeEvenlyDistributedPositions } from '@/lib/canvas/evenDistribute'

export function testCenterTransformCentersWorldPoint() {
  const t = computeCenteredTransformToWorldPoint({
    transform: { k: 2, x: 10, y: 20 },
    viewportW: 800,
    viewportH: 600,
    worldX: 100,
    worldY: -50,
  })
  const screenX = t.k * 100 + t.x
  const screenY = t.k * (-50) + t.y
  if (Math.abs(screenX - 400) > 1e-6) throw new Error('expected centered transform to place worldX at viewport center')
  if (Math.abs(screenY - 300) > 1e-6) throw new Error('expected centered transform to place worldY at viewport center')
}

export function testEvenDistributeUsesStableOrderingAndMinSpacing() {
  const out = computeEvenlyDistributedPositions({
    axis: 'x',
    minSpacing: 120,
    nodes: [
      { id: 'a', x: 0, y: 10 },
      { id: 'b', x: 1, y: 20 },
      { id: 'c', x: 2, y: 30 },
    ],
  })
  const ax = out.a?.x
  const bx = out.b?.x
  const cx = out.c?.x
  if (typeof ax !== 'number' || typeof bx !== 'number' || typeof cx !== 'number') throw new Error('expected positions for all nodes')
  if (!(ax < bx && bx < cx)) throw new Error('expected x ordering to be preserved')
  const d1 = bx - ax
  const d2 = cx - bx
  if (Math.abs(d1 - d2) > 1e-6) throw new Error('expected even spacing')
  if (d1 < 119.999) throw new Error('expected min spacing to be enforced')
  if (out.a.y !== 10 || out.b.y !== 20 || out.c.y !== 30) throw new Error('expected y coordinates to be preserved')
}

