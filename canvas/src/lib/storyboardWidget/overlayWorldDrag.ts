import { readSnapGridConfigFromSchema, snapPointToGrid } from '@/lib/canvas/gridSnap'
import type { GraphSchema } from '@/lib/graph/schema'
import { screenToWorld, worldToScreen } from '@/lib/zoom/viewport'

export type StoryboardWidgetOverlayDragPoint = {
  x: number
  y: number
}

export type StoryboardWidgetOverlayDragTransform = {
  k: number
  x: number
  y: number
}

export type StoryboardWidgetOverlayScreenBox = {
  left: number
  top: number
  scale: number
}

export function readStoryboardWidgetOverlayCanvasOffset(el: Element | null): { left: number; top: number } {
  const rect = el?.getBoundingClientRect()
  return {
    left: rect && Number.isFinite(rect.left) ? rect.left : 0,
    top: rect && Number.isFinite(rect.top) ? rect.top : 0,
  }
}

export function computeStoryboardWidgetOverlayPointerGrabOffset(args: {
  transform: StoryboardWidgetOverlayDragTransform | null
  canvasOffset: { left: number; top: number }
  pointerClient: StoryboardWidgetOverlayDragPoint
  startWorld: StoryboardWidgetOverlayDragPoint
}): StoryboardWidgetOverlayDragPoint {
  const pointerWorld = screenToWorld({
    transform: args.transform,
    sx: args.pointerClient.x - args.canvasOffset.left,
    sy: args.pointerClient.y - args.canvasOffset.top,
  })
  return {
    x: pointerWorld.x - args.startWorld.x,
    y: pointerWorld.y - args.startWorld.y,
  }
}

export function computeStoryboardWidgetOverlayDraggedWorldPoint(args: {
  transform: StoryboardWidgetOverlayDragTransform | null
  canvasOffset: { left: number; top: number }
  pointerClient: StoryboardWidgetOverlayDragPoint
  grabOffsetWorld: StoryboardWidgetOverlayDragPoint
  baseWorld: StoryboardWidgetOverlayDragPoint
  schema?: GraphSchema | null
  snapToGrid?: boolean
}): StoryboardWidgetOverlayDragPoint {
  const pointerWorld = screenToWorld({
    transform: args.transform,
    sx: args.pointerClient.x - args.canvasOffset.left,
    sy: args.pointerClient.y - args.canvasOffset.top,
  })
  const next = {
    x: pointerWorld.x - args.grabOffsetWorld.x,
    y: pointerWorld.y - args.grabOffsetWorld.y,
  }
  const schema = args.schema || null
  const snapped = (() => {
    if (!schema || args.snapToGrid === false) return next
    const grid = readSnapGridConfigFromSchema(schema)
    return grid.enabled ? snapPointToGrid(next, grid) : next
  })()
  const constraint = schema?.behavior?.dragConstraint || 'free'
  if (constraint === 'axis-x') return { x: snapped.x, y: args.baseWorld.y }
  if (constraint === 'axis-y') return { x: args.baseWorld.x, y: snapped.y }
  if (constraint === 'none') return args.baseWorld
  return snapped
}

export function computeStoryboardWidgetOverlayScreenBox(args: {
  transform: StoryboardWidgetOverlayDragTransform | null
  centerWorld: StoryboardWidgetOverlayDragPoint
  width: number
  height: number
}): StoryboardWidgetOverlayScreenBox {
  const width = Number.isFinite(args.width) ? Math.max(1, args.width) : 1
  const height = Number.isFinite(args.height) ? Math.max(1, args.height) : 1
  const centerX = Number.isFinite(args.centerWorld.x) ? args.centerWorld.x : 0
  const centerY = Number.isFinite(args.centerWorld.y) ? args.centerWorld.y : 0
  const topLeft = worldToScreen({
    transform: args.transform,
    x: centerX - width / 2,
    y: centerY - height / 2,
  })
  const scale = args.transform && Number.isFinite(args.transform.k) ? Math.max(0.001, args.transform.k) : 1
  return {
    left: topLeft.sx,
    top: topLeft.sy,
    scale,
  }
}
