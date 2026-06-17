import { duplicateMarkdownLineRange } from 'grph-shared/markdown/lineEditing'
import type { GraphNode } from '@/lib/graph/types'
import type { DocumentLocationWithRange } from '@/lib/graph/markdownMetadata'
import { findDuplicatedMarkdownNodeId } from '@/components/StoryboardCanvas/storyboardDuplicateSelection'

export type StoryboardMarkdownDuplicateCommitResult = {
  committed: boolean
  duplicatedNodeId: string | null
  duplicatedStartLine: number | null
  duplicatedEndLine: number | null
  nextMarkdownText: string | null
}

export type StoryboardMarkdownDuplicateActionResult = StoryboardMarkdownDuplicateCommitResult & {
  handled: boolean
}

export function commitStoryboardMarkdownDuplicate(args: {
  markdownDocumentName: string | null | undefined
  markdownDocumentText: string | null | undefined
  sourceLocation: DocumentLocationWithRange | null | undefined
  beforeIds: ReadonlySet<string>
  commitMutation: (nextMarkdownText: string) => boolean
  getCommittedNodes: () => readonly GraphNode[]
}): StoryboardMarkdownDuplicateCommitResult {
  const sourceLocation = args.sourceLocation
  const markdownDocumentName = String(args.markdownDocumentName || '').trim()
  if (!sourceLocation || !markdownDocumentName || sourceLocation.documentPath !== markdownDocumentName) {
    return {
      committed: false,
      duplicatedNodeId: null,
      duplicatedStartLine: null,
      duplicatedEndLine: null,
      nextMarkdownText: null,
    }
  }
  const duplicatedRange = duplicateMarkdownLineRange({
    markdownText: String(args.markdownDocumentText || ''),
    startLine: sourceLocation.lineStart,
    endLine: sourceLocation.lineEnd,
  })
  const committed = args.commitMutation(duplicatedRange.markdownText)
  if (!committed) {
    return {
      committed: false,
      duplicatedNodeId: null,
      duplicatedStartLine: duplicatedRange.duplicatedStartLine,
      duplicatedEndLine: duplicatedRange.duplicatedEndLine,
      nextMarkdownText: duplicatedRange.markdownText,
    }
  }
  const duplicatedNodeId = findDuplicatedMarkdownNodeId({
    committedNodes: args.getCommittedNodes(),
    beforeIds: args.beforeIds,
    documentPath: sourceLocation.documentPath,
    duplicatedStartLine: duplicatedRange.duplicatedStartLine,
    duplicatedEndLine: duplicatedRange.duplicatedEndLine,
  })
  return {
    committed: true,
    duplicatedNodeId,
    duplicatedStartLine: duplicatedRange.duplicatedStartLine,
    duplicatedEndLine: duplicatedRange.duplicatedEndLine,
    nextMarkdownText: duplicatedRange.markdownText,
  }
}

export function runStoryboardMarkdownDuplicateAction(args: {
  markdownDocumentName: string | null | undefined
  markdownDocumentText: string | null | undefined
  sourceLocation: DocumentLocationWithRange | null | undefined
  getNodes: () => readonly GraphNode[]
  commitMutation: (nextMarkdownText: string) => boolean
  selectNode?: (nodeId: string) => void
}): StoryboardMarkdownDuplicateActionResult {
  const sourceLocation = args.sourceLocation
  const markdownDocumentName = String(args.markdownDocumentName || '').trim()
  if (!sourceLocation || !markdownDocumentName || sourceLocation.documentPath !== markdownDocumentName) {
    return {
      handled: false,
      committed: false,
      duplicatedNodeId: null,
      duplicatedStartLine: null,
      duplicatedEndLine: null,
      nextMarkdownText: null,
    }
  }
  const beforeIds = new Set<string>(args.getNodes().map(node => String(node?.id || '').trim()).filter(Boolean))
  const duplicatedResult = commitStoryboardMarkdownDuplicate({
    markdownDocumentName,
    markdownDocumentText: args.markdownDocumentText,
    sourceLocation,
    beforeIds,
    commitMutation: args.commitMutation,
    getCommittedNodes: args.getNodes,
  })
  if (duplicatedResult.committed && duplicatedResult.duplicatedNodeId && typeof args.selectNode === 'function') {
    args.selectNode(String(duplicatedResult.duplicatedNodeId))
  }
  return {
    handled: true,
    ...duplicatedResult,
  }
}
