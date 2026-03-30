import type { GraphSchema } from '@/lib/graph/schema'
import { getThreeConfig } from '@/lib/graph/schema'
import { clampSnapGridSize } from '@/lib/canvas/snapGridSize'

export const resolveVoxelGridScaleFactorFromSchema = (schema: GraphSchema | null | undefined): number => {
  const threeCfg = getThreeConfig(schema || null)
  const raw = (threeCfg as unknown as { voxelGridScaleFactor?: unknown }).voxelGridScaleFactor
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1
  return Math.max(0.3, Math.min(3, n))
}

export const resolveVoxelGridStepFromSchema = (schema: GraphSchema | null | undefined): number => {
  const snapSizeRaw = (schema?.behavior?.snapGrid as { size?: unknown } | null)?.size
  const base = clampSnapGridSize(snapSizeRaw)
  const voxelGridScale = resolveVoxelGridScaleFactorFromSchema(schema)
  return clampSnapGridSize(Math.round(base * voxelGridScale))
}

export const quantizeVoxelCoordToGridLine = (value: number, gridStep: number): number => {
  const g = Math.max(1e-6, gridStep)
  return Math.round((Number.isFinite(value) ? value : 0) / g) * g
}

export const quantizeVoxelCoordToCellCenter = (value: number, gridStep: number): number => {
  const g = Math.max(1e-6, gridStep)
  const v = Number.isFinite(value) ? value : 0
  const scaled = v / g - 0.5
  const idx = scaled >= 0 ? Math.floor(scaled + 0.5) : -Math.floor(-scaled + 0.5)
  return idx * g + g * 0.5
}
