import { getEffectiveZoomStateForKey } from '@/lib/canvas/zoom-effective'

export function testEffectiveZoomStateForKeyFallsBackToGlobal() {
  const global = { k: 2, x: 10, y: -5 }
  const byKey = { a: { k: 3, x: 1, y: 2 } }

  const v1 = getEffectiveZoomStateForKey({ zoomViewKey: 'a', zoomStateByKey: byKey, zoomState: global })
  if (!v1 || v1.k !== 3) throw new Error('expected keyed zoom state to take precedence')

  const v2 = getEffectiveZoomStateForKey({ zoomViewKey: 'missing', zoomStateByKey: byKey, zoomState: global })
  if (!v2 || v2.k !== 2 || v2.x !== 10 || v2.y !== -5) throw new Error('expected fallback to global zoom state')

  const v3 = getEffectiveZoomStateForKey({ zoomViewKey: null, zoomStateByKey: byKey, zoomState: global })
  if (!v3 || v3.k !== 2) throw new Error('expected fallback to global when key is null')
}

