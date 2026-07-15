import { clearStoryboardCardCleanSlateProperties, type StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardModel'
import { updateStrybldrStoryboardMarkdownCardOverride } from '@/features/strybldr/strybldrStoryboard'
import { unwrapGraphCellValue } from '@/lib/graph/nodeProperties'
import type { GraphData } from '@/lib/graph/types'

export type StoryboardCardResetActionResult =
  | { status: 'empty'; changed: false }
  | { status: 'cleared'; changed: true }

type StoryboardCardResetState = Pick<
  StoryboardCardModel,
  'summary' | 'output' | 'action' | 'dialogue' | 'prompt' | 'media' | 'references'
>

export function runStoryboardCardResetAction(args: {
  card: StoryboardCardResetState
  resetCard: () => void
}): StoryboardCardResetActionResult {
  const hasText = [
    args.card.summary,
    args.card.output,
    args.card.action,
    args.card.dialogue,
    args.card.prompt,
  ].some(value => String(value || '').trim())
  const hasMedia = Boolean(args.card.media) || args.card.references.length > 0
  if (!hasText && !hasMedia) return { status: 'empty', changed: false }
  args.resetCard()
  return { status: 'cleared', changed: true }
}

export function resetStoryboardCardPersistence(args: {
  cardId: string
  markdownDocumentText: string | null | undefined
  commitMarkdownMutation: (args: { nextMarkdownText: string | null; historyLabel: string }) => boolean
  currentPropertiesByCardId: ReadonlyMap<string, Record<string, unknown>>
  graphData: GraphData | null | undefined
  setGraphData: (graphData: GraphData) => void
  addHistory: (label: string) => void
  updateNode: (nodeId: string, patch: { properties: never }) => void
}): void {
  const nextMarkdownText = updateStrybldrStoryboardMarkdownCardOverride({
    text: args.markdownDocumentText || '',
    nodeId: args.cardId,
    patch: {
      summary: '', output: '', action: '', dialogue: '', prompt: '', outputSrcDoc: '',
      imageUrl: '', mediaKind: '', mediaUrl: '', renderUrl: '', sourceUrl: '',
    },
  })
  if (args.commitMarkdownMutation({ nextMarkdownText, historyLabel: 'Storyboard reset' })) return
  const nextProperties = clearStoryboardCardCleanSlateProperties(
    args.currentPropertiesByCardId.get(args.cardId) || {},
  )
  if (!args.graphData?.nodes?.some(node => String(unwrapGraphCellValue(node?.id) || '') === args.cardId)) {
    args.updateNode(args.cardId, { properties: nextProperties as never })
    return
  }
  args.setGraphData({
    ...args.graphData,
    nodes: args.graphData.nodes.map(node => (
      String(unwrapGraphCellValue(node?.id) || '') === args.cardId
        ? { ...node, properties: nextProperties as never }
        : node
    )),
  })
  args.addHistory('Storyboard reset')
}
