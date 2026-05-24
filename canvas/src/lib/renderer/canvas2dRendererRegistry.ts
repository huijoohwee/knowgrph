import { CANVAS_2D_RENDERER_ORDER, type Canvas2dRendererId } from '@/lib/config'

export { CANVAS_2D_RENDERER_ORDER, getCanvas2dRendererLabel } from '@/lib/config'

export function getNextCanvas2dRendererId(current: Canvas2dRendererId): Canvas2dRendererId {
  const idx = CANVAS_2D_RENDERER_ORDER.indexOf(current)
  if (idx < 0) return CANVAS_2D_RENDERER_ORDER[0]
  return CANVAS_2D_RENDERER_ORDER[(idx + 1) % CANVAS_2D_RENDERER_ORDER.length]
}
