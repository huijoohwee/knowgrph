import { buildWidgetOpenExternalAction, type WidgetOpenExternalAction } from '@/components/StoryboardWidget/widgetOpenExternalAction'

export type StoryboardToolbarPresentation = {
  actionVisibility: {
    enableHandles: false
  }
  openExternalAction: WidgetOpenExternalAction | undefined
}

export function buildStoryboardToolbarPresentation(args: {
  primaryReferenceUrl: string | null | undefined
}): StoryboardToolbarPresentation {
  return {
    actionVisibility: {
      enableHandles: false,
    },
    openExternalAction: buildWidgetOpenExternalAction({
      url: args.primaryReferenceUrl,
      label: 'Open ref',
    }),
  }
}
