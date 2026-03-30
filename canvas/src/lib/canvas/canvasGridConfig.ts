import type { GraphSchema } from '@/lib/graph/schema'
import { clampSnapGridSize } from '@/lib/canvas/gridSnap'

export type CanvasGridVariant = 'lines' | 'dots'

export type CanvasGridConfig = {
  enabled: boolean
  variant: CanvasGridVariant
  majorEvery: number
  dotRadiusPx: number
}

export type CanvasGridRenderConfig = {
  enabled: true
  size: number
  variant: CanvasGridVariant
  majorEvery: number
  dotRadiusPx: number
}

export const CANVAS_GRID_DOT_RADIUS_PX_DEFAULT = 1
export const CANVAS_GRID_DOT_RADIUS_PX_MIN = 0.5
export const CANVAS_GRID_DOT_RADIUS_PX_MAX = 6

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
  if (v === 'lines') return 'lines'
  return 'dots'
}

export const readCanvasGridConfigFromSchema = (schema: GraphSchema | null | undefined): CanvasGridConfig => {
  const g = (schema?.behavior as unknown as { canvasGrid?: unknown } | null)?.canvasGrid as
    | { enabled?: unknown; variant?: unknown; majorEvery?: unknown; dotRadiusPx?: unknown }
    | null

  const enabled = !!(g && g.enabled)
  const variant = coerceCanvasGridVariant(g?.variant)
  const majorEvery = clampCanvasGridMajorEvery(g?.majorEvery)
  const dotRadiusPx = clampCanvasGridDotRadiusPx(g?.dotRadiusPx)
  return { enabled, variant, majorEvery, dotRadiusPx }
}

export const readCanvasGridWorldStepFromSchema = (schema: GraphSchema | null | undefined): number => {
  const snap = (schema?.behavior as unknown as { snapGrid?: unknown } | null)?.snapGrid as { size?: unknown } | null
  return clampSnapGridSize(snap?.size)
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
  }
}
