import type { StoryboardBoardModel, StoryboardCardModel } from './storyboardModel'

export type StoryboardTimelineItem = {
  id: string
  index: number
  inputIndex: number
  laneId: string
  laneLabel: string
  order: number
  title: string
}

function compareStoryboardTimelineCards(left: StoryboardTimelineItem, right: StoryboardTimelineItem): number {
  if (left.order !== right.order) return left.order - right.order
  if (left.inputIndex !== right.inputIndex) return left.inputIndex - right.inputIndex
  return left.title.localeCompare(right.title)
}

function toStoryboardTimelineItem(card: StoryboardCardModel, laneLabel: string, index: number): StoryboardTimelineItem {
  return {
    id: card.id,
    index,
    inputIndex: card.inputIndex,
    laneId: card.lane,
    laneLabel,
    order: card.order,
    title: card.title,
  }
}

export function buildStoryboardTimelineItems(board: StoryboardBoardModel): StoryboardTimelineItem[] {
  const items = board.lanes.flatMap(lane =>
    lane.cards.map((card, index) => toStoryboardTimelineItem(card, lane.label, index)),
  )
  return items.sort(compareStoryboardTimelineCards).map((item, index) => ({ ...item, index }))
}

export function resolveStoryboardTimelineIndex(position: number, itemCount: number): number {
  if (itemCount <= 0) return -1
  if (!Number.isFinite(position)) return 0
  return Math.min(itemCount - 1, Math.max(0, Math.floor(position + 0.0001)))
}

export function formatStoryboardTimelinePositionLabel(index: number, total: number): string {
  if (total <= 0 || index < 0) return '00 / 00'
  const width = Math.max(2, String(total).length)
  return `${String(index + 1).padStart(width, '0')} / ${String(total).padStart(width, '0')}`
}
