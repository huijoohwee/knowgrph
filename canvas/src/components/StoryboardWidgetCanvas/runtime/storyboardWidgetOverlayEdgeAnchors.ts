import {
  buildEdgePathD,
  type EdgePathCurveOptions,
  type GlobalEdgeType,
} from '@/lib/graph/edgeTypes'

export type StoryboardOverlayAnchorSide = 'bottom' | 'left' | 'right' | 'top'

export type StoryboardOverlayRectLike = {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export type StoryboardOverlayRectAnchor = {
  side: StoryboardOverlayAnchorSide
  x: number
  y: number
}

const isFiniteOverlayRect = (rect: StoryboardOverlayRectLike | null | undefined): rect is StoryboardOverlayRectLike =>
  !!rect
  && Number.isFinite(rect.left)
  && Number.isFinite(rect.right)
  && Number.isFinite(rect.top)
  && Number.isFinite(rect.bottom)
  && Number.isFinite(rect.width)
  && Number.isFinite(rect.height)
  && rect.width > 0
  && rect.height > 0

const readRectCenter = (rect: StoryboardOverlayRectLike): { x: number; y: number } => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
})

export function readNearestStoryboardOverlayAnchorSide(args: {
  fallbackSide: StoryboardOverlayAnchorSide
  fromRect: StoryboardOverlayRectLike
  toRect: StoryboardOverlayRectLike
}): StoryboardOverlayAnchorSide {
  if (!isFiniteOverlayRect(args.fromRect) || !isFiniteOverlayRect(args.toRect)) return args.fallbackSide
  const fromCenter = readRectCenter(args.fromRect)
  const toCenter = readRectCenter(args.toRect)
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return args.fallbackSide
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return args.fallbackSide
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

export function readStoryboardOverlayRectSideAnchor(
  rect: StoryboardOverlayRectLike,
  side: StoryboardOverlayAnchorSide,
): StoryboardOverlayRectAnchor | null {
  if (!isFiniteOverlayRect(rect)) return null
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  if (side === 'left') return { side, x: rect.left, y: centerY }
  if (side === 'right') return { side, x: rect.right, y: centerY }
  if (side === 'top') return { side, x: centerX, y: rect.top }
  return { side, x: centerX, y: rect.bottom }
}

export function readNearestStoryboardOverlayRectAnchors(args: {
  sourceRect: StoryboardOverlayRectLike
  targetRect: StoryboardOverlayRectLike
}): { source: StoryboardOverlayRectAnchor; target: StoryboardOverlayRectAnchor } | null {
  if (!isFiniteOverlayRect(args.sourceRect) || !isFiniteOverlayRect(args.targetRect)) return null
  const sourceSide = readNearestStoryboardOverlayAnchorSide({
    fallbackSide: 'right',
    fromRect: args.sourceRect,
    toRect: args.targetRect,
  })
  const targetSide = readNearestStoryboardOverlayAnchorSide({
    fallbackSide: 'left',
    fromRect: args.targetRect,
    toRect: args.sourceRect,
  })
  const source = readStoryboardOverlayRectSideAnchor(args.sourceRect, sourceSide)
  const target = readStoryboardOverlayRectSideAnchor(args.targetRect, targetSide)
  return source && target ? { source, target } : null
}

export function readStoryboardOutputCardLeftSideAnchors(args: {
  outputCardRect: StoryboardOverlayRectLike
  sourceCardRect: StoryboardOverlayRectLike
}): { source: StoryboardOverlayRectAnchor; target: StoryboardOverlayRectAnchor } | null {
  if (!isFiniteOverlayRect(args.sourceCardRect) || !isFiniteOverlayRect(args.outputCardRect)) return null
  const sourceSide = readNearestStoryboardOverlayAnchorSide({
    fallbackSide: 'right',
    fromRect: args.sourceCardRect,
    toRect: args.outputCardRect,
  })
  const source = readStoryboardOverlayRectSideAnchor(args.sourceCardRect, sourceSide)
  const target = readStoryboardOverlayRectSideAnchor(args.outputCardRect, 'left')
  return source && target ? { source, target } : null
}

export function clampStoryboardOverlayScreenXToLocalViewportBounds(args: {
  marginLeft: number
  marginRight: number
  rootLeft: number
  rootWidth: number
  screenX: number
}): number {
  const rootLeft = Number.isFinite(args.rootLeft) ? args.rootLeft : 0
  const rootWidth = Number.isFinite(args.rootWidth) && args.rootWidth > 0 ? args.rootWidth : 1
  const marginLeft = Number.isFinite(args.marginLeft) ? Math.max(0, args.marginLeft) : 0
  const marginRight = Number.isFinite(args.marginRight) ? Math.max(0, args.marginRight) : 0
  const minLocalX = Math.min(rootWidth, marginLeft)
  const maxLocalX = Math.max(minLocalX, rootWidth - marginRight)
  const localX = (Number.isFinite(args.screenX) ? args.screenX : rootLeft) - rootLeft
  const clampedLocalX = Math.max(minLocalX, Math.min(maxLocalX, localX))
  return rootLeft + clampedLocalX
}

export function buildStoryboardOutputCardLeftSidePath(args: {
  source: Pick<StoryboardOverlayRectAnchor, 'x' | 'y'>
  target: Pick<StoryboardOverlayRectAnchor, 'x' | 'y'>
}): string {
  const sx = Number.isFinite(args.source.x) ? args.source.x : 0
  const sy = Number.isFinite(args.source.y) ? args.source.y : 0
  const tx = Number.isFinite(args.target.x) ? args.target.x : sx
  const ty = Number.isFinite(args.target.y) ? args.target.y : sy
  const dx = tx - sx
  const dy = ty - sy
  if (Math.abs(dx) < 0.01 || Math.abs(dy) < 0.01) return `M${sx},${sy} L${tx},${ty}`
  const horizontalSign = dx >= 0 ? 1 : -1
  const verticalSign = dy >= 0 ? 1 : -1
  const cornerRadius = Math.min(24, Math.max(2, Math.min(Math.abs(dx) * 0.45, Math.abs(dy) * 0.5)))
  const cornerStartX = tx - horizontalSign * cornerRadius
  const cornerEndY = sy + verticalSign * cornerRadius
  return `M${sx},${sy} L${cornerStartX},${sy} Q${tx},${sy} ${tx},${cornerEndY} L${tx},${ty}`
}

function buildStoryboardForwardTrackPath(args: {
  sx: number
  sy: number
  tx: number
  ty: number
}): string {
  const sx = Number.isFinite(args.sx) ? args.sx : 0
  const sy = Number.isFinite(args.sy) ? args.sy : 0
  const tx = Number.isFinite(args.tx) ? args.tx : sx
  const ty = Number.isFinite(args.ty) ? args.ty : sy
  const dx = tx - sx
  const dy = ty - sy
  const laneGap = Math.max(36, Math.min(160, Math.abs(dx) * 0.2 + Math.abs(dy) * 0.08))
  const laneX = Math.max(sx, tx) + laneGap
  const verticalSign = dy >= 0 ? 1 : -1
  const cornerRadius = Math.min(24, Math.max(2, Math.min(Math.abs(dy) * 0.5, laneGap * 0.18)))
  if (Math.abs(dy) < 0.01) {
    const trackY = sy + Math.max(36, laneGap * 0.5)
    return `M${sx},${sy} L${laneX},${sy} L${laneX},${trackY} L${tx},${trackY} L${tx},${ty}`
  }
  return `M${sx},${sy} L${laneX - cornerRadius},${sy} Q${laneX},${sy} ${laneX},${sy + verticalSign * cornerRadius} L${laneX},${ty - verticalSign * cornerRadius} Q${laneX},${ty} ${laneX - cornerRadius},${ty} L${tx},${ty}`
}

export function buildStoryboardOverlayEdgePathD(args: {
  curve?: EdgePathCurveOptions | null
  edgeType: GlobalEdgeType
  flowForwardTrack?: boolean
  outputCardLeftSide: boolean
  rankdir?: 'TB' | 'LR' | null
  sx: number
  sy: number
  tx: number
  ty: number
}): string {
  if (args.outputCardLeftSide) return buildStoryboardOutputCardLeftSidePath({ source: { x: args.sx, y: args.sy }, target: { x: args.tx, y: args.ty } })
  if (args.flowForwardTrack && args.rankdir === 'LR' && args.tx < args.sx - 0.01) return buildStoryboardForwardTrackPath(args)
  return buildEdgePathD(args)
}
