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
    prevMode: 'force',
    prevFrontmatterMode: true,
    prevSemanticMode: 'document',
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
    'document:default:force': {
      a: { x: 1, y: 2 },
      b: { x: 3, y: 4 },
    },
  }
  const resWithCache = determineLayoutPositions({
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    prevMode: 'force',
    prevFrontmatterMode: true,
    prevSemanticMode: 'document',
    nodes,
    layoutPositionCacheByMode: cache,
  })
  if (resWithCache.cacheKey !== 'document:default:force') {
    throw new Error(`expected cacheKey document:default:force, got ${resWithCache.cacheKey}`)
  }
  if (!resWithCache.layoutPositionsForMode) {
    throw new Error('expected cache positions to be selected on view toggle when coverage is high')
  }
  if (resWithCache.skipInitialLayout !== true) {
    throw new Error('expected cached force layout to skip initial layout')
  }
}
