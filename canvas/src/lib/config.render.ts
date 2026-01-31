export const CANVAS_2D_RENDERERS = ['d3', 'flow'] as const

export type Canvas2dRendererId = (typeof CANVAS_2D_RENDERERS)[number]

export const DEFAULT_CANVAS_2D_RENDERER: Canvas2dRendererId = 'd3'

