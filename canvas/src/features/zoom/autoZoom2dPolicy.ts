export function shouldAutoFitToScreen2d(args: {
  canvas2dRenderer: string
  viewPinned: boolean
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
}): boolean {
  if (args.viewPinned) return false
  if (args.zoomToSelectionMode) return false
  if (!args.fitToScreenMode) return false
  return true
}

export function shouldAutoZoomSelection2d(args: {
  canvas2dRenderer: string
  viewPinned: boolean
  zoomToSelectionMode: boolean
}): boolean {
  if (args.viewPinned) return false
  if (!args.zoomToSelectionMode) return false
  return true
}
