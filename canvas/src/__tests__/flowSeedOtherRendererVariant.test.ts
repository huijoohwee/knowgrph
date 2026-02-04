import { pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'

export function testFlowSeedFromOtherRendererPrefersMatchingStratifyVariant() {
  const nodes = [{ id: 'a' }, { id: 'b' }]
  const baseKey = 'document:default:stratify:2d:d3'
  const verticalKey = `${baseKey}:o=vertical|gr=1|g=1|al=1`
  const horizontalKey = `${baseKey}:o=horizontal|gr=1|g=1|al=1`
  const vertical = { a: { x: 10, y: 10 }, b: { x: 20, y: 20 } }
  const horizontal = { a: { x: 100, y: 10 }, b: { x: 200, y: 20 } }
  const cache = {
    [verticalKey]: vertical,
    [horizontalKey]: horizontal,
  }

  const picked = pickSeedFromOtherRendererCache({
    nodes,
    cache,
    baseKey,
    expectedLayoutVariant: 'o=horizontal',
  })
  if (picked !== horizontal) {
    throw new Error('expected flow seed to prefer matching stratify orientation')
  }
}

