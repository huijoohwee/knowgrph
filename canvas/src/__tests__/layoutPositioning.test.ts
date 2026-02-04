import { determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'
import type { GraphNode } from '@/lib/graph/types'

export const testLayoutPositioningSkipsReseedOnToggle = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const resNoCache = determineLayoutPositions({
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevMode: 'force',
    prevFrontmatterMode: true,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    nodes,
    layoutPositionCacheByMode: {},
  })
  if (resNoCache.skipInitialLayout !== true) {
    throw new Error('expected force layout to skip initial layout when nodes already have positions')
  }
  if (resNoCache.layoutPositionsForMode !== null) {
    throw new Error('expected no cache positions when cache is empty')
  }

  const cache = {
    'document:default:force:2d:d3': {
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 },
    },
  }
  const resWithCache = determineLayoutPositions({
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevMode: 'force',
    prevFrontmatterMode: true,
    prevSemanticMode: 'document',
    prevRenderMode: '3d',
    nodes,
    layoutPositionCacheByMode: cache,
  })
  if (resWithCache.cacheKey !== 'document:default:force:2d:d3') {
    throw new Error(`expected cacheKey document:default:force:2d:d3, got ${resWithCache.cacheKey}`)
  }
  if (!resWithCache.layoutPositionsForMode) {
    throw new Error('expected cache positions to be selected on view toggle when coverage is high')
  }
  if (resWithCache.skipInitialLayout !== true) {
    throw new Error('expected cached force layout to skip initial layout')
  }
}

export const testLayoutPositioningCacheKeyUsesRenderVariant = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const d3 = determineLayoutPositions({
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })

  const flow = determineLayoutPositions({
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'flow',
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  })

  const baseStratify = {
    mode: 'stratify',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    prevMode: null,
    prevFrontmatterMode: null,
    prevSemanticMode: null,
    prevRenderMode: null,
    nodes,
    layoutPositionCacheByMode: {},
  } as const
  const stratifyVertical = determineLayoutPositions({ ...baseStratify, layoutVariant: 'o=vertical' })
  const stratifyHorizontal = determineLayoutPositions({ ...baseStratify, layoutVariant: 'o=horizontal' })

  if (d3.cacheKey !== 'document:default:force:2d:d3') {
    throw new Error(`expected d3 cacheKey document:default:force:2d:d3, got ${d3.cacheKey}`)
  }
  if (flow.cacheKey !== 'document:default:force:2d:flow') {
    throw new Error(`expected flow cacheKey document:default:force:2d:flow, got ${flow.cacheKey}`)
  }
  if (stratifyVertical.cacheKey !== 'document:default:stratify:2d:d3:o=vertical') {
    throw new Error(`expected stratify vertical cacheKey document:default:stratify:2d:d3:o=vertical, got ${stratifyVertical.cacheKey}`)
  }
  if (stratifyHorizontal.cacheKey !== 'document:default:stratify:2d:d3:o=horizontal') {
    throw new Error(`expected stratify horizontal cacheKey document:default:stratify:2d:d3:o=horizontal, got ${stratifyHorizontal.cacheKey}`)
  }
}

export const testLayoutPositioningForcesLayoutWhenVariantChanges = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'a', type: 'T', x: 10, y: 20, properties: {} },
    { id: 'b', label: 'b', type: 'T', x: 30, y: 40, properties: {} },
  ]

  const res = determineLayoutPositions({
    mode: 'stratify',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    layoutVariant: 'o=horizontal',
    prevMode: 'stratify',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevLayoutVariant: 'o=vertical',
    nodes,
    layoutPositionCacheByMode: {},
  })

  if (res.skipInitialLayout !== false) {
    throw new Error('expected variant change to force initial layout when no cache exists')
  }
}
