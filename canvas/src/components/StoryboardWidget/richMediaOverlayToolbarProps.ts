import type { WidgetEditorActionsToolbarProps } from '@/components/StoryboardWidget/WidgetEditorActionsToolbar'
import { buildWidgetBubbleToolbarPresentation } from '@/components/StoryboardWidget/widgetBubbleToolbarPresentation'

export const RICH_MEDIA_OVERLAY_ACTION_VISIBILITY = {
  clearOutput: false,
  convertToLoop: false,
  duplicate: true,
  enableHandles: false,
  help: false,
  openInSidepane: true,
  remove: true,
  run: false,
  updateKvEntry: false,
} satisfies NonNullable<WidgetEditorActionsToolbarProps['actionVisibility']>

export type SharedRichMediaOverlayToolbarProps = Pick<
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
  | 'maxWidthPx'
>

export function buildSharedRichMediaOverlayToolbarProps(args?: {
  navClassName?: string
}): SharedRichMediaOverlayToolbarProps {
  return buildWidgetBubbleToolbarPresentation({
    ariaLabel: 'Rich Media Panel actions',
    actionVisibility: RICH_MEDIA_OVERLAY_ACTION_VISIBILITY,
    navClassName: args?.navClassName,
    placement: 'flow-rich-media-right-middle',
    active: true,
    enableHandlesDisabled: true,
    convertToLoopDisabled: true,
    duplicateDisabled: false,
  })
}

export function buildSharedRichMediaOverlayControlProps(args: {
  onSwitchToKtvRows: () => void
}): Pick<WidgetEditorActionsToolbarProps, 'richMediaViewToggle'> {
  return {
    richMediaViewToggle: {
      visible: true,
      isKtvRows: false,
      onToggle: args.onSwitchToKtvRows,
    },
  }
}
