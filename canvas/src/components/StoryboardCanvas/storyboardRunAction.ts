export type StoryboardRunUnavailableToast = {
  id: string
  kind: 'neutral'
  message: string
  ttlMs: number
}

export type StoryboardRunActionResult =
  | {
      status: 'unavailable'
      ran: false
      openedNodeId: string
      runNodeId: null
      toast: StoryboardRunUnavailableToast
    }
  | {
      status: 'started'
      ran: true
      openedNodeId: string
      runNodeId: string
      toast: null
    }

export function buildStoryboardRunUnavailableToast(args: {
  cardId: string
}): StoryboardRunUnavailableToast {
  return {
    id: `storyboard-run-${String(args.cardId || '').trim()}`,
    kind: 'neutral',
    message: 'Run is available in Flow Editor for runnable graph-backed nodes.',
    ttlMs: 2600,
  }
}

export function runStoryboardRunAction(args: {
  cardId: string
  hasSourceNode: boolean
  resolvedCardNodeId: string
  openInSidepane: () => { selectedNodeId?: string | null } | void
  runNode: (nodeId: string) => Promise<void> | void
}): StoryboardRunActionResult {
  const openedNodeId = String(
    args.openInSidepane()?.selectedNodeId || args.resolvedCardNodeId || '',
  ).trim()
  if (!args.hasSourceNode) {
    return {
      status: 'unavailable',
      ran: false,
      openedNodeId,
      runNodeId: null,
      toast: buildStoryboardRunUnavailableToast({
        cardId: args.cardId,
      }),
    }
  }
  args.runNode(openedNodeId)
  return {
    status: 'started',
    ran: true,
    openedNodeId,
    runNodeId: openedNodeId,
    toast: null,
  }
}
