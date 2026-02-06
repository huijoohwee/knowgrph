import { computeD3WheelDelta, computeWheelZoomFactor, normalizeWheelDeltaYpx } from '@/lib/canvas/zoom-input'

function approxEqual(a: number, b: number, eps: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps
}

export function testCanvasZoomWheelParityBetweenD3AndNative() {
  const cases: Array<{ deltaY: number; deltaMode: number }> = [
    { deltaY: 120, deltaMode: 0 },
    { deltaY: -120, deltaMode: 0 },
    { deltaY: 3, deltaMode: 1 },
    { deltaY: -3, deltaMode: 1 },
    { deltaY: 1, deltaMode: 2 },
  ]

  for (const c of cases) {
    const deltaYpx = normalizeWheelDeltaYpx(c)
    const nativeFactor = computeWheelZoomFactor(deltaYpx)
    const d3Factor = Math.pow(2, computeD3WheelDelta(c))
    if (!approxEqual(nativeFactor, d3Factor, 1e-12)) {
      throw new Error(
        `expected D3 and native wheel zoom factor to match: deltaY=${c.deltaY} mode=${c.deltaMode} native=${nativeFactor} d3=${d3Factor}`,
      )
    }
  }
}
