import { appendStrybldrStoryboardMarkdownElement, createNextStrybldrStoryboardMarkdownNodeId } from '@/features/strybldr/strybldrStoryboard'

export type StoryboardStrybldrDuplicateActionResult = {
  handled: boolean
  committed: boolean
  nextMarkdownId: string | null
  nextMarkdownText: string | null
}

export function runStoryboardStrybldrDuplicateAction(args: {
  markdownDocumentText: string | null | undefined
  title: string
  typeLabel?: string | null
  lane?: string | null
  order?: number | null
  sourceUnitId?: string | null
  summary?: string | null
  action?: string | null
  prompt?: string | null
  commitMutation: (args: {
    nextMarkdownText: string
    nextSelectedNodeId: string
  }) => boolean
}): StoryboardStrybldrDuplicateActionResult {
  const text = String(args.markdownDocumentText || '')
  const nextMarkdownId = createNextStrybldrStoryboardMarkdownNodeId({ text })
  if (!nextMarkdownId) {
    return {
      handled: false,
      committed: false,
      nextMarkdownId: null,
      nextMarkdownText: null,
    }
  }
  const nextMarkdownText = appendStrybldrStoryboardMarkdownElement({
    text,
    nodeId: nextMarkdownId,
    title: args.title,
    type: args.typeLabel || undefined,
    lane: args.lane || undefined,
    order: typeof args.order === 'number' ? args.order : undefined,
    sourceUnitId: args.sourceUnitId || undefined,
    summary: args.summary || undefined,
    action: args.action || undefined,
    prompt: args.prompt || undefined,
  })
  const committed = args.commitMutation({
    nextMarkdownText,
    nextSelectedNodeId: nextMarkdownId,
  })
  return {
    handled: committed,
    committed,
    nextMarkdownId,
    nextMarkdownText,
  }
}
