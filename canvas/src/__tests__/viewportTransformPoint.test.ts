import * as d3 from 'd3'

import { invertZoomPoint } from '@/lib/canvas/viewport-transform'
import { readElementLocalPoint } from '@/lib/canvas/canvas-event-coords'

export function testViewportTransformInvertZoomPointMatchesD3Invert() {
  const t = d3.zoomIdentity.translate(10, 20).scale(2)
  const a = invertZoomPoint(t, { sx: 14, sy: 24 })
  if (!(Math.abs(a.x - 2) < 1e-9)) throw new Error(`expected x≈2; got ${a.x}`)
  if (!(Math.abs(a.y - 2) < 1e-9)) throw new Error(`expected y≈2; got ${a.y}`)
}

export function testCanvasEventCoordsReadElementLocalPointUsesBoundingRect() {
  const el = {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }),
  } as unknown as Element

  const p = readElementLocalPoint({ el, event: { clientX: 15, clientY: 25 } })
  if (!p) throw new Error('expected point')
  if (p.sx !== 5 || p.sy !== 5) throw new Error(`expected (5,5); got (${p.sx},${p.sy})`)
  if (p.inBounds !== true) throw new Error('expected inBounds=true')

  const out = readElementLocalPoint({ el, event: { clientX: 999, clientY: 999 } })
  if (!out) throw new Error('expected point')
  if (out.inBounds !== false) throw new Error('expected inBounds=false for out-of-bounds')
}

