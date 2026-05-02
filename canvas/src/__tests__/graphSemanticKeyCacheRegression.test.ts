import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testRemainingGraphCachesReuseSemanticKeysInsteadOfRawIdentity() {
  const mergedLookupText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'mergedNodeLookup.ts'),
    'utf8',
  )
  const viewDerivationText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'viewDerivation.ts'),
    'utf8',
  )
  const designOverlayText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useDesignCanvasOverlayRuntime.ts'),
    'utf8',
  )

  if (
    !mergedLookupText.includes('graphSemanticKey?: string | null')
    || !mergedLookupText.includes("buildScopedGraphSemanticKey(args.cacheScope")
    || !mergedLookupText.includes('cached.graphSemanticKey !== graphSemanticKey')
    || mergedLookupText.includes('cached.graphData !== graphData')
  ) {
    throw new Error('expected merged node lookup SSOT to invalidate from semantic graph keys instead of raw graph identity')
  }

  if (
    !viewDerivationText.includes('const GROUP_COLLAPSE_CACHE = new Map<string, GraphData>()')
    || !viewDerivationText.includes("buildScopedGraphSemanticKey('graph-canvas-view-derivation-group-collapse'")
    || !viewDerivationText.includes("hashScopedStringArraySignature('graph-group-collapse-ids'")
    || viewDerivationText.includes('new WeakMap<GraphData')
  ) {
    throw new Error('expected group-collapse view derivation to cache by semantic graph signature plus collapsed-group signature instead of raw GraphData WeakMaps')
  }

  if (
    !designOverlayText.includes("buildScopedGraphSemanticKey('design-canvas-overlay-runtime-graph'")
    || !designOverlayText.includes("cacheScope: 'design-canvas-overlay-runtime-graph'")
    || !designOverlayText.includes('const node = localGraphNodeById?.get(id) || null')
    || designOverlayText.includes('designMediaOverlayNodeByIdRef')
  ) {
    throw new Error('expected DesignCanvas overlay anchoring to reuse shared semantic graph lookup state instead of rebuilding a local node map on graph identity churn')
  }
}
