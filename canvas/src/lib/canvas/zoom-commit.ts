import { isSameZoomState } from '@/lib/zoom/zoomStateEq'
import { quantizeZoomStateForCommit } from '@/lib/zoom/zoomStateQuantize'
import { stripZoomViewKeyVariant } from '@/lib/canvas/zoomViewKeyBase'

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

  const sameTransform = (a: ZoomStateCommit | null, b: ZoomStateCommit): boolean => {
    if (!a) return false
    return a.k === b.k && a.x === b.x && a.y === b.y && a.viewportW === b.viewportW && a.viewportH === b.viewportH
  }

  const sameGlobalTransform = sameTransform(existingGlobal, next)
  const sameKeyedTransform = sameTransform(existingKeyed, next)
  if (sameGlobalTransform && sameKeyedTransform) return false
  if (!sameGlobalTransform) args.state.setZoomState(next)
  if (!sameKeyedTransform) args.state.setZoomStateForKey(args.zoomViewKey, next)

  const base = stripZoomViewKeyVariant(args.zoomViewKey).base
  if (base && base !== args.zoomViewKey) {
    const existingBase = args.state.zoomStateByKey?.[base] || null
    if (!sameTransform(existingBase, next)) {
      args.state.setZoomStateForKey(base, next)
    }
  }
  return true
}
