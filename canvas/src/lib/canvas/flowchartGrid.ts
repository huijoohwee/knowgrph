import type { GraphSchema } from '@/lib/graph/schema'
import { snapScalarToGrid } from '@/lib/canvas/gridSnap'
import { readSnapGridScalarSize } from '@/lib/canvas/snapGridSize'

export const readFlowchartGridSizePx = (schema: GraphSchema | null | undefined): number => {
  return readSnapGridScalarSize((schema?.behavior?.snapGrid as { size?: unknown } | null)?.size)
}

export const readFlowchartLaneSeparationPx = (args: { schema: GraphSchema | null | undefined; frameW: number }): number => {
  const w = Number.isFinite(args.frameW) ? Math.max(1, Math.floor(args.frameW)) : 1
  const raw = Math.max(520, Math.floor(w * 0.36))
  const grid = readFlowchartGridSizePx(args.schema)
  return Math.max(grid, snapScalarToGrid(raw, grid))
}

export const readFlowchartRowStepPx = (schema: GraphSchema | null | undefined): number => {
  const grid = readFlowchartGridSizePx(schema)
  return Math.max(grid, snapScalarToGrid(20, grid))
}
