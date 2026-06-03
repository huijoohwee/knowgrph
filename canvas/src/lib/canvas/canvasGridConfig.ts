import type { GraphSchema } from '@/lib/graph/schema'
import { resolveVoxelGridStepFromSchema } from '@/lib/canvas/voxelGrid'

export type CanvasGridVariant = 'lines' | 'dots'

export type CanvasGridConfig = {
  enabled: boolean
  variant: CanvasGridVariant
  majorEvery: number
  dotRadiusPx: number
  minorAlpha: number
  majorAlpha: number
  minorWidthPx: number
  majorWidthPx: number
  minorStroke: string | null
  majorStroke: string | null
}

export type CanvasGridRenderConfig = {
  enabled: true
  size: number
  variant: CanvasGridVariant
  majorEvery: number
  dotRadiusPx: number
  minorAlpha: number
  majorAlpha: number
  minorWidthPx: number
  majorWidthPx: number
  minorStroke: string | null
  majorStroke: string | null
  anchor: 'cellCenter'
  lockToBaseStep: true
}

export const CANVAS_GRID_DOT_RADIUS_PX_DEFAULT = 1.25
export const CANVAS_GRID_DOT_RADIUS_PX_MIN = 0.5
export const CANVAS_GRID_DOT_RADIUS_PX_MAX = 6

export const CANVAS_GRID_MINOR_ALPHA_DEFAULT = 0.16
export const CANVAS_GRID_MAJOR_ALPHA_DEFAULT = 0.34
export const CANVAS_GRID_ALPHA_MIN = 0
export const CANVAS_GRID_ALPHA_MAX = 1

export const clampCanvasGridAlpha = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  const v = Number.isFinite(n) ? n : fallback
  return Math.max(CANVAS_GRID_ALPHA_MIN, Math.min(CANVAS_GRID_ALPHA_MAX, v))
}

export const CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT = 1
export const CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT = 1.25
export const CANVAS_GRID_WIDTH_PX_MIN = 0.5
export const CANVAS_GRID_WIDTH_PX_MAX = 4

export const clampCanvasGridWidthPx = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  const v = Number.isFinite(n) ? n : fallback
  return Math.max(CANVAS_GRID_WIDTH_PX_MIN, Math.min(CANVAS_GRID_WIDTH_PX_MAX, v))
}

export const coerceCanvasGridStroke = (value: unknown): string | null => {
  const v = typeof value === 'string' ? value.trim() : ''
  return v ? v : null
}

export const clampCanvasGridDotRadiusPx = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  const v = Number.isFinite(n) ? n : CANVAS_GRID_DOT_RADIUS_PX_DEFAULT
  return Math.max(CANVAS_GRID_DOT_RADIUS_PX_MIN, Math.min(CANVAS_GRID_DOT_RADIUS_PX_MAX, v))
}

export const clampCanvasGridMajorEvery = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  const v = Number.isFinite(n) ? Math.floor(n) : 5
  return Math.max(2, Math.min(20, v))
}

export const coerceCanvasGridVariant = (value: unknown): CanvasGridVariant => {
  const v = String(value || '').trim()
  if (v === 'dots') return 'dots'
  return 'lines'
}

export const readCanvasGridConfigFromSchema = (schema: GraphSchema | null | undefined): CanvasGridConfig => {
  const g = (schema?.behavior as unknown as { canvasGrid?: unknown } | null)?.canvasGrid as
    | { enabled?: unknown; variant?: unknown; majorEvery?: unknown; dotRadiusPx?: unknown; minorAlpha?: unknown; majorAlpha?: unknown; minorWidthPx?: unknown; majorWidthPx?: unknown; minorStroke?: unknown; majorStroke?: unknown }
    | null

  const enabled = !!(g && g.enabled)
  const variant = coerceCanvasGridVariant(g?.variant)
  const majorEvery = clampCanvasGridMajorEvery(g?.majorEvery)
  const dotRadiusPx = clampCanvasGridDotRadiusPx(g?.dotRadiusPx)
  const minorAlpha = clampCanvasGridAlpha(g?.minorAlpha, CANVAS_GRID_MINOR_ALPHA_DEFAULT)
  const majorAlpha = clampCanvasGridAlpha(g?.majorAlpha, CANVAS_GRID_MAJOR_ALPHA_DEFAULT)
  const minorWidthPx = clampCanvasGridWidthPx(g?.minorWidthPx, CANVAS_GRID_MINOR_WIDTH_PX_DEFAULT)
  const majorWidthPx = clampCanvasGridWidthPx(g?.majorWidthPx, CANVAS_GRID_MAJOR_WIDTH_PX_DEFAULT)
  const minorStroke = coerceCanvasGridStroke(g?.minorStroke)
  const majorStroke = coerceCanvasGridStroke(g?.majorStroke)
  return { enabled, variant, majorEvery, dotRadiusPx, minorAlpha, majorAlpha, minorWidthPx, majorWidthPx, minorStroke, majorStroke }
}

export const readCanvasGridWorldStepFromSchema = (schema: GraphSchema | null | undefined): number => {
  return resolveVoxelGridStepFromSchema(schema)
}

export const readCanvasGridRenderConfigFromSchema = (schema: GraphSchema | null | undefined): CanvasGridRenderConfig | null => {
  const grid = readCanvasGridConfigFromSchema(schema)
  if (!grid.enabled) return null
  return {
    enabled: true,
    size: readCanvasGridWorldStepFromSchema(schema),
    variant: grid.variant,
    majorEvery: grid.majorEvery,
    dotRadiusPx: grid.dotRadiusPx,
    minorAlpha: grid.minorAlpha,
    majorAlpha: grid.majorAlpha,
    minorWidthPx: grid.minorWidthPx,
    majorWidthPx: grid.majorWidthPx,
    minorStroke: grid.minorStroke,
    majorStroke: grid.majorStroke,
    anchor: 'cellCenter',
    lockToBaseStep: true,
  }
}
