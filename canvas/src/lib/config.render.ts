export const CANVAS_2D_RENDERERS = ['d3', 'flow', 'flowEditor'] as const

export type Canvas2dRendererId = (typeof CANVAS_2D_RENDERERS)[number]

export const DEFAULT_CANVAS_2D_RENDERER: Canvas2dRendererId = 'd3'

export const FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID = 'kg-flow-editor-inspector-slot'
