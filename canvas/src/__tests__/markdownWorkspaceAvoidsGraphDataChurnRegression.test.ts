import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMarkdownWorkspaceAvoidsGraphDataIdentityChurnSubscriptions() {
  const pWorkspace = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'MarkdownWorkspace.tsx')
  const textWorkspace = readFileSync(pWorkspace, 'utf8')
  if (textWorkspace.includes('useGraphStore(s => s.graphData)')) {
    throw new Error('expected MarkdownWorkspace to avoid subscribing to whole graphData object')
  }
  if (!textWorkspace.includes('buildDocLocationIndex({ nodes: graphNodesRef.current, edges: graphEdgesRef.current')) {
    throw new Error('expected MarkdownWorkspace doc index to be keyed off nodes+edges')
  }

  const pSync = resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'useCanvasMarkdownSync.ts')
  const textSync = readFileSync(pSync, 'utf8')
  if (textSync.includes('useGraphStore(s => s.graphData)')) {
    throw new Error('expected useCanvasMarkdownSync to avoid subscribing to whole graphData object')
  }
}
