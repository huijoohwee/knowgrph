export function easeOutCubic01(t: number): number {
  if (!(t > 0)) return 0
  if (!(t < 1)) return 1
  const u = 1 - t
  return 1 - u * u * u
}

export function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function computeFlowWheelZoomDurationMs(args: { deltaYpxAbs: number; minMs: number; maxMs: number }): number {
  const safe = Number.isFinite(args.deltaYpxAbs) ? args.deltaYpxAbs : 0
  const minMs = Number.isFinite(args.minMs) ? Math.max(0, Math.floor(args.minMs)) : 0
  const maxMs = Number.isFinite(args.maxMs) ? Math.max(minMs, Math.floor(args.maxMs)) : minMs
  const scaled = minMs + Math.min(Math.max(0, maxMs - minMs), safe * 0.18)
  return Math.max(minMs, Math.min(maxMs, Math.round(scaled)))
}

