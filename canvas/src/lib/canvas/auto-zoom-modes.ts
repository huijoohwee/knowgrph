export function disableAutoZoomModesForUserGesture(state: {
  viewPinned: boolean
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
  setFitToScreenMode: (v: boolean) => void
  setZoomToSelectionMode: (v: boolean) => void
}): void {
  if (state.viewPinned) return
  if (state.fitToScreenMode) state.setFitToScreenMode(false)
  if (state.zoomToSelectionMode) state.setZoomToSelectionMode(false)
}

