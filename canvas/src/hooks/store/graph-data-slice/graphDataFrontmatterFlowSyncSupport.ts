import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/store/types'
import {
  normalizeComposedSourcePath,
  readComposedSourceFilePath,
} from '@/features/source-files/composedSourceSelection'
import {
  buildStrybldrCardOverridePatchFromGraphNodeChange,
  syncStrybldrStoryboardMarkdownWorkflowEdges,
  updateStrybldrStoryboardMarkdownCardOverride,
} from '@/features/strybldr/strybldrStoryboard'
import {
  appendStrybldrStoryboardNodeSource,
  isStrybldrStoryboardNodeSourceOwned,
} from '@/hooks/store/graph-data-slice/strybldrStoryboardNodeSourceSync'

export function syncStrybldrStoryboardMarkdownFromParsedGraph(args: {
  text: string
  graphData: GraphData | null | undefined
  previousNode?: GraphNode | null
  nextNode?: GraphNode | null
}): string | null {
  let nextText = args.text
  if (!args.previousNode && args.nextNode) {
    nextText = appendStrybldrStoryboardNodeSource(nextText, args.nextNode)
  }
  const nodeId = String(args.nextNode?.id || args.previousNode?.id || '').trim()
  const sourceOwnedNode = args.nextNode || args.previousNode
  if (nodeId && (!args.previousNode || isStrybldrStoryboardNodeSourceOwned(sourceOwnedNode))) {
    const cardPatch = buildStrybldrCardOverridePatchFromGraphNodeChange({
      previousNode: args.previousNode,
      nextNode: args.nextNode,
    })
    if (Object.keys(cardPatch).length > 0) {
      nextText = updateStrybldrStoryboardMarkdownCardOverride({
        text: nextText,
        nodeId,
        patch: cardPatch,
      }) || nextText
    }
  }
  return syncStrybldrStoryboardMarkdownWorkflowEdges({
    text: nextText,
    graphData: args.graphData,
  }) || nextText
}

export function findActiveMarkdownDocumentSourceFile(args: {
  state: GraphState
  sourceFiles: GraphState['sourceFiles']
}): { index: number; file: GraphState['sourceFiles'][number] } | null {
  const activeName = String(args.state.markdownDocumentName || '').trim()
  if (!activeName) return null
  const activePath = normalizeComposedSourcePath(activeName)
  if (!activePath) return null
  for (let index = 0; index < args.sourceFiles.length; index += 1) {
    const file = args.sourceFiles[index]
    if (!file) continue
    const filePath = normalizeComposedSourcePath(readComposedSourceFilePath(file))
    if (filePath && filePath === activePath) return { index, file }
  }
  return null
}
