export type ZoomStateQuantizeArgs = {
  scaleStep?: number
  translateStep?: number
}

const roundToStep = (value: number, step: number): number => {
  if (!Number.isFinite(value)) return value
  if (!Number.isFinite(step) || step <= 0) return value
  return Math.round(value / step) * step
}

export const quantizeZoomStateForCommit = <T extends { k: number; x: number; y: number }>(
  z: T,
  args?: ZoomStateQuantizeArgs,
): T => {
  const scaleStep = args?.scaleStep ?? 1e-4
  const translateStep = args?.translateStep ?? 0.1
  return {
    ...z,
    k: roundToStep(z.k, scaleStep),
    x: roundToStep(z.x, translateStep),
    y: roundToStep(z.y, translateStep),
  }
}
