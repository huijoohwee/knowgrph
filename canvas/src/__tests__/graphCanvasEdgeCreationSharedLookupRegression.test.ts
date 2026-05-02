import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGraphCanvasEdgeCreationEffectReusesSharedLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'hooks', 'useEdgeCreationEffect.ts'),
    'utf8',
  )

  if (
    !text.includes("buildScopedGraphSemanticKey('graph-canvas-edge-creation-effect-graph'")
    || !text.includes("cacheScope: 'graph-canvas-edge-creation-effect-graph'")
    || !text.includes('getCachedGraphLookup({')
    || !text.includes('preferCurrentGraphDataRefs: true')
    || !text.includes('graphLookup?.nodeById.get(fromId)')
    || !text.includes('graphLookup?.edgeById.get(selectedEdgeKey)')
    || text.includes('graphData.nodes.find(')
    || text.includes('graphData.edges.find(')
  ) {
    throw new Error('expected GraphCanvas edge creation effect to reuse the shared semantic graph lookup instead of rescanning store graph arrays')
  }
}
