import { buildNodeOverlayOpenExternalAction, type NodeOverlayOpenExternalAction } from '@/components/FlowEditor/nodeOverlayOpenExternalAction'

export type StoryboardToolbarPresentation = {
  actionVisibility: {
    enableHandles: false
  }
  openExternalAction: NodeOverlayOpenExternalAction | undefined
}

export function buildStoryboardToolbarPresentation(args: {
  primaryReferenceUrl: string | null | undefined
}): StoryboardToolbarPresentation {
  return {
    actionVisibility: {
      enableHandles: false,
    },
    openExternalAction: buildNodeOverlayOpenExternalAction({
      url: args.primaryReferenceUrl,
      label: 'Open ref',
    }),
  }
}
