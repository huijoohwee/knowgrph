import { computeGraphBounds } from '@/features/minimap/math'

export function testMinimapBoundsIgnoresMissingNodeCoords() {
  const b = computeGraphBounds([{ x: undefined, y: undefined }, { x: 10, y: 20 }] as any, 0)
  if (b.minX !== 10 || b.maxX !== 10) throw new Error(`expected x bounds at 10, got ${b.minX}..${b.maxX}`)
  if (b.minY !== 20 || b.maxY !== 20) throw new Error(`expected y bounds at 20, got ${b.minY}..${b.maxY}`)
}

