import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLaunchSpotlightStatusCardReusesSharedLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'spotlight', 'LaunchSpotlightStatusCard.tsx'),
    'utf8',
  )

  if (
    !text.includes("buildScopedGraphSemanticKey('launch-spotlight-status-card-graph'")
    || !text.includes("cacheScope: 'launch-spotlight-status-card-graph'")
    || !text.includes('getCachedGraphLookup({')
    || !text.includes('graphRevision: graphDataRevision')
    || !text.includes('preferCurrentGraphDataRefs: true')
    || !text.includes("const found = graphLookup?.nodeById.get(selectedNodeId) || null")
    || text.includes('graphData.nodes.find(')
  ) {
    throw new Error('expected LaunchSpotlightStatusCard to reuse the shared semantic graph lookup instead of rescanning graph nodes by selected id')
  }
}
