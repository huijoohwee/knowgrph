import { quantizeZoomStateForCommit } from '@/lib/zoom/zoomStateQuantize'

export const testZoomStateQuantizeDefaults = () => {
  const z = { k: 1.00000001, x: 10.0001, y: -5.0001 }
  const q = quantizeZoomStateForCommit(z)
  if (q.k !== 1) throw new Error(`expected k to round to 1, got ${q.k}`)
  if (Math.abs(q.x - 10) > 0.25) throw new Error(`expected x to stay near 10, got ${q.x}`)
  if (Math.abs(q.y + 5) > 0.25) throw new Error(`expected y to stay near -5, got ${q.y}`)
}

export const testZoomStateQuantizeCustomSteps = () => {
  const z = { k: 1.234567, x: 10.49, y: 10.51 }
  const q = quantizeZoomStateForCommit(z, { scaleStep: 1e-2, translateStep: 1 })
  if (q.k !== 1.23) throw new Error(`expected k=1.23, got ${q.k}`)
  if (q.x !== 10) throw new Error(`expected x=10, got ${q.x}`)
  if (q.y !== 11) throw new Error(`expected y=11, got ${q.y}`)
}

