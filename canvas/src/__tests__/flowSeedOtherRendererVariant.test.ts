import { pickPreferredLayoutSeed, pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'

export function testFlowSeedFromOtherRendererPrefersExpectedVariant() {
  const nodes = [{ id: 'a' }, { id: 'b' }]
  const baseKey = 'document:default:force:2d'
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

export function testFlowEditorPrefersSourceSeedOverOtherRendererCache() {
  const sourcePositions = {
    a: { x: 4200, y: 0 },
    b: { x: 4680, y: 0 },
  }
  const flowRendererCachedPositions = {
    a: { x: 120, y: 80 },
    b: { x: 360, y: 80 },
  }
  const picked = pickPreferredLayoutSeed({
    preferSourceSeededPositions: true,
    cachedPositions: null,
    allowCached: false,
    otherRendererPositions: flowRendererCachedPositions,
    allowOther: true,
    sourcePositions,
    allowSource: true,
  })
  if (picked !== sourcePositions) {
    throw new Error('expected Flow Editor frontmatter-document seed selection to prefer imported source positions over other-renderer cache positions')
  }
}
