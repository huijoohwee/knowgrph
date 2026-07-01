import type { NodeOverlayEditorActionsToolbarProps } from '@/components/FlowEditor/NodeOverlayEditorActionsToolbar'
import { WIDGET_ACTIONS_TOOLBAR_MAX_WIDTH_PX } from '@/components/FlowEditor/flowWidgetOverlayShared'

const NODE_OVERLAY_BUBBLE_TOOLBAR_NAV_STYLE = { pointerEvents: 'auto' } as const
const NODE_OVERLAY_BUBBLE_TOOLBAR_ICON_SIZE_CLASS = 'h-3.5 w-3.5'
const NODE_OVERLAY_BUBBLE_TOOLBAR_ICON_STROKE_WIDTH = 1.8

export type NodeOverlayBubbleToolbarPlacement = 'above-center' | 'right-middle'

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
  placement === 'right-middle'
    ? 'absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2'
    : 'absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2'

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
    navStyle: NODE_OVERLAY_BUBBLE_TOOLBAR_NAV_STYLE,
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
