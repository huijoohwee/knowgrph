import { removeStrybldrStoryboardMarkdownElement } from '@/features/strybldr/strybldrStoryboard'

export type StoryboardRemoveActionResult =
  | {
      branch: 'markdown'
      handled: true
      committed: boolean
      nextMarkdownText: string
      removedGraphNodeId: null
    }
  | {
      branch: 'graph'
      handled: true
      committed: true
      nextMarkdownText: null
      removedGraphNodeId: string
    }
  | {
      branch: null
      handled: false
      committed: false
      nextMarkdownText: null
      removedGraphNodeId: null
    }

export function runStoryboardRemoveAction(args: {
  markdownDocumentText: string | null | undefined
  cardId: string
  resolvedCardNodeId: string
  hasSourceNode: boolean
  commitMarkdownRemoval: (nextMarkdownText: string) => boolean
  removeGraphNode: (nodeId: string) => void
}): StoryboardRemoveActionResult {
  const nextMarkdownText = removeStrybldrStoryboardMarkdownElement({
    text: String(args.markdownDocumentText || ''),
    nodeId: args.cardId,
  })
  if (args.commitMarkdownRemoval(nextMarkdownText)) {
    return {
      branch: 'markdown',
      handled: true,
      committed: true,
      nextMarkdownText,
      removedGraphNodeId: null,
    }
  }
  if (args.hasSourceNode) {
    args.removeGraphNode(args.resolvedCardNodeId)
    return {
      branch: 'graph',
      handled: true,
      committed: true,
      nextMarkdownText: null,
      removedGraphNodeId: args.resolvedCardNodeId,
    }
  }
  return {
    branch: null,
    handled: false,
    committed: false,
    nextMarkdownText: null,
    removedGraphNodeId: null,
  }
}
