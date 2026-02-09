import { isSameZoomState } from '@/lib/zoom/zoomStateEq'
import { quantizeZoomStateForCommit } from '@/lib/zoom/zoomStateQuantize'

export type ZoomTransform = { k: number; x: number; y: number }

export type ZoomStateCommit = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

export function commitZoomTransformToStore(args: {
  state: {
    viewPinned: boolean
    zoomState: ZoomStateCommit | null
    zoomStateByKey?: Record<string, ZoomStateCommit> | null
    setZoomState: (z: ZoomStateCommit) => void
    setZoomStateForKey: (key: string, z: ZoomStateCommit) => void
  }
  zoomViewKey: string
  transform: ZoomTransform
  viewportW: number
  viewportH: number
  graphDataRevision: number | undefined
}): boolean {
  const pinned = args.state.viewPinned === true
  const next = quantizeZoomStateForCommit({
    ...args.transform,
    graphDataRevision: pinned ? undefined : args.graphDataRevision,
    viewportW: args.viewportW,
    viewportH: args.viewportH,
  })
  const existingGlobal = args.state.zoomState || null
  const existingKeyed = args.state.zoomStateByKey?.[args.zoomViewKey] || null
  const sameGlobal = isSameZoomState(existingGlobal, next)
  const sameKeyed = isSameZoomState(existingKeyed, next)
  if (sameGlobal && sameKeyed) return false
  if (!sameGlobal) args.state.setZoomState(next)
  if (!sameKeyed) args.state.setZoomStateForKey(args.zoomViewKey, next)
  return true
}
