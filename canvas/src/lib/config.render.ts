export const CANVAS_2D_RENDERERS = ['d3', 'dashboard', 'gallery', 'flowchart', 'gitGraph', 'gantt', 'flow', 'animatic', 'storyboard', 'strybldr', 'flowEditor', 'design'] as const

export type Canvas2dRendererId = (typeof CANVAS_2D_RENDERERS)[number]

export const CANVAS_2D_SURFACES = ['d3', 'dashboard', 'gallery', 'gitGraph', 'gantt', 'flow', 'storyboard', 'flowEditor', 'design'] as const

export type Canvas2dSurfaceId = (typeof CANVAS_2D_SURFACES)[number]

export const CANVAS_2D_RENDERER_ORDER: readonly Canvas2dRendererId[] = ['d3', 'dashboard', 'gallery', 'flowchart', 'gitGraph', 'gantt', 'flow', 'storyboard', 'strybldr', 'design', 'flowEditor']

type Canvas2dRendererSpec = {
  surfaceId: Canvas2dSurfaceId
  registryLabel: string
  menuLabel: string
  menuDescription: string
  menuBadges: readonly string[]
  sharesFlowEditorFrontmatterSyntax: boolean
}

const CANVAS_2D_RENDERER_SPECS: Record<Canvas2dRendererId, Canvas2dRendererSpec> = {
  d3: {
    surfaceId: 'd3',
    registryLabel: 'D3',
    menuLabel: 'D3',
    menuDescription: 'Node-link graph',
    menuBadges: ['Layout', 'Shape'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  dashboard: {
    surfaceId: 'dashboard',
    registryLabel: 'Dashboard',
    menuLabel: 'Dash',
    menuDescription: 'Graph dashboard',
    menuBadges: ['D3', 'Grid'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  gallery: {
    surfaceId: 'gallery',
    registryLabel: 'Gallery',
    menuLabel: 'Gallery',
    menuDescription: 'Markdown gallery',
    menuBadges: ['Slides', 'Grid'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  flowchart: {
    surfaceId: 'd3',
    registryLabel: 'Flowchart',
    menuLabel: 'Bi',
    menuDescription: 'Bipartite flow',
    menuBadges: ['Block', 'Voxel'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  gitGraph: {
    surfaceId: 'gitGraph',
    registryLabel: 'GitGraph',
    menuLabel: 'Git',
    menuDescription: 'Mermaid GitGraph',
    menuBadges: ['Mermaid', 'History'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  gantt: {
    surfaceId: 'gantt',
    registryLabel: 'Gantt-timeline',
    menuLabel: 'Gantt',
    menuDescription: 'Mermaid Gantt timeline',
    menuBadges: ['Mermaid', 'Timeline'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  flow: {
    surfaceId: 'flow',
    registryLabel: 'Flow Canvas',
    menuLabel: 'Canvas',
    menuDescription: 'Canvas flow',
    menuBadges: ['Overlay', 'Media'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  animatic: {
    surfaceId: 'gantt',
    registryLabel: 'Gantt-timeline',
    menuLabel: 'Gantt',
    menuDescription: 'Mermaid Gantt timeline',
    menuBadges: ['Mermaid', 'Timeline'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  storyboard: {
    surfaceId: 'storyboard',
    registryLabel: 'Storyboard',
    menuLabel: 'Story',
    menuDescription: 'Storyboard lanes',
    menuBadges: ['Cards', 'Stages'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  strybldr: {
    surfaceId: 'storyboard',
    registryLabel: 'Strybldr',
    menuLabel: 'Strybldr',
    menuDescription: 'Image to storyboard',
    menuBadges: ['Image', 'Elements'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  flowEditor: {
    surfaceId: 'flowEditor',
    registryLabel: 'Edit',
    menuLabel: 'Edit',
    menuDescription: 'Editable flow',
    menuBadges: ['Widgets', 'Run'],
    sharesFlowEditorFrontmatterSyntax: true,
  },
  design: {
    surfaceId: 'design',
    registryLabel: 'Design',
    menuLabel: 'Design',
    menuDescription: 'DOM wireframe',
    menuBadges: ['Inspect', 'Tokens'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
}

const normalizeCanvas2dRendererToken = (value: unknown): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

const CANVAS_2D_RENDERER_ID_BY_NORMALIZED_TOKEN = (() => {
  const map = new Map<string, Canvas2dRendererId>()
  for (const rendererId of CANVAS_2D_RENDERERS) {
    map.set(normalizeCanvas2dRendererToken(rendererId), rendererId)
  }
  return map
})()

export const DEFAULT_CANVAS_2D_RENDERER: Canvas2dRendererId = 'flowEditor'

export const isCanvas2dRendererId = (id: unknown): id is Canvas2dRendererId => {
  return typeof id === 'string' && (CANVAS_2D_RENDERERS as readonly string[]).includes(id)
}

export const resolveCanvas2dRendererId = (value: unknown): Canvas2dRendererId | undefined => {
  if (isCanvas2dRendererId(value)) return value
  const normalized = normalizeCanvas2dRendererToken(value)
  if (!normalized) return undefined
  return CANVAS_2D_RENDERER_ID_BY_NORMALIZED_TOKEN.get(normalized)
}

export const getCanvas2dRendererLabel = (id: Canvas2dRendererId): string => {
  return CANVAS_2D_RENDERER_SPECS[id].registryLabel
}

export const getCanvas2dRendererMenuLabel = (id: Canvas2dRendererId): string => {
  return CANVAS_2D_RENDERER_SPECS[id].menuLabel
}

export const getCanvas2dRendererMenuDescription = (id: Canvas2dRendererId): string => {
  return CANVAS_2D_RENDERER_SPECS[id].menuDescription
}

export const getCanvas2dRendererMenuBadges = (id: Canvas2dRendererId): readonly string[] => {
  return CANVAS_2D_RENDERER_SPECS[id].menuBadges
}

export const sharesFlowEditorFrontmatterSyntax = (id: Canvas2dRendererId | null | undefined): boolean => {
  return !!id && CANVAS_2D_RENDERER_SPECS[id].sharesFlowEditorFrontmatterSyntax
}

export const isD3Like2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'd3' || id === 'flowchart'
}

export const TABLE_GRAPH_CANVAS_2D_RENDERER: Canvas2dRendererId = 'd3'

export const isTableGraphCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return isD3Like2dRenderer(id)
}

export const resolveTableGraphCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): Canvas2dRendererId => {
  return isTableGraphCanvas2dRenderer(id) ? id : TABLE_GRAPH_CANVAS_2D_RENDERER
}

export const isFlowchartCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flowchart'
}

export const isGitGraphCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'gitGraph'
}

export const isGanttCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'gantt'
}

export const isDashboardCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'dashboard'
}

export const isGalleryCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'gallery'
}

export const isFlowCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flow' || id === 'flowEditor'
}

export const isAnimaticCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'animatic'
}

export const isStoryboardCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'storyboard' || id === 'strybldr'
}

export const supportsToolbarRunAll = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flowEditor' || id === 'strybldr'
}

export type ToolbarRunAllFloatingPanelTab = 'flowEditor' | 'strybldr'

export const getToolbarRunAllFloatingPanelTab = (id: Canvas2dRendererId | null | undefined): ToolbarRunAllFloatingPanelTab | null => {
  if (id === 'flowEditor') return 'flowEditor'
  return id === 'strybldr' ? 'strybldr' : null
}

export const isFlowEditorCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flowEditor'
}

export const isFrontmatterOnlyCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flow'
}

export const isFrontmatterOnlyPolicyActive = (args: {
  canvasRenderMode: unknown
  canvas2dRenderer: Canvas2dRendererId | null | undefined
}): boolean => {
  return String(args.canvasRenderMode || '') === '2d' && isFrontmatterOnlyCanvas2dRenderer(args.canvas2dRenderer)
}

export const getCanvas2dSurfaceId = (id: Canvas2dRendererId | null | undefined): Canvas2dSurfaceId | null => {
  return id ? CANVAS_2D_RENDERER_SPECS[id].surfaceId : null
}

export const supportsCanvas2dMinimap = (id: Canvas2dRendererId | null | undefined): boolean => {
  return getCanvas2dSurfaceId(id) !== null && !isDashboardCanvas2dRenderer(id) && !isGalleryCanvas2dRenderer(id) && !isFlowchartCanvas2dRenderer(id) && !isGitGraphCanvas2dRenderer(id) && !isGanttCanvas2dRenderer(id) && !isAnimaticCanvas2dRenderer(id) && !isStoryboardCanvas2dRenderer(id)
}

export const CANVAS_3D_MODES = ['3d', 'xr', 'voxel'] as const

export type Canvas3dModeId = (typeof CANVAS_3D_MODES)[number]

export const DEFAULT_CANVAS_3D_MODE: Canvas3dModeId = '3d'

export const INFINITE_CANVAS_INTERACTION_MODES = ['static', 'interactive'] as const

export type InfiniteCanvasInteractionMode = (typeof INFINITE_CANVAS_INTERACTION_MODES)[number]

export const DEFAULT_INFINITE_CANVAS_INTERACTION_MODE: InfiniteCanvasInteractionMode = 'interactive'

export const CANVAS_WORKSPACE_SYNC_MODES = ['manual', 'realtime'] as const

export type CanvasWorkspaceSyncMode = (typeof CANVAS_WORKSPACE_SYNC_MODES)[number]

export const DEFAULT_CANVAS_WORKSPACE_SYNC_MODE: CanvasWorkspaceSyncMode = 'manual'

export const CANVAS_RUN_MODES = ['manual', 'auto'] as const

export type CanvasRunMode = (typeof CANVAS_RUN_MODES)[number]

export const DEFAULT_CANVAS_RUN_MODE: CanvasRunMode = 'manual'

export const FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID = 'kg-flow-editor-inspector-slot'

export const SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES = 'canvas:groupBoundsOverrides' as const
