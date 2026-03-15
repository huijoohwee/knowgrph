import { pickZoomStateWithCrossRendererFallback, type ZoomStateLike } from '@/lib/canvas/zoomSeed'

export function pickZoomStateForView(args: {
  zoomViewKey: string | null | undefined
  zoomStateByKey: Record<string, ZoomStateLike | null | undefined> | null | undefined
  viewPinned: boolean
  fitToScreenMode: boolean
  zoomToSelectionMode: boolean
}): ZoomStateLike | null {
  if (!args.zoomViewKey) return null
  if (!args.viewPinned && (args.fitToScreenMode || args.zoomToSelectionMode)) return null
  return pickZoomStateWithCrossRendererFallback({ zoomViewKey: args.zoomViewKey, zoomStateByKey: args.zoomStateByKey })
}

export function getZoomStateForKey(args: {
  zoomViewKey: string | null | undefined
  zoomStateByKey: Record<string, ZoomStateLike | null | undefined> | null | undefined
}): ZoomStateLike | null {
  return pickZoomStateWithCrossRendererFallback({ zoomViewKey: args.zoomViewKey, zoomStateByKey: args.zoomStateByKey })
}

export function getEffectiveZoomStateForKey(args: {
  zoomViewKey: string | null | undefined
  zoomStateByKey: Record<string, ZoomStateLike | null | undefined> | null | undefined
  zoomState: ZoomStateLike | null | undefined
}): ZoomStateLike | null {
  const keyed = pickZoomStateWithCrossRendererFallback({ zoomViewKey: args.zoomViewKey, zoomStateByKey: args.zoomStateByKey })
  return keyed || args.zoomState || null
}
