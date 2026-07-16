import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphState } from '@/hooks/store/types'
import {
  normalizeComposedSourcePath,
  readComposedSourceFilePath,
} from '@/features/source-files/composedSourceSelection'
import {
  appendStrybldrStoryboardMarkdownElement,
  buildStrybldrCardOverridePatchFromGraphNodeChange,
  parseStrybldrStoryboardMarkdown,
  removeStrybldrStoryboardMarkdownElement,
  syncStrybldrStoryboardMarkdownWorkflowEdges,
  updateStrybldrStoryboardMarkdownCardOverride,
} from '@/features/strybldr/strybldrStoryboard'
import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID } from '@/lib/config'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
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
  if (!args.previousNode && !args.nextNode) {
    const document = parseStrybldrStoryboardMarkdown(nextText)
    const currentPanels = (args.graphData?.nodes || []).filter(node => (
      String(unwrapGraphCellValue(node.type) || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID
    ))
    const currentPanelIds = new Set(currentPanels.map(node => String(unwrapGraphCellValue(node.id) || '').trim()).filter(Boolean))
    const sourcePanelIds = (document?.cards || [])
      .filter(card => String(card.type || '').trim() === FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID)
      .map(card => String(card.nodeId || '').trim())
      .filter(Boolean)
    for (const sourcePanelId of sourcePanelIds) {
      if (currentPanelIds.has(sourcePanelId)) continue
      nextText = removeStrybldrStoryboardMarkdownElement({ text: nextText, nodeId: sourcePanelId }) || nextText
    }
    const retainedSourcePanelIds = new Set(sourcePanelIds.filter(id => currentPanelIds.has(id)))
    for (const panel of currentPanels) {
      const panelId = String(unwrapGraphCellValue(panel.id) || '').trim()
      if (!panelId) continue
      const patch = buildStrybldrCardOverridePatchFromGraphNodeChange({ nextNode: panel })
      if (!retainedSourcePanelIds.has(panelId)) {
        nextText = appendStrybldrStoryboardMarkdownElement({
          text: nextText,
          nodeId: panelId,
          title: patch.title,
          type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID,
          lane: patch.lane,
          order: patch.order,
          summary: patch.summary,
          action: patch.action,
          prompt: patch.prompt,
        }) || nextText
      }
      nextText = updateStrybldrStoryboardMarkdownCardOverride({ text: nextText, nodeId: panelId, patch }) || nextText
    }
  }
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
