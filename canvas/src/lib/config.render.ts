export const CANVAS_2D_RENDERERS = ['d3', 'flowchart', 'flow', 'animatic', 'storyboard', 'flowEditor', 'design'] as const

export type Canvas2dRendererId = (typeof CANVAS_2D_RENDERERS)[number]

export const CANVAS_2D_SURFACES = ['d3', 'flow', 'animatic', 'storyboard', 'flowEditor', 'design'] as const

export type Canvas2dSurfaceId = (typeof CANVAS_2D_SURFACES)[number]

export const CANVAS_2D_RENDERER_ORDER: readonly Canvas2dRendererId[] = ['d3', 'flowchart', 'flow', 'animatic', 'storyboard', 'design', 'flowEditor']

type Canvas2dRendererSpec = {
  surfaceId: Canvas2dSurfaceId
  registryLabel: string
  menuLabel: string
  menuDescription: string
  menuBadges: readonly string[]
  aliases: readonly string[]
  sharesFlowEditorFrontmatterSyntax: boolean
}

const CANVAS_2D_RENDERER_SPECS: Record<Canvas2dRendererId, Canvas2dRendererSpec> = {
  d3: {
    surfaceId: 'd3',
    registryLabel: 'D3',
    menuLabel: 'D3',
    menuDescription: 'Node-link graph',
    menuBadges: ['Layout', 'Shape'],
    aliases: ['d3graph'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  flowchart: {
    surfaceId: 'd3',
    registryLabel: 'Flowchart',
    menuLabel: 'Bi',
    menuDescription: 'Bipartite flow',
    menuBadges: ['Block', 'Voxel'],
    aliases: ['d3flowchart'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  flow: {
    surfaceId: 'flow',
    registryLabel: 'Flow Canvas',
    menuLabel: 'Canvas',
    menuDescription: 'Canvas flow',
    menuBadges: ['Overlay', 'Media'],
    aliases: ['flowcanvas'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  animatic: {
    surfaceId: 'animatic',
    registryLabel: 'Animatic',
    menuLabel: 'Animatic',
    menuDescription: 'Timeline beats',
    menuBadges: ['Timing', 'Lanes'],
    aliases: [],
    sharesFlowEditorFrontmatterSyntax: true,
  },
  storyboard: {
    surfaceId: 'storyboard',
    registryLabel: 'Storyboard',
    menuLabel: 'Story',
    menuDescription: 'Storyboard lanes',
    menuBadges: ['Cards', 'Stages'],
    aliases: ['story'],
    sharesFlowEditorFrontmatterSyntax: false,
  },
  flowEditor: {
    surfaceId: 'flowEditor',
    registryLabel: 'Edit',
    menuLabel: 'Edit',
    menuDescription: 'Editable flow',
    menuBadges: ['Widgets', 'Run'],
    aliases: ['edit'],
    sharesFlowEditorFrontmatterSyntax: true,
  },
  design: {
    surfaceId: 'design',
    registryLabel: 'Design',
    menuLabel: 'Design',
    menuDescription: 'DOM wireframe',
    menuBadges: ['Inspect', 'Tokens'],
    aliases: [],
    sharesFlowEditorFrontmatterSyntax: false,
  },
}

const normalizeCanvas2dRendererToken = (value: unknown): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

const CANVAS_2D_RENDERER_ID_BY_ALIAS = (() => {
  const map = new Map<string, Canvas2dRendererId>()
  for (const rendererId of CANVAS_2D_RENDERERS) {
    const spec = CANVAS_2D_RENDERER_SPECS[rendererId]
    map.set(normalizeCanvas2dRendererToken(rendererId), rendererId)
    for (const alias of spec.aliases) {
      map.set(normalizeCanvas2dRendererToken(alias), rendererId)
    }
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
  return CANVAS_2D_RENDERER_ID_BY_ALIAS.get(normalized)
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

export const isFlowchartCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flowchart'
}

export const isFlowCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flow' || id === 'flowEditor'
}

export const isAnimaticCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'animatic'
}

export const isStoryboardCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'storyboard'
}

export const isFlowEditorCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flowEditor'
}

export const isFrontmatterOnlyCanvas2dRenderer = (id: Canvas2dRendererId | null | undefined): boolean => {
  return id === 'flow' || id === 'flowEditor'
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
  return getCanvas2dSurfaceId(id) !== null && !isFlowchartCanvas2dRenderer(id) && !isAnimaticCanvas2dRenderer(id) && !isStoryboardCanvas2dRenderer(id)
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

export const FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID = 'kg-flow-editor-inspector-slot'

export const SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES = 'canvas:groupBoundsOverrides' as const
