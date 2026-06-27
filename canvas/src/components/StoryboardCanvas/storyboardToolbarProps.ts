import type { NodeOverlayEditorActionsToolbarProps } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX } from '@/components/FlowEditor/flowWidgetOverlayShared'
import { buildStoryboardToolbarPresentation } from '@/components/StoryboardCanvas/storyboardToolbarPresentation'

const STORYBOARD_TOOLBAR_NAV_STYLE = { pointerEvents: 'auto' } as const

export type StoryboardToolbarProps = Pick<
  NodeOverlayEditorActionsToolbarProps,
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
    ariaLabel: 'Storyboard card actions',
    navClassName: 'absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2',
    navStyle: STORYBOARD_TOOLBAR_NAV_STYLE,
    active: args.active,
    iconSizeClass: 'h-3.5 w-3.5',
    iconStrokeWidth: 1.8,
    enableHandlesDisabled: true,
    convertToLoopDisabled: false,
    duplicateDisabled: args.duplicateDisabled,
    actionVisibility: presentation.actionVisibility,
    openExternalAction: presentation.openExternalAction,
    maxWidthPx: WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX,
  }
}
