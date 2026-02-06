export type ViewportTransform = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

export const safeViewportTransform = (
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null,
): { k: number; x: number; y: number } => {
  const k = transform && Number.isFinite(transform.k) ? Math.max(0.001, transform.k) : 1
  const x = transform && Number.isFinite(transform.x) ? transform.x : 0
  const y = transform && Number.isFinite(transform.y) ? transform.y : 0
  return { k, x, y }
}

export const worldToScreen = (args: {
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null
  x: number
  y: number
}): { sx: number; sy: number } => {
  const t = safeViewportTransform(args.transform)
  const wx = Number.isFinite(args.x) ? args.x : 0
  const wy = Number.isFinite(args.y) ? args.y : 0
  return { sx: wx * t.k + t.x, sy: wy * t.k + t.y }
}

export const screenToWorld = (args: {
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null
  sx: number
  sy: number
}): { x: number; y: number } => {
  const t = safeViewportTransform(args.transform)
  const sx = Number.isFinite(args.sx) ? args.sx : 0
  const sy = Number.isFinite(args.sy) ? args.sy : 0
  return { x: (sx - t.x) / t.k, y: (sy - t.y) / t.k }
}

export const viewportCenterToWorld = (args: {
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null
  viewportW: number
  viewportH: number
}): { x: number; y: number } => {
  const sx = Math.max(0, Number.isFinite(args.viewportW) ? args.viewportW : 0) / 2
  const sy = Math.max(0, Number.isFinite(args.viewportH) ? args.viewportH : 0) / 2
  return screenToWorld({ transform: args.transform, sx, sy })
}

export const computeTransformScaleAboutViewportCenter = (args: {
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null
  viewportW: number
  viewportH: number
  nextK: number
}): { k: number; x: number; y: number } => {
  const nextK = Number.isFinite(args.nextK) ? Math.max(0.001, args.nextK) : 1
  const viewportW = Number.isFinite(args.viewportW) ? Math.max(1, Math.floor(args.viewportW)) : 1
  const viewportH = Number.isFinite(args.viewportH) ? Math.max(1, Math.floor(args.viewportH)) : 1
  const worldC = viewportCenterToWorld({ transform: args.transform, viewportW, viewportH })
  const nextCx = viewportW / 2
  const nextCy = viewportH / 2
  const nextX = nextCx - worldC.x * nextK
  const nextY = nextCy - worldC.y * nextK
  return { k: nextK, x: nextX, y: nextY }
}

export const adjustPinnedTransformForViewportChange = (args: {
  transform: ViewportTransform
  nextViewportW: number
  nextViewportH: number
}): { k: number; x: number; y: number } => {
  const k = Number.isFinite(args.transform.k) ? args.transform.k : 1
  const x = Number.isFinite(args.transform.x) ? args.transform.x : 0
  const y = Number.isFinite(args.transform.y) ? args.transform.y : 0
  const prevW = Number.isFinite(args.transform.viewportW) ? (args.transform.viewportW as number) : null
  const prevH = Number.isFinite(args.transform.viewportH) ? (args.transform.viewportH as number) : null
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

export const adjustPinnedZoomForViewportChange = (args: {
  zoom: ViewportTransform
  nextViewportW: number
  nextViewportH: number
}): { k: number; x: number; y: number } =>
  adjustPinnedTransformForViewportChange({
    transform: args.zoom,
    nextViewportW: args.nextViewportW,
    nextViewportH: args.nextViewportH,
  })

export const pickInitialPinnedAwareTransform = (args: {
  transform: ViewportTransform | null
  pinned: boolean
  graphDataRevision: number
  nextViewportW: number
  nextViewportH: number
}): { k: number; x: number; y: number } | null => {
  const z = args.transform
  if (!z) return null
  const sameRevision = z.graphDataRevision == null || z.graphDataRevision === args.graphDataRevision
  if (!args.pinned && !sameRevision) return null
  if (args.pinned) {
    return adjustPinnedTransformForViewportChange({
      transform: z,
      nextViewportW: args.nextViewportW,
      nextViewportH: args.nextViewportH,
    })
  }
  const k = Number.isFinite(z.k) ? z.k : 1
  const x = Number.isFinite(z.x) ? z.x : 0
  const y = Number.isFinite(z.y) ? z.y : 0
  return { k, x, y }
}

export const pickInitialZoomTransform = (args: {
  zoomState: ViewportTransform | null
  pinned: boolean
  graphDataRevision: number
  nextViewportW: number
  nextViewportH: number
}): { k: number; x: number; y: number } | null =>
  pickInitialPinnedAwareTransform({
    transform: args.zoomState,
    pinned: args.pinned,
    graphDataRevision: args.graphDataRevision,
    nextViewportW: args.nextViewportW,
    nextViewportH: args.nextViewportH,
  })
