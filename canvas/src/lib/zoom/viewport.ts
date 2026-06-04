export type ViewportTransform = {
  k: number
  x: number
  y: number
  graphDataRevision?: number
  viewportW?: number
  viewportH?: number
}

export type ViewportFrame = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
}

export type ZoomScaleExtentLike =
  | { minK?: number; maxK?: number; minScale?: number; maxScale?: number }
  | null
  | undefined

export type ContextualZoomDetail = {
  k: number
  threshold: number
  showContent: boolean
  hidden: boolean
}

const readFinite = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const clampViewportScale = (k: unknown, extent?: ZoomScaleExtentLike): number => {
  const value = Math.max(0.001, readFinite(k) ?? 1)
  const rawMin = readFinite(extent && 'minK' in extent ? extent.minK : extent?.minScale)
  const rawMax = readFinite(extent && 'maxK' in extent ? extent.maxK : extent?.maxScale)
  const min = rawMin != null ? Math.max(0.001, rawMin) : 0.001
  const max = rawMax != null ? Math.max(min, rawMax) : Number.POSITIVE_INFINITY
  return Math.max(min, Math.min(max, value))
}

export const normalizeViewportFrame = (args: {
  viewportW: number
  viewportH: number
  left?: number
  top?: number
  width?: number
  height?: number
}): ViewportFrame => {
  const viewportW = Math.max(1, Math.floor(readFinite(args.viewportW) ?? 1))
  const viewportH = Math.max(1, Math.floor(readFinite(args.viewportH) ?? 1))
  const left = Math.max(0, Math.min(viewportW - 1, readFinite(args.left) ?? 0))
  const top = Math.max(0, Math.min(viewportH - 1, readFinite(args.top) ?? 0))
  const width = Math.max(1, Math.min(viewportW - left, readFinite(args.width) ?? viewportW))
  const height = Math.max(1, Math.min(viewportH - top, readFinite(args.height) ?? viewportH))
  const right = left + width
  const bottom = top + height
  return {
    left,
    top,
    right,
    bottom,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
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
  const viewportW = Number.isFinite(args.viewportW) ? Math.max(1, Math.floor(args.viewportW)) : 1
  const viewportH = Number.isFinite(args.viewportH) ? Math.max(1, Math.floor(args.viewportH)) : 1
  return computeTransformScaleAboutScreenPoint({
    transform: args.transform,
    focalX: viewportW / 2,
    focalY: viewportH / 2,
    nextK: args.nextK,
  })
}

export const computeTransformScaleAboutViewportFrameCenter = (args: {
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null
  viewport: Pick<ViewportFrame, 'centerX' | 'centerY'> | { viewportW: number; viewportH: number; left?: number; top?: number; width?: number; height?: number }
  nextK: number
}): { k: number; x: number; y: number } => {
  const frame = 'centerX' in args.viewport && 'centerY' in args.viewport
    ? args.viewport
    : normalizeViewportFrame(args.viewport)
  return computeTransformScaleAboutScreenPoint({
    transform: args.transform,
    focalX: frame.centerX,
    focalY: frame.centerY,
    nextK: args.nextK,
  })
}

export const computeTransformScaleAboutScreenPoint = (args: {
  transform: Pick<ViewportTransform, 'k' | 'x' | 'y'> | null
  focalX: number
  focalY: number
  nextK: number
}): { k: number; x: number; y: number } => {
  const nextK = Number.isFinite(args.nextK) ? Math.max(0.001, args.nextK) : 1
  const focalX = Number.isFinite(args.focalX) ? Number(args.focalX) : 0
  const focalY = Number.isFinite(args.focalY) ? Number(args.focalY) : 0
  const worldC = screenToWorld({ transform: args.transform, sx: focalX, sy: focalY })
  const nextX = focalX - worldC.x * nextK
  const nextY = focalY - worldC.y * nextK
  return { k: nextK, x: nextX, y: nextY }
}

export const computeTransformFromWorldCenter = (args: {
  viewportW: number
  viewportH: number
  worldX: number
  worldY: number
  k: number
  scaleExtent?: ZoomScaleExtentLike
}): { k: number; x: number; y: number } => {
  const viewportW = Math.max(1, Math.floor(readFinite(args.viewportW) ?? 1))
  const viewportH = Math.max(1, Math.floor(readFinite(args.viewportH) ?? 1))
  const worldX = readFinite(args.worldX) ?? 0
  const worldY = readFinite(args.worldY) ?? 0
  const k = clampViewportScale(args.k, args.scaleExtent)
  return {
    k,
    x: viewportW / 2 - worldX * k,
    y: viewportH / 2 - worldY * k,
  }
}

export const computeTransformFromWorldTopLeft = (args: {
  viewportW: number
  viewportH: number
  worldX: number
  worldY: number
  k: number
  scaleExtent?: ZoomScaleExtentLike
}): { k: number; x: number; y: number } => {
  const viewportW = Math.max(1, Math.floor(readFinite(args.viewportW) ?? 1))
  const viewportH = Math.max(1, Math.floor(readFinite(args.viewportH) ?? 1))
  const k = clampViewportScale(args.k, args.scaleExtent)
  const worldW = viewportW / k
  const worldH = viewportH / k
  return computeTransformFromWorldCenter({
    viewportW,
    viewportH,
    worldX: (readFinite(args.worldX) ?? 0) + worldW / 2,
    worldY: (readFinite(args.worldY) ?? 0) + worldH / 2,
    k,
    scaleExtent: { minK: k, maxK: k },
  })
}

export const resolveContextualZoomDetail = (args: {
  k: number
  contentThreshold?: number
}): ContextualZoomDetail => {
  const k = clampViewportScale(args.k)
  const threshold = Math.max(0, readFinite(args.contentThreshold) ?? 0)
  const showContent = threshold <= 0 || k >= threshold
  return {
    k,
    threshold,
    showContent,
    hidden: !showContent,
  }
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
