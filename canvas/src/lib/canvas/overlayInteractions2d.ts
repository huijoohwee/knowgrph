import * as d3 from 'd3'

import { clampCanvasInteractionSpeedMultiplier, clampCanvasPanSpeedMultiplier } from '@/lib/canvas/camera-options-2d'
import { readSnapGridConfigFromSchema, snapPointToGrid } from '@/lib/canvas/gridSnap'
import type { GraphSchema } from '@/lib/graph/schema'

export function computeOverlayPanTransform2d(args: {
  startTransform: d3.ZoomTransform
  dxClientPx: number
  dyClientPx: number
  canvasPanSpeedMultiplier: unknown
  canvasInteractionSpeedMultiplier: unknown
  applySpeedMultipliers?: boolean
}): d3.ZoomTransform {
  const applySpeed = args.applySpeedMultipliers === true
  const interactionSpeed = (() => {
    if (!applySpeed) return 1
    const panMultRaw = typeof args.canvasPanSpeedMultiplier === 'number' ? args.canvasPanSpeedMultiplier : Number(args.canvasPanSpeedMultiplier)
    const interactionMultRaw =
      typeof args.canvasInteractionSpeedMultiplier === 'number'
        ? args.canvasInteractionSpeedMultiplier
        : Number(args.canvasInteractionSpeedMultiplier)
    return (
      clampCanvasPanSpeedMultiplier(Number.isFinite(panMultRaw) ? panMultRaw : 1) *
      clampCanvasInteractionSpeedMultiplier(Number.isFinite(interactionMultRaw) ? interactionMultRaw : 1)
    )
  })()
  const dx = Number(args.dxClientPx) * interactionSpeed
  const dy = Number(args.dyClientPx) * interactionSpeed
  return d3.zoomIdentity.translate(args.startTransform.x + dx, args.startTransform.y + dy).scale(args.startTransform.k)
}

export function computeOverlayDraggedPoint2d(args: {
  baseX: number
  baseY: number
  dxClientPx: number
  dyClientPx: number
  zoomK: number
  schema: GraphSchema
  snapToGrid?: boolean
}): { x: number; y: number } {
  const k = Number.isFinite(args.zoomK) && args.zoomK > 0 ? args.zoomK : 1
  const nx = args.baseX + Number(args.dxClientPx) / k
  const ny = args.baseY + Number(args.dyClientPx) / k
  const grid = readSnapGridConfigFromSchema(args.schema)
  const snap = args.snapToGrid !== false
  const snapped = snap && grid.enabled ? snapPointToGrid({ x: nx, y: ny }, grid.size) : { x: nx, y: ny }
  const constraint = args.schema.behavior.dragConstraint || 'free'
  if (constraint === 'axis-x') return { x: snapped.x, y: args.baseY }
  if (constraint === 'axis-y') return { x: args.baseX, y: snapped.y }
  if (constraint === 'none') return { x: args.baseX, y: args.baseY }
  return { x: snapped.x, y: snapped.y }
}
