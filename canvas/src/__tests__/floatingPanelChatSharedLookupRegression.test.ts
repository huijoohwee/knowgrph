import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFloatingPanelChatReusesSharedLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'chat', 'FloatingPanelChat.tsx'),
    'utf8',
  )

  if (
    !text.includes("buildScopedGraphSemanticKey('floating-panel-chat-graph'")
    || !text.includes("cacheScope: 'floating-panel-chat-graph'")
    || !text.includes('getCachedGraphLookup({')
    || !text.includes('graphRevision: graphDataRevision')
    || !text.includes('preferCurrentGraphDataRefs: true')
    || !text.includes('return graphLookup?.nodeById.get(selectedNodeId) || null')
    || text.includes('graphData.nodes.find(')
  ) {
    throw new Error('expected FloatingPanelChat to reuse the shared semantic graph lookup instead of rescanning graph nodes by selected id')
  }
}
