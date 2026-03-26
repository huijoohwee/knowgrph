import type { GraphNode } from '@/lib/graph/types'
import { buildLayoutPositionCacheKey, determineLayoutPositions } from '@/components/GraphCanvas/layout/positioning'

export const testLayoutPositionsSpreadAddsDeterministicJitterForDuplicates = () => {
  const nodes: GraphNode[] = []
  const positions: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < 30; i += 1) {
    const id = `n${i}`
    nodes.push({ id, type: 'Entity', label: id, x: 0, y: 0, properties: {} } as unknown as GraphNode)
    const x = i < 15 ? 1000 : 2000
    const y = i < 15 ? 1000 : 2000
    positions[id] = { x, y }
  }

  const datasetKey = 'dataset:test'
  const cacheKey = buildLayoutPositionCacheKey({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    viewKey: 'abc',
  })
  const cache: Record<string, Record<string, { x: number; y: number }>> = { [cacheKey]: positions }

  const res = determineLayoutPositions({
    datasetKey,
    mode: 'force',
    frontmatterMode: false,
    semanticMode: 'document',
    renderMode: '2d',
    renderVariant: 'd3',
    viewKey: 'abc',
    prevViewKey: null,
    prevDatasetKey: 'dataset:other',
    prevMode: 'force',
    prevFrontmatterMode: false,
    prevSemanticMode: 'document',
    prevRenderMode: '2d',
    prevRenderVariant: 'd3',
    prevLayoutVariant: null,
    layoutVariant: null,
    nodes,
    layoutPositionCacheByMode: cache,
  })

  if (!res.layoutPositionsForMode) throw new Error('expected cached positions to be used')
  const p0 = res.layoutPositionsForMode['n0']
  const p1 = res.layoutPositionsForMode['n1']
  if (!p0 || !p1) throw new Error('expected positions for n0/n1')
  const dist = Math.hypot(p0.x - p1.x, p0.y - p1.y)
  if (!(dist > 1)) throw new Error(`expected duplicates to be jittered apart; got dist=${dist}`)
}
