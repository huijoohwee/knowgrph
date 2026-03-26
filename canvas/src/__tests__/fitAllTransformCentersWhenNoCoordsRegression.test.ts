import { fitAllTransform } from '@/components/GraphCanvas/fit'

export function testFitAllTransformCentersWhenNoNodesHaveCoords() {
  const nodes = [{ id: 'a' }, { id: 'b' }] as any
  const t = fitAllTransform(nodes, 1000, 800, 40)
  if (!t) throw new Error('expected transform')
  if (Math.abs(t.k - 1) > 1e-9) throw new Error(`expected k=1, got ${t.k}`)
  if (Math.abs(t.x - 500) > 1e-9) throw new Error(`expected x=500, got ${t.x}`)
  if (Math.abs(t.y - 400) > 1e-9) throw new Error(`expected y=400, got ${t.y}`)
}

