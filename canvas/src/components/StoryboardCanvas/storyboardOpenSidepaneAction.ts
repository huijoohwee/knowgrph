import { runStoryboardSelectAction } from '@/components/StoryboardCanvas/storyboardSelectAction'

export type StoryboardOpenSidepaneActionResult = {
  selectedNodeId: string
}

export function runStoryboardOpenSidepaneAction(args: {
  resolvedCardNodeId: string
  setSelectionSource: (source: 'canvas') => void
  selectNode: (nodeId: string) => void
  updateOpenWidgetNodeIds: (updater: (prev: string[]) => string[]) => void
  openSidepane: () => void
}): StoryboardOpenSidepaneActionResult {
  const { selectedNodeId } = runStoryboardSelectAction({
    resolvedCardNodeId: args.resolvedCardNodeId,
    setSelectionSource: args.setSelectionSource,
    selectNode: args.selectNode,
  })
  args.updateOpenWidgetNodeIds(prev => (prev.includes(selectedNodeId) ? prev : [...prev, selectedNodeId]))
  args.openSidepane()
  return { selectedNodeId }
}
