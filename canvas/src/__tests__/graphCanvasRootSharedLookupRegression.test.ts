import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasRootHooksReuseSharedGraphLookupHelper() {
  const arrangeText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useArrange2d.ts'),
    'utf8',
  )
  const presentationText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts'),
    'utf8',
  )

  if (
    !arrangeText.includes("cacheScope: 'graph-canvas-root-arrange-2d-scene-graph'")
    || !arrangeText.includes('preferCurrentGraphDataRefs: true')
    || !arrangeText.includes('getCachedGraphLookup({')
  ) {
    throw new Error('expected GraphCanvasRoot arrange hook to reuse the shared graph lookup helper instead of rebuilding a local scene node map')
  }
  if (
    !presentationText.includes("cacheScope: 'graph-canvas-root-presentation-scene-graph'")
    || !presentationText.includes('preferCurrentGraphDataRefs: true')
    || !presentationText.includes('getCachedGraphLookup({')
  ) {
    throw new Error('expected GraphCanvasRoot presentation hook to reuse the shared graph lookup helper instead of rebuilding a local scene node map for stable overlay extents')
  }
  if (!presentationText.includes('nodeById: sceneGraphLookup?.nodeById || new Map<string, GraphNode>()')) {
    throw new Error('expected GraphCanvasRoot presentation hook to pass shared scene node lookups into stable overlay extent merging')
  }
}
