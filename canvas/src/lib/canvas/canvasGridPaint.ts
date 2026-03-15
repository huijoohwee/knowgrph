import type { GraphSchema } from '@/lib/graph/schema'
import type { InfiniteGridPaint } from '@/lib/canvas/infiniteGrid'
import { getKgThemeFromDom, getKgTokenFallback } from '@/lib/ui/tokens-ssot'
import { readCanvasGridConfigFromSchema } from '@/lib/canvas/canvasGridConfig'

export const readCanvasGridPaintFromSchema = (schema: GraphSchema | null | undefined): Pick<InfiniteGridPaint, 'variant' | 'majorEvery' | 'dotRadiusPx'> => {
  const cfg = readCanvasGridConfigFromSchema(schema)
  return {
    variant: cfg.variant,
    majorEvery: cfg.majorEvery,
    dotRadiusPx: cfg.dotRadiusPx,
  }
}

export const readCanvasGridStrokeFallbacks = (): { minor: string; major: string } => {
  const theme = getKgThemeFromDom()
  return {
    minor: getKgTokenFallback('--kg-canvas-grid-minor', theme),
    major: getKgTokenFallback('--kg-canvas-grid-major', theme),
  }
}

