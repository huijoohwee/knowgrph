import type { WidgetEditorActionsToolbarProps } from '@/components/StoryboardWidget/WidgetEditorActionsToolbar'
import {
  WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX,
  WIDGET_ACTIONS_TOOLBAR_OFFSET_PX,
} from '@/components/StoryboardWidget/flowWidgetOverlayShared'

const FLOW_WIDGET_BUBBLE_TOOLBAR_NAV_STYLE = {
  pointerEvents: 'auto',
  top: -WIDGET_ACTIONS_TOOLBAR_OFFSET_PX,
} as const
const WIDGET_BUBBLE_TOOLBAR_ICON_SIZE_CLASS = 'h-3.5 w-3.5'
const WIDGET_BUBBLE_TOOLBAR_ICON_STROKE_WIDTH = 1.8

export type WidgetBubbleToolbarPlacement = 'flow-widget-above-center'

export type WidgetBubbleToolbarPresentation = Pick<
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

const WIDGET_BUBBLE_TOOLBAR_NAV_CLASS_NAME = 'absolute inset-x-0 mx-auto z-10'

const readWidgetBubbleToolbarPlacementClassName = (_placement: WidgetBubbleToolbarPlacement): string =>
  WIDGET_BUBBLE_TOOLBAR_NAV_CLASS_NAME

const readWidgetBubbleToolbarPlacementStyle = (_placement: WidgetBubbleToolbarPlacement): WidgetBubbleToolbarPresentation['navStyle'] =>
  FLOW_WIDGET_BUBBLE_TOOLBAR_NAV_STYLE

export function buildWidgetBubbleToolbarPresentation(args: {
  actionVisibility?: WidgetEditorActionsToolbarProps['actionVisibility']
  active: boolean
  ariaLabel: string
  convertToLoopDisabled: boolean
  duplicateDisabled: boolean
  enableHandlesDisabled?: boolean
  navClassName?: string
  placement: WidgetBubbleToolbarPlacement
}): WidgetBubbleToolbarPresentation {
  return {
    ariaLabel: args.ariaLabel,
    navClassName: args.navClassName || readWidgetBubbleToolbarPlacementClassName(args.placement),
    navStyle: readWidgetBubbleToolbarPlacementStyle(args.placement),
    active: args.active,
    iconSizeClass: WIDGET_BUBBLE_TOOLBAR_ICON_SIZE_CLASS,
    iconStrokeWidth: WIDGET_BUBBLE_TOOLBAR_ICON_STROKE_WIDTH,
    enableHandlesDisabled: args.enableHandlesDisabled !== false,
    convertToLoopDisabled: args.convertToLoopDisabled,
    duplicateDisabled: args.duplicateDisabled,
    actionVisibility: args.actionVisibility,
    maxWidthPx: WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX,
  }
}
