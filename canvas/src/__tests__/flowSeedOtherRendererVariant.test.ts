import { pickPreferredLayoutSeed, pickSeedFromOtherRendererCache } from '@/components/FlowCanvas/seed'
import { buildLayoutPositionCacheKey } from '@/lib/canvas/layoutPositioning'

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

export function testStoryboardPrefersSourceSeedOverOtherRendererCache() {
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
    throw new Error('expected Storyboard frontmatter-document seed selection to prefer imported source positions over other-renderer cache positions')
  }
}

export function testFlowSeedIsolatesStoryboardFromFlowCanvasLayoutCache() {
  const nodes = [{ id: 'a' }, { id: 'b' }]
  const baseArgs = {
    datasetKey: 'graphId:flow-seed-isolation',
    mode: 'block',
    frontmatterMode: true,
    semanticMode: 'document',
    renderMode: '2d' as const,
    viewKey: 'same-semantic-view',
  }
  const baseKey = buildLayoutPositionCacheKey(baseArgs)
  const flowKey = buildLayoutPositionCacheKey({ ...baseArgs, renderVariant: 'flow' })
  const storyboardKey = buildLayoutPositionCacheKey({ ...baseArgs, renderVariant: 'storyboard' })
  const flowPositions = {
    a: { x: 10, y: 10 },
    b: { x: 180, y: 10 },
  }
  const storyboardPositions = {
    a: { x: 1000, y: 1000 },
    b: { x: 1240, y: 1000 },
  }

  const pickedForStoryboard = pickSeedFromOtherRendererCache({
    nodes,
    cache: { [flowKey]: flowPositions },
    baseKey,
    targetRenderer: 'storyboard',
  })
  if (pickedForStoryboard) {
    throw new Error('expected Storyboard layout seed to reject Flow Canvas cache')
  }

  const pickedForFlowCanvas = pickSeedFromOtherRendererCache({
    nodes,
    cache: { [storyboardKey]: storyboardPositions },
    baseKey,
    targetRenderer: 'flow',
  })
  if (pickedForFlowCanvas) {
    throw new Error('expected Flow Canvas layout seed to reject Storyboard cache')
  }

  const pickedSameRenderer = pickSeedFromOtherRendererCache({
    nodes,
    cache: { [storyboardKey]: storyboardPositions },
    baseKey,
    targetRenderer: 'storyboard',
  })
  if (pickedSameRenderer !== storyboardPositions) {
    throw new Error('expected Storyboard layout seed to keep same-renderer cache available')
  }
}

export function testFlowSeedRejectsUnscopedLayoutCacheWhenTargetRendererIsKnown() {
  const nodes = [{ id: 'a' }, { id: 'b' }]
  const baseKey = buildLayoutPositionCacheKey({
    datasetKey: 'graphId:flow-seed-unscoped',
    mode: 'block',
    frontmatterMode: true,
    semanticMode: 'document',
    renderMode: '2d',
    viewKey: 'same-semantic-view',
  })
  const unscopedPositions = {
    a: { x: 20, y: 20 },
    b: { x: 220, y: 20 },
  }

  const pickedWithTarget = pickSeedFromOtherRendererCache({
    nodes,
    cache: { [baseKey]: unscopedPositions },
    baseKey,
    allowVariantFallback: false,
    targetRenderer: 'storyboard',
  })
  if (pickedWithTarget) {
    throw new Error('expected known Storyboard target to reject renderer-unscoped layout cache')
  }

  const pickedWithoutTarget = pickSeedFromOtherRendererCache({
    nodes,
    cache: { [baseKey]: unscopedPositions },
    baseKey,
    allowVariantFallback: false,
  })
  if (pickedWithoutTarget !== unscopedPositions) {
    throw new Error('expected callers without renderer ownership to preserve exact cache behavior')
  }
}
