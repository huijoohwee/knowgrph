import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLayoutAndScenePathsReuseSharedGraphLookupHelper() {
  const groupGeometrySeedText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layout', 'groupGeometrySeed.ts'),
    'utf8',
  )
  const viewDerivationText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'viewDerivation.ts'),
    'utf8',
  )
  const sceneDerivationText = readFileSync(
    resolve(process.cwd(), 'src', 'lib', 'scene', 'sceneDerivation.ts'),
    'utf8',
  )

  if (!groupGeometrySeedText.includes("cacheScope: 'graph-canvas-group-geometry-seed-nodes'") || !groupGeometrySeedText.includes('getCachedGraphLookup({')) {
    throw new Error('expected group geometry seed layout to reuse the shared graph lookup helper instead of rebuilding a local node map')
  }
  if (!viewDerivationText.includes("cacheScope: 'graph-canvas-view-derivation-group-collapse'") || !viewDerivationText.includes('getCachedGraphLookup({')) {
    throw new Error('expected group-collapse view derivation to reuse the shared graph lookup helper instead of rebuilding a local node map')
  }
  if (!sceneDerivationText.includes("cacheScope: 'scene-derivation-display-graph'") || !sceneDerivationText.includes('getCachedGraphLookup({')) {
    throw new Error('expected scene display derivation to reuse the shared graph lookup helper instead of rebuilding display node maps locally')
  }
}
