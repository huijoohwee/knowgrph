import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testBuildNativeSceneReusesSharedLookupForInputGraphReads() {
  const buildNativeSceneText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'buildNativeScene.ts'),
    'utf8',
  )

  if (!buildNativeSceneText.includes("cacheScope: 'flow-canvas-build-native-scene-input-graph'") || !buildNativeSceneText.includes('getCachedGraphLookup({')) {
    throw new Error('expected buildNativeScene input graph reads to reuse the shared graph lookup helper instead of rebuilding a local input node map')
  }
  if (!buildNativeSceneText.includes("const nodeById = new Map<string, NonNullable<FlowNativeScene['nodes']>[number]>()")) {
    throw new Error('expected buildNativeScene to retain the runtime scene nodeById map as local output SSOT')
  }
}
