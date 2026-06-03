import type { GraphSchema } from '@/lib/graph/schema'
import { clampSnapGridSize, coerceSnapGridTuple, SNAP_GRID_SIZE_DEFAULT, SNAP_GRID_SIZE_MAX, SNAP_GRID_SIZE_MIN, type SnapGridTuple } from '@/lib/canvas/snapGridSize'
import { quantizeVoxelCoordToCellCenter, resolveVoxelGridScaleFactorFromSchema, resolveVoxelGridStepFromSchema } from '@/lib/canvas/voxelGrid'

export type SnapGridConfig = {
  enabled: boolean
  size: number
  x: number
  y: number
  grid: SnapGridTuple
}

export { SNAP_GRID_SIZE_DEFAULT, SNAP_GRID_SIZE_MIN, SNAP_GRID_SIZE_MAX, clampSnapGridSize }

export type SnapGridAxis = 'x' | 'y'
export type SnapGridSizeLike =
  | number
  | SnapGridTuple
  | {
      size?: unknown
      grid?: unknown
      x?: unknown
      y?: unknown
    }

const readSnapGridSizeInput = (snapGrid: unknown): unknown => {
  if (!snapGrid || typeof snapGrid !== 'object' || Array.isArray(snapGrid)) return snapGrid
  const record = snapGrid as { size?: unknown; grid?: unknown; snapGrid?: unknown }
  if (Array.isArray(record.grid)) return record.grid
  if (Array.isArray(record.size) || typeof record.size === 'number') return record.size
  if (Array.isArray(record.snapGrid)) return record.snapGrid
  return record.size
}

const scaleSnapGridTuple = (tuple: SnapGridTuple, scale: number): SnapGridTuple => {
  const factor = typeof scale === 'number' && Number.isFinite(scale) ? Math.max(0.001, scale) : 1
  return [
    clampSnapGridSize(Math.round(tuple[0] * factor)),
    clampSnapGridSize(Math.round(tuple[1] * factor)),
  ]
}

export const readSnapGridTupleFromSize = (size: unknown): SnapGridTuple => coerceSnapGridTuple(size)

export const readSnapGridAxisSize = (gridSize: SnapGridSizeLike, axis: SnapGridAxis): number => {
  if (typeof gridSize === 'number' || Array.isArray(gridSize)) {
    const tuple = coerceSnapGridTuple(gridSize)
    return axis === 'y' ? tuple[1] : tuple[0]
  }
  const record = gridSize && typeof gridSize === 'object' ? gridSize as { size?: unknown; grid?: unknown; x?: unknown; y?: unknown } : null
  const axisValue = axis === 'y' ? record?.y : record?.x
  if (typeof axisValue === 'number' && Number.isFinite(axisValue)) return clampSnapGridSize(axisValue)
  return coerceSnapGridTuple(readSnapGridSizeInput(record))[axis === 'y' ? 1 : 0]
}

export const readSnapGridConfigFromSchema = (schema: GraphSchema | null | undefined): SnapGridConfig => {
  const g = schema?.behavior?.snapGrid
  const enabled = !!(g && g.enabled)
  const rawTuple = coerceSnapGridTuple(readSnapGridSizeInput(g))
  const scaledTuple = scaleSnapGridTuple(rawTuple, resolveVoxelGridScaleFactorFromSchema(schema))
  const size = Array.isArray(readSnapGridSizeInput(g)) ? scaledTuple[0] : resolveVoxelGridStepFromSchema(schema)
  return { enabled, size, x: scaledTuple[0], y: scaledTuple[1], grid: scaledTuple }
}

export const snapScalarToGrid = (value: number, gridSize: SnapGridSizeLike, axis: SnapGridAxis = 'x'): number => {
  const v = Number.isFinite(value) ? value : 0
  const s = readSnapGridAxisSize(gridSize, axis)
  return Math.round(v / s) * s
}

export const snapScalarToGridCellCenter = (value: number, gridSize: SnapGridSizeLike, axis: SnapGridAxis = 'x'): number => {
  const s = readSnapGridAxisSize(gridSize, axis)
  return quantizeVoxelCoordToCellCenter(value, s)
}

export const snapPointToGrid = (p: { x: number; y: number }, gridSize: SnapGridSizeLike): { x: number; y: number } => {
  return {
    x: snapScalarToGrid(p.x, gridSize, 'x'),
    y: snapScalarToGrid(p.y, gridSize, 'y'),
  }
}

export const snapDeltaToGridByAnchor = (args: {
  anchorStart: { x: number; y: number } | null
  rawDelta: { dx: number; dy: number }
  gridSize: SnapGridSizeLike
}): { dx: number; dy: number } => {
  const a = args.anchorStart
  const dx = Number.isFinite(args.rawDelta.dx) ? args.rawDelta.dx : 0
  const dy = Number.isFinite(args.rawDelta.dy) ? args.rawDelta.dy : 0
  if (!a) return { dx, dy }
  const next = snapPointToGrid({ x: a.x + dx, y: a.y + dy }, args.gridSize)
  return { dx: next.x - a.x, dy: next.y - a.y }
}
