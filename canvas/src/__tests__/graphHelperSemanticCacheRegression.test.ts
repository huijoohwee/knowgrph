import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphHelperCachesReuseSemanticKeysInsteadOfRawGraphIdentity() {
  const sourceLayersText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'graph', 'sourceLayers.ts'),
    'utf8',
  )
  const selectionTargetsText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'zoom', 'selectionTargets.ts'),
    'utf8',
  )
  const searchText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'search', 'search.ts'),
    'utf8',
  )

  if (
    !sourceLayersText.includes('const composedGraphCache = new Map<string, GraphData>()')
    || !sourceLayersText.includes("buildScopedGraphSemanticKey('source-layer-compose'")
    || sourceLayersText.includes('new WeakMap<GraphData')
    || sourceLayersText.includes('composedGraphCacheByFirstGraph')
  ) {
    throw new Error('expected source-layer composition cache to use semantic keys instead of raw GraphData WeakMap identity')
  }

  if (
    !selectionTargetsText.includes("buildScopedGraphSemanticKey('selection-zoom-adjacency'")
    || !selectionTargetsText.includes("cacheScope: 'selection-zoom-adjacency'")
    || !selectionTargetsText.includes('const adjCache = new Map<string, Map<string, Set<string>>>()')
    || selectionTargetsText.includes('new WeakMap<GraphData')
  ) {
    throw new Error('expected selection zoom adjacency cache to use semantic keys and shared graph lookup reuse')
  }

  if (
    !searchText.includes("buildScopedGraphSemanticKey('search-node-entries'")
    || !searchText.includes("buildScopedGraphSemanticKey('search-edge-entries'")
    || !searchText.includes("buildScopedGraphSemanticKey('search-graph-results'")
    || !searchText.includes("cacheScope: 'search-node-entries'")
    || !searchText.includes("cacheScope: 'search-edge-entries'")
    || searchText.includes('new WeakMap<GraphData')
  ) {
    throw new Error('expected search indexing caches to use semantic keys and shared lookup reuse instead of raw GraphData identity')
  }
}
