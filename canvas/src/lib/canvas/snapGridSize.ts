export const SNAP_GRID_SIZE_DEFAULT = 10
export const SNAP_GRID_SIZE_MIN = 2
export const SNAP_GRID_SIZE_MAX = 500
export type SnapGridTuple = readonly [number, number]

export const clampSnapGridSize = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  const floored = Number.isFinite(n) ? Math.floor(n) : SNAP_GRID_SIZE_DEFAULT
  return Math.max(SNAP_GRID_SIZE_MIN, Math.min(SNAP_GRID_SIZE_MAX, floored))
}

export const coerceSnapGridTuple = (value: unknown): SnapGridTuple => {
  if (Array.isArray(value)) {
    const x = clampSnapGridSize(value[0])
    const y = clampSnapGridSize(value.length > 1 ? value[1] : value[0])
    return [x, y]
  }
  const size = clampSnapGridSize(value)
  return [size, size]
}

export const readSnapGridScalarSize = (value: unknown): number => coerceSnapGridTuple(value)[0]
