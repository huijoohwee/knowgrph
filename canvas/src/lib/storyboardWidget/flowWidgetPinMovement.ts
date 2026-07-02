export function isFlowWidgetHeaderDragAllowedByPin(args: {
  fixedLayoutEnabled: boolean
  pinnedInCanvas: boolean
}): boolean {
  return !args.fixedLayoutEnabled || args.pinnedInCanvas === false
}
