import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testOverlayInteractionsReuseSharedMergedNodeLookupHelper() {
  const hookText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useOverlayInteractions2d.ts'),
    'utf8',
  )
  const graphRootText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'GraphCanvasRootImpl.tsx'),
    'utf8',
  )

  if (
    !hookText.includes("cacheScope: 'graph-canvas-root-overlay-interactions-node-lookup'")
    || !hookText.includes('readMergedGraphNodeLookup({')
    || !hookText.includes('graphDataRevision: number')
  ) {
    throw new Error('expected overlay interactions to reuse the shared merged node lookup helper with graph revision invalidation instead of rescanning sim-or-graph nodes inline')
  }
  if (!graphRootText.includes('graphDataRevision: graphDataRevision || 0')) {
    throw new Error('expected GraphCanvasRootImpl to pass graphDataRevision through to overlay interactions for semantic merged-node lookup invalidation')
  }
}
