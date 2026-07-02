import type { WidgetEditorActionsToolbarProps } from '@/components/StoryboardWidget/WidgetEditorActionsToolbar'
import { buildWidgetBubbleToolbarPresentation } from '@/components/StoryboardWidget/widgetBubbleToolbarPresentation'
import { buildStoryboardToolbarPresentation } from '@/components/StoryboardCanvas/storyboardToolbarPresentation'

export type StoryboardToolbarProps = Pick<
  WidgetEditorActionsToolbarProps,
  | 'ariaLabel'
  | 'navClassName'
  | 'navStyle'
  | 'active'
  | 'iconSizeClass'
  | 'iconStrokeWidth'
  | 'enableHandlesDisabled'
  | 'convertToLoopDisabled'
  | 'duplicateDisabled'
  | 'actionVisibility'
  | 'openExternalAction'
  | 'maxWidthPx'
>

export function buildStoryboardToolbarProps(args: {
  active: boolean
  duplicateDisabled: boolean
  primaryReferenceUrl: string | null | undefined
}): StoryboardToolbarProps {
  const presentation = buildStoryboardToolbarPresentation({
    primaryReferenceUrl: args.primaryReferenceUrl,
  })
  return {
    ...buildWidgetBubbleToolbarPresentation({
      ariaLabel: 'Storyboard card actions',
      placement: 'flow-widget-above-center',
      active: args.active,
      enableHandlesDisabled: true,
      convertToLoopDisabled: false,
      duplicateDisabled: args.duplicateDisabled,
      actionVisibility: presentation.actionVisibility,
    }),
    openExternalAction: presentation.openExternalAction,
  }
}
