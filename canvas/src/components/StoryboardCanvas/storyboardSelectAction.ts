export type StoryboardSelectActionResult = {
  selectedNodeId: string
}

export function runStoryboardSelectAction(args: {
  resolvedCardNodeId: string
  setSelectionSource: (source: 'canvas') => void
  selectNode: (nodeId: string) => void
}): StoryboardSelectActionResult {
  const selectedNodeId = String(args.resolvedCardNodeId || '').trim()
  args.setSelectionSource('canvas')
  args.selectNode(selectedNodeId)
  return {
    selectedNodeId,
  }
}
