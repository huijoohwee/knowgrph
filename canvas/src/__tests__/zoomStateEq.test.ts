import { isSameZoomState } from '@/lib/zoom/zoomStateEq'

export const testZoomStateEqMatchesAllFields = () => {
  const a = { k: 1, x: 2, y: 3, graphDataRevision: 4, viewportW: 800, viewportH: 600 }
  const b = { k: 1, x: 2, y: 3, graphDataRevision: 4, viewportW: 800, viewportH: 600 }
  if (!isSameZoomState(a, b)) throw new Error('expected zoom states to be equal')
  if (isSameZoomState(a, { ...b, k: 2 })) throw new Error('expected k mismatch to be not equal')
  if (isSameZoomState(a, { ...b, x: 1 })) throw new Error('expected x mismatch to be not equal')
  if (isSameZoomState(a, { ...b, y: 1 })) throw new Error('expected y mismatch to be not equal')
  if (isSameZoomState(a, { ...b, graphDataRevision: 5 })) throw new Error('expected graphDataRevision mismatch to be not equal')
  if (isSameZoomState(a, { ...b, viewportW: 801 })) throw new Error('expected viewportW mismatch to be not equal')
  if (isSameZoomState(a, { ...b, viewportH: 601 })) throw new Error('expected viewportH mismatch to be not equal')
}

export const testZoomStateEqRejectsNulls = () => {
  const z = { k: 1, x: 0, y: 0 }
  if (isSameZoomState(null, z)) throw new Error('expected null vs value to be not equal')
  if (isSameZoomState(z, null)) throw new Error('expected value vs null to be not equal')
  if (isSameZoomState(undefined, z)) throw new Error('expected undefined vs value to be not equal')
}

