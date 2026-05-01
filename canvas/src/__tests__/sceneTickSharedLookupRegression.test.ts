import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testSceneWiresSharedDisplayLookupIntoSimulationTick() {
  const sceneText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts'),
    'utf8',
  )
  const tickText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.simulationTick2d.ts'),
    'utf8',
  )

  if (!sceneText.includes("cacheScope: 'graph-canvas-scene-display-graph'") || !sceneText.includes('getCachedGraphLookup({')) {
    throw new Error('expected GraphCanvas scene to provide a shared display-graph lookup instead of relying on per-tick local node map rebuilding')
  }
  if (!sceneText.includes('preferCurrentGraphDataRefs: true')) {
    throw new Error('expected GraphCanvas scene display lookup to preserve current graph node refs for simulation reads')
  }
  if (tickText.includes('for (let i = 0; i < nodes.length; i += 1) {\n      const n = nodes[i]\n      nodeById.set(String(n.id), n)\n    }')) {
    throw new Error('expected simulation tick handler to stop rebuilding a fallback nodeById map from nodes on every attachment')
  }
}
