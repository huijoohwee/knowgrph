import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMarkdownWorkspaceAvoidsGraphDataIdentityChurnSubscriptions() {
  const pWorkspaceInteractions = resolve(
    process.cwd(),
    'src',
    'lib',
    'markdown-workspace-runtime',
    'useMarkdownWorkspaceInteractions.ts',
  )
  const textWorkspaceInteractions = readFileSync(pWorkspaceInteractions, 'utf8')
  if (textWorkspaceInteractions.includes('useGraphStore(s => s.graphData)')) {
    throw new Error('expected markdown workspace interactions to avoid subscribing to whole graphData object')
  }
  if (!textWorkspaceInteractions.includes('buildDocLocationIndex({ nodes: graphNodesRef.current, edges: graphEdgesRef.current')) {
    throw new Error('expected markdown workspace doc index to be keyed off nodes+edges in the runtime SSOT')
  }

  const pSync = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'useCanvasMarkdownSync.ts')
  const textSync = readFileSync(pSync, 'utf8')
  if (textSync.includes('useGraphStore(s => s.graphData)')) {
    throw new Error('expected useCanvasMarkdownSync to avoid subscribing to whole graphData object')
  }
  if (
    !textSync.includes("buildScopedGraphSemanticKey('canvas-markdown-sync-graph'")
    || !textSync.includes('getCachedGraphLookup({')
    || !textSync.includes('resolveMarkdownNavigationMetadata({')
    || textSync.includes("nodes.find(n => String(n.id || '') === nodeId)")
    || textSync.includes("edges.find(e => String(e.id || '') === edgeId)")
    || textSync.includes('const resolveNavigationMetadata = (')
  ) {
    throw new Error('expected useCanvasMarkdownSync to reuse shared semantic lookup caching and the shared markdown navigation resolver instead of local array scans')
  }

  const pMarkdownMetadata = resolve(process.cwd(), 'src', 'lib', 'graph', 'markdownMetadata.ts')
  const textMarkdownMetadata = readFileSync(pMarkdownMetadata, 'utf8')
  if (
    !textMarkdownMetadata.includes('export const resolveMarkdownNavigationMetadata = (')
    || !textMarkdownMetadata.includes('const incidentEdgesByNodeId = graphLookup?.incidentEdgesByNodeId || null')
    || !textMarkdownMetadata.includes('const secondHopTargets = resolvePointsToTargets(targetId)')
  ) {
    throw new Error('expected markdown metadata SSOT to own selection navigation resolution through shared lookup adjacency reuse')
  }
}
