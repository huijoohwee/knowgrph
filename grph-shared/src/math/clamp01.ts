export const clamp01 = (value: number): number => {
  const v = Number.isFinite(value) ? value : 0
  if (v <= 0) return 0
  if (v >= 1) return 1
  return v
}

