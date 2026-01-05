import { computeViewRect } from '@/features/minimap/math'

export const testComputeViewRect = () => {
  const vw = 800, vh = 600, sx = 0.2
  const t = { k: 2, x: 100, y: 50 }
  const r = computeViewRect(vw, vh, t.k, t.x, t.y, sx)
  const expected = {
    x: ((0 - t.x) / t.k) * sx,
    y: ((0 - t.y) / t.k) * sx,
    w: (vw / t.k) * sx,
    h: (vh / t.k) * sx,
  }
  if (Math.abs(r.x - expected.x) > 1e-6) throw new Error('viewRect x mismatch')
  if (Math.abs(r.y - expected.y) > 1e-6) throw new Error('viewRect y mismatch')
  if (Math.abs(r.w - expected.w) > 1e-6) throw new Error('viewRect w mismatch')
  if (Math.abs(r.h - expected.h) > 1e-6) throw new Error('viewRect h mismatch')
}
