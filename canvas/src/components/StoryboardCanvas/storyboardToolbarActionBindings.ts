import type { StoryboardCardModel } from '@/components/StoryboardCanvas/storyboardTypes'

export type StoryboardToolbarActionBindings = {
  onRun: () => void
  onOpenInSidepane: () => void
  onDuplicate: () => void
  onClearOutput: () => void
  onHelp: () => void
  onRemove: () => void
  onUpdateKvEntry: () => void
  onConvertToLoopNode: () => void
}

export function buildStoryboardToolbarActionBindings(args: {
  card: StoryboardCardModel
  runCard: (card: StoryboardCardModel) => void
  openCardInSidepane: (card: StoryboardCardModel) => void
  duplicateCard: (card: StoryboardCardModel) => void
  clearCardOutput: (card: StoryboardCardModel) => void
  showCardHelp: () => void
  removeCard: (card: StoryboardCardModel) => void
  openCardWorkflowManagerMapping: (card: StoryboardCardModel) => void
  convertCardToLoop: (card: StoryboardCardModel) => void
}): StoryboardToolbarActionBindings {
  const { card } = args
  return {
    onRun: () => args.runCard(card),
    onOpenInSidepane: () => args.openCardInSidepane(card),
    onDuplicate: () => args.duplicateCard(card),
    onClearOutput: () => args.clearCardOutput(card),
    onHelp: args.showCardHelp,
    onRemove: () => args.removeCard(card),
    onUpdateKvEntry: () => args.openCardWorkflowManagerMapping(card),
    onConvertToLoopNode: () => args.convertCardToLoop(card),
  }
}
