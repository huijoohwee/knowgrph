export type ZoomState = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

export const pickInitialZoomTransform = (args: {
  zoomState: ZoomState | null
  pinned: boolean
  graphDataRevision: number
  nextViewportW: number
  nextViewportH: number
}): { k: number; x: number; y: number } | null => {
  const z = args.zoomState
  if (!z) return null
  const sameRevision = z.graphDataRevision == null || z.graphDataRevision === args.graphDataRevision
  if (!args.pinned && !sameRevision) return null
  if (args.pinned) {
    return adjustPinnedZoomForViewportChange({ zoom: z, nextViewportW: args.nextViewportW, nextViewportH: args.nextViewportH })
  }
  const k = Number.isFinite(z.k) ? z.k : 1
  const x = Number.isFinite(z.x) ? z.x : 0
  const y = Number.isFinite(z.y) ? z.y : 0
  return { k, x, y }
}

export const adjustPinnedZoomForViewportChange = (args: {
  zoom: ZoomState
  nextViewportW: number
  nextViewportH: number
}): { k: number; x: number; y: number } => {
  const k = Number.isFinite(args.zoom.k) ? args.zoom.k : 1
  const x = Number.isFinite(args.zoom.x) ? args.zoom.x : 0
  const y = Number.isFinite(args.zoom.y) ? args.zoom.y : 0
  const prevW = Number.isFinite(args.zoom.viewportW) ? (args.zoom.viewportW as number) : null
  const prevH = Number.isFinite(args.zoom.viewportH) ? (args.zoom.viewportH as number) : null
  const nextW = Number.isFinite(args.nextViewportW) ? Math.max(1, Math.floor(args.nextViewportW)) : null
  const nextH = Number.isFinite(args.nextViewportH) ? Math.max(1, Math.floor(args.nextViewportH)) : null
  if (prevW == null || prevH == null || nextW == null || nextH == null) return { k, x, y }
  if (prevW === nextW && prevH === nextH) return { k, x, y }
  if (!(k > 0)) return { k: 1, x: 0, y: 0 }

  const prevCx = prevW / 2
  const prevCy = prevH / 2
  const worldCx = (prevCx - x) / k
  const worldCy = (prevCy - y) / k

  const nextCx = nextW / 2
  const nextCy = nextH / 2
  const nextX = nextCx - worldCx * k
  const nextY = nextCy - worldCy * k
  return { k, x: nextX, y: nextY }
}
