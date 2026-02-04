import { pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'

export function testFlowSeedFromOtherRendererPrefersExpectedVariant() {
  const nodes = [{ id: 'a' }, { id: 'b' }]
  const baseKey = 'document:default:force:2d:d3'
  const variantAKey = `${baseKey}:variant=a`
  const variantBKey = `${baseKey}:variant=b`
  const variantA = { a: { x: 10, y: 10 }, b: { x: 20, y: 20 } }
  const variantB = { a: { x: 100, y: 10 }, b: { x: 200, y: 20 } }
  const cache = {
    [variantAKey]: variantA,
    [variantBKey]: variantB,
  }

  const picked = pickSeedFromOtherRendererCache({
    nodes,
    cache,
    baseKey,
    expectedLayoutVariant: 'variant=b',
  })
  if (picked !== variantB) {
    throw new Error('expected flow seed to prefer expected layout variant')
  }
}
