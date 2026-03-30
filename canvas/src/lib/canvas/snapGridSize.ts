export const SNAP_GRID_SIZE_DEFAULT = 10
export const SNAP_GRID_SIZE_MIN = 2
export const SNAP_GRID_SIZE_MAX = 500

export const clampSnapGridSize = (value: unknown): number => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  const floored = Number.isFinite(n) ? Math.floor(n) : SNAP_GRID_SIZE_DEFAULT
  return Math.max(SNAP_GRID_SIZE_MIN, Math.min(SNAP_GRID_SIZE_MAX, floored))
}

