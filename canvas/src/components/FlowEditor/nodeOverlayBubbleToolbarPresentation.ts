import type { NodeOverlayEditorActionsToolbarProps } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import {
  WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX,
  WIDGET_ACTIONS_TOOLBAR_OFFSET_PX,
  WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX,
} from '@/components/FlowEditor/flowWidgetOverlayShared'

const FLOW_WIDGET_BUBBLE_TOOLBAR_NAV_STYLE = {
  pointerEvents: 'auto',
  top: -WIDGET_ACTIONS_TOOLBAR_OFFSET_PX,
  transform: 'translateX(-50%)',
} as const
const FLOW_RICH_MEDIA_BUBBLE_TOOLBAR_NAV_STYLE = {
  pointerEvents: 'auto',
  top: '50%',
  left: '100%',
  marginLeft: `${WIDGET_ACTIONS_TOOLBAR_SIDE_OFFSET_PX}px`,
  transform: 'translateY(-50%)',
} as const
const NODE_OVERLAY_BUBBLE_TOOLBAR_ICON_SIZE_CLASS = 'h-3.5 w-3.5'
const NODE_OVERLAY_BUBBLE_TOOLBAR_ICON_STROKE_WIDTH = 1.8

export type NodeOverlayBubbleToolbarPlacement = 'flow-rich-media-right-middle' | 'flow-widget-above-center'

export type NodeOverlayBubbleToolbarPresentation = Pick<
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
  | 'maxWidthPx'
>

const readNodeOverlayBubbleToolbarPlacementClassName = (placement: NodeOverlayBubbleToolbarPlacement): string =>
  placement === 'flow-rich-media-right-middle'
    ? 'absolute z-30'
    : 'absolute left-1/2 z-10'

const readNodeOverlayBubbleToolbarPlacementStyle = (placement: NodeOverlayBubbleToolbarPlacement): NodeOverlayBubbleToolbarPresentation['navStyle'] =>
  placement === 'flow-widget-above-center'
    ? FLOW_WIDGET_BUBBLE_TOOLBAR_NAV_STYLE
    : FLOW_RICH_MEDIA_BUBBLE_TOOLBAR_NAV_STYLE

export function buildNodeOverlayBubbleToolbarPresentation(args: {
  actionVisibility?: NodeOverlayEditorActionsToolbarProps['actionVisibility']
  active: boolean
  ariaLabel: string
  convertToLoopDisabled: boolean
  duplicateDisabled: boolean
  enableHandlesDisabled?: boolean
  navClassName?: string
  placement: NodeOverlayBubbleToolbarPlacement
}): NodeOverlayBubbleToolbarPresentation {
  return {
    ariaLabel: args.ariaLabel,
    navClassName: args.navClassName || readNodeOverlayBubbleToolbarPlacementClassName(args.placement),
    navStyle: readNodeOverlayBubbleToolbarPlacementStyle(args.placement),
    active: args.active,
    iconSizeClass: NODE_OVERLAY_BUBBLE_TOOLBAR_ICON_SIZE_CLASS,
    iconStrokeWidth: NODE_OVERLAY_BUBBLE_TOOLBAR_ICON_STROKE_WIDTH,
    enableHandlesDisabled: args.enableHandlesDisabled !== false,
    convertToLoopDisabled: args.convertToLoopDisabled,
    duplicateDisabled: args.duplicateDisabled,
    actionVisibility: args.actionVisibility,
    maxWidthPx: WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX,
  }
}
