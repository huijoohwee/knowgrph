import type { Canvas2dRendererId } from '@/lib/config'

export const CANVAS_2D_RENDERER_ORDER: Canvas2dRendererId[] = ['d3', 'd3Bipartite', 'flow', 'design', 'flowEditor']

export function getNextCanvas2dRendererId(current: Canvas2dRendererId): Canvas2dRendererId {
  const idx = CANVAS_2D_RENDERER_ORDER.indexOf(current)
  if (idx < 0) return CANVAS_2D_RENDERER_ORDER[0]
  return CANVAS_2D_RENDERER_ORDER[(idx + 1) % CANVAS_2D_RENDERER_ORDER.length]
}

export function getCanvas2dRendererLabel(id: Canvas2dRendererId): string {
  if (id === 'd3Bipartite') return 'Bipartite'
  if (id === 'flowEditor') return 'Edit'
  if (id === 'flow') return 'Flow'
  if (id === 'design') return 'Design'
  return 'D3'
}
