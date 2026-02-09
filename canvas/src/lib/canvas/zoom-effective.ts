export type ZoomStateLike = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

export function pickZoomStateForView(args: {
  zoomViewKey: string | null | undefined
  zoomStateByKey: Record<string, ZoomStateLike | null | undefined> | null | undefined
  viewPinned: boolean
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
}): ZoomStateLike | null {
  if (!args.zoomViewKey) return null
  if (!args.viewPinned && (args.fitToScreenMode || args.zoomToSelectionMode)) return null
  const map = args.zoomStateByKey
  if (!map) return null
  return map[args.zoomViewKey] ?? null
}

export function getZoomStateForKey(args: {
  zoomViewKey: string | null | undefined
  zoomStateByKey: Record<string, ZoomStateLike | null | undefined> | null | undefined
}): ZoomStateLike | null {
  if (!args.zoomViewKey) return null
  const map = args.zoomStateByKey
  if (!map) return null
  return map[args.zoomViewKey] ?? null
}
