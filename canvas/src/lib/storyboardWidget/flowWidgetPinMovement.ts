export function isFlowWidgetHeaderDragAllowedByPin(args: {
  pinnedInCanvas: boolean
}): boolean {
  return args.pinnedInCanvas === false
}
