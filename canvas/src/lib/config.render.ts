export const CANVAS_2D_RENDERERS = ['d3', 'd3Bipartite', 'flow', 'flowEditor', 'design'] as const

export type Canvas2dRendererId = (typeof CANVAS_2D_RENDERERS)[number]

export const CANVAS_2D_SURFACES = ['d3', 'flow', 'flowEditor', 'design'] as const

export type Canvas2dSurfaceId = (typeof CANVAS_2D_SURFACES)[number]

export const DEFAULT_CANVAS_2D_RENDERER: Canvas2dRendererId = 'flowEditor'

export const isCanvas2dRendererId = (id: unknown): id is Canvas2dRendererId => {
  return typeof id === 'string' && (CANVAS_2D_RENDERERS as readonly string[]).includes(id)
}

export const isD3Like2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'd3' || id === 'd3Bipartite'
}

export const isBipartiteCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'd3Bipartite'
}

export const isFlowCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flow' || id === 'flowEditor'
}

export const isFlowEditorCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flowEditor'
}

export const getCanvas2dSurfaceId = (id: Canvas2dRendererId | null | undefined): Canvas2dSurfaceId | null => {
  if (isD3Like2dRenderer(id)) return 'd3'
  if (id === 'flow') return 'flow'
  if (id === 'flowEditor') return 'flowEditor'
  if (id === 'design') return 'design'
  return null
}

export const supportsCanvas2dMinimap = (id: Canvas2dRendererId | null | undefined): boolean => {
  return getCanvas2dSurfaceId(id) !== null && !isBipartiteCanvas2dRenderer(id)
}

export const CANVAS_3D_MODES = ['3d', 'voxel'] as const

export type Canvas3dModeId = (typeof CANVAS_3D_MODES)[number]

export const DEFAULT_CANVAS_3D_MODE: Canvas3dModeId = '3d'

export const INFINITE_CANVAS_INTERACTION_MODES = ['static', 'interactive'] as const

export type InfiniteCanvasInteractionMode = (typeof INFINITE_CANVAS_INTERACTION_MODES)[number]

export const DEFAULT_INFINITE_CANVAS_INTERACTION_MODE: InfiniteCanvasInteractionMode = 'static'

export const CANVAS_WORKSPACE_SYNC_MODES = ['manual', 'realtime'] as const

export type CanvasWorkspaceSyncMode = (typeof CANVAS_WORKSPACE_SYNC_MODES)[number]

export const DEFAULT_CANVAS_WORKSPACE_SYNC_MODE: CanvasWorkspaceSyncMode = 'manual'

export const FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID = 'kg-flow-editor-inspector-slot'

export const SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES = 'canvas:groupBoundsOverrides' as const
