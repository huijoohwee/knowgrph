import type { GraphSchema } from '@/lib/graph/schema'
import { clampSnapGridSize, SNAP_GRID_SIZE_DEFAULT, SNAP_GRID_SIZE_MAX, SNAP_GRID_SIZE_MIN } from '@/lib/canvas/snapGridSize'
import { quantizeVoxelCoordToCellCenter, resolveVoxelGridStepFromSchema } from '@/lib/canvas/voxelGrid'

export type SnapGridConfig = {
  enabled: boolean
  size: number
}

export { SNAP_GRID_SIZE_DEFAULT, SNAP_GRID_SIZE_MIN, SNAP_GRID_SIZE_MAX, clampSnapGridSize }

export const readSnapGridConfigFromSchema = (schema: GraphSchema | null | undefined): SnapGridConfig => {
  const g = schema?.behavior?.snapGrid
  const enabled = !!(g && g.enabled)
  const size = resolveVoxelGridStepFromSchema(schema)
  return { enabled, size }
}

export const snapScalarToGrid = (value: number, gridSize: number): number => {
  const v = Number.isFinite(value) ? value : 0
  const s = clampSnapGridSize(gridSize)
  return Math.round(v / s) * s
}

export const snapScalarToGridCellCenter = (value: number, gridSize: number): number => {
  const s = clampSnapGridSize(gridSize)
  return quantizeVoxelCoordToCellCenter(value, s)
}

export const snapPointToGrid = (p: { x: number; y: number }, gridSize: number): { x: number; y: number } => {
  return {
    x: snapScalarToGrid(p.x, gridSize),
    y: snapScalarToGrid(p.y, gridSize),
  }
}

export const snapDeltaToGridByAnchor = (args: {
  anchorStart: { x: number; y: number } | null
  rawDelta: { dx: number; dy: number }
  gridSize: number
}): { dx: number; dy: number } => {
  const a = args.anchorStart
  const dx = Number.isFinite(args.rawDelta.dx) ? args.rawDelta.dx : 0
  const dy = Number.isFinite(args.rawDelta.dy) ? args.rawDelta.dy : 0
  if (!a) return { dx, dy }
  const s = clampSnapGridSize(args.gridSize)
  const next = snapPointToGrid({ x: a.x + dx, y: a.y + dy }, s)
  return { dx: next.x - a.x, dy: next.y - a.y }
}
