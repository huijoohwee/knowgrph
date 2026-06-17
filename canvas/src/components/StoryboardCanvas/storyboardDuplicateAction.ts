import type { DocumentLocationWithRange } from '@/lib/graph/markdownMetadata'
import type { GraphNode } from '@/lib/graph/types'
import type { StoryboardMarkdownDuplicateActionResult } from '@/components/StoryboardCanvas/storyboardMarkdownDuplicate'
import { runStoryboardMarkdownDuplicateAction } from '@/components/StoryboardCanvas/storyboardMarkdownDuplicate'
import type { StoryboardStrybldrDuplicateActionResult } from '@/components/StoryboardCanvas/storyboardStrybldrDuplicate'
import { runStoryboardStrybldrDuplicateAction } from '@/components/StoryboardCanvas/storyboardStrybldrDuplicate'

export type StoryboardDuplicateActionResult =
  | ({ branch: 'strybldr' } & StoryboardStrybldrDuplicateActionResult)
  | ({ branch: 'markdown' } & StoryboardMarkdownDuplicateActionResult)
  | { branch: null; handled: false; committed: false }

export function runStoryboardDuplicateAction(args: {
  canUseStrybldrDuplicatePath: boolean
  markdownDocumentName: string | null | undefined
  markdownDocumentText: string | null | undefined
  sourceLocation: DocumentLocationWithRange | null | undefined
  title: string
  typeLabel?: string | null
  lane?: string | null
  order?: number | null
  sourceUnitId?: string | null
  summary?: string | null
  action?: string | null
  prompt?: string | null
  getNodes: () => readonly GraphNode[]
  commitStrybldrMutation: (args: {
    nextMarkdownText: string
    nextSelectedNodeId: string
  }) => boolean
  commitMarkdownMutation: (nextMarkdownText: string) => boolean
  selectNode?: (nodeId: string) => void
}): StoryboardDuplicateActionResult {
  if (args.canUseStrybldrDuplicatePath) {
    return {
      branch: 'strybldr',
      ...runStoryboardStrybldrDuplicateAction({
        markdownDocumentText: args.markdownDocumentText,
        title: args.title,
        typeLabel: args.typeLabel,
        lane: args.lane,
        order: args.order,
        sourceUnitId: args.sourceUnitId,
        summary: args.summary,
        action: args.action,
        prompt: args.prompt,
        commitMutation: args.commitStrybldrMutation,
      }),
    }
  }
  const markdownResult = runStoryboardMarkdownDuplicateAction({
    markdownDocumentName: args.markdownDocumentName,
    markdownDocumentText: args.markdownDocumentText,
    sourceLocation: args.sourceLocation,
    getNodes: args.getNodes,
    commitMutation: args.commitMarkdownMutation,
    selectNode: args.selectNode,
  })
  if (markdownResult.handled) {
    return {
      branch: 'markdown',
      ...markdownResult,
    }
  }
  return {
    branch: null,
    handled: false,
    committed: false,
  }
}
