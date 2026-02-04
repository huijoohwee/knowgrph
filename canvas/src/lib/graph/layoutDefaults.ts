import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphEdge } from '@/lib/graph/types'

import {
  DEFAULT_FIT_PADDING as SHARED_DEFAULT_FIT_PADDING,
  DEFAULT_FIT_TO_SCREEN_FILL_RATIO as SHARED_DEFAULT_FIT_TO_SCREEN_FILL_RATIO,
  DEFAULT_ZOOM_MAX_SCALE as SHARED_DEFAULT_ZOOM_MAX_SCALE,
  DEFAULT_ZOOM_MAX_SCALE_HARD_CAP as SHARED_DEFAULT_ZOOM_MAX_SCALE_HARD_CAP,
  DEFAULT_ZOOM_MIN_SCALE as SHARED_DEFAULT_ZOOM_MIN_SCALE,
} from 'grph-shared/zoom/presets'

export const DEFAULT_FIT_PADDING = SHARED_DEFAULT_FIT_PADDING
export const DEFAULT_FIT_TO_SCREEN_FILL_RATIO = SHARED_DEFAULT_FIT_TO_SCREEN_FILL_RATIO
export const DEFAULT_ZOOM_MIN_SCALE = SHARED_DEFAULT_ZOOM_MIN_SCALE
export const DEFAULT_ZOOM_MAX_SCALE = SHARED_DEFAULT_ZOOM_MAX_SCALE
export const DEFAULT_ZOOM_MAX_SCALE_HARD_CAP = SHARED_DEFAULT_ZOOM_MAX_SCALE_HARD_CAP
export const DEFAULT_LINK_DISTANCE = 120
export const DEFAULT_CHARGE = -450
export const DEFAULT_CENTER_STRENGTH = 1
export const DEFAULT_ALPHA_DECAY = 0.02

export const DEFAULT_BBOX_COLLIDE_PADDING = 10
export const DEFAULT_BBOX_COLLIDE_STRENGTH = 0.7
export const DEFAULT_BBOX_COLLIDE_ITERATIONS = 2

export const DEFAULT_GROUP_BBOX_COLLIDE_PADDING = DEFAULT_BBOX_COLLIDE_PADDING
export const DEFAULT_GROUP_BBOX_COLLIDE_STRENGTH = DEFAULT_BBOX_COLLIDE_STRENGTH * 0.55
export const DEFAULT_GROUP_BBOX_COLLIDE_ITERATIONS = 3

export const DEFAULT_GROUPS_ENABLED = true
export const DEFAULT_GROUP_SHAPE: NonNullable<NonNullable<GraphSchema['layout']>['groups']>['shape'] = 'rect'
export const DEFAULT_GROUP_PADDING = 24
export const DEFAULT_GROUP_CORNER_RADIUS = 12
export const DEFAULT_GROUP_LABEL_PADDING = 10
export const DEFAULT_GROUP_STROKE_WIDTH = 1.5
export const DEFAULT_GROUP_FILL_OPACITY = 0.08
export const DEFAULT_GROUP_NESTED_PADDING_STEP = 10

export const DEFAULT_NODE_COLLISION_BORDER_GAP_PX = 4
export const DEFAULT_NODE_COLLISION_TOUCH_EPSILON_PX = 1
export const DEFAULT_GROUP_COLLISION_BORDER_GAP_PX = 12
export const DEFAULT_GROUP_COLLISION_TOUCH_EPSILON_PX = 2
export const DEFAULT_COLLISION_BORDER_GAP_PX = DEFAULT_NODE_COLLISION_BORDER_GAP_PX

export const DEFAULT_EDGE_OPACITY_2D = 0.6
export const DEFAULT_EDGE_OPACITY_2D_UNDER_GROUPS = 0.45

export const DEFAULT_STRATIFY_REUSE_SEED_STRENGTH = 0.75
export const DEFAULT_STRATIFY_FIT_FILL_RATIO = 0.8
export const DEFAULT_STRATIFY_SEPARATION = 1

export const DEFAULT_FLOW_NODE_WIDTH_PX = 180
export const DEFAULT_FLOW_NODE_HEIGHT_PX = 48
export const DEFAULT_FLOW_NODE_PADDING_X_PX = 12
export const DEFAULT_FLOW_NODE_PADDING_Y_PX = 8

export const DEFAULT_FLOW_HANDLE_SIZE_PX = 10
export const DEFAULT_FLOW_HANDLE_LINE_HEIGHT_PX = 16

export const DEFAULT_FLOW_ELK_LAYOUT_TIMEOUT_MS = 1500

export const DEFAULT_FLOW_ELK_MAX_NODES = 400
export const DEFAULT_FLOW_DAGRE_MAX_NODES = 250

export type FlowLayoutKnobs = {
  engine: 'auto' | 'elk' | 'dagre' | 'grid'
  node: {
    widthPx: number
    heightPx: number
    paddingX: number
    paddingY: number
  }
  handle: {
    sizePx: number
    lineHeightPx: number
  }
  elk: {
    direction: 'RIGHT' | 'DOWN'
    algorithm: 'layered' | 'force' | 'mrtree' | 'stress'
    layoutTimeoutMs: number
    nodeNodeSpacingPx: number
    layerSpacingPx: number
    edgeNodeSpacingPx: number
  }
}

const clampInt = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.max(min, Math.min(max, Math.floor(v)))
}

export const readFlowLayoutKnobs = (args: {
  schema: GraphSchema | null
  rankdir: 'TB' | 'LR'
}): FlowLayoutKnobs => {
  const padding = args.schema ? readFitPadding(args.schema) : DEFAULT_FIT_PADDING

  const engineRaw = args.schema?.layout?.flow?.engine
  const engine: FlowLayoutKnobs['engine'] =
    engineRaw === 'elk' || engineRaw === 'dagre' || engineRaw === 'grid' ? engineRaw : 'auto'

  const elkLayoutRaw = args.schema?.layout?.flow?.elkLayout
  const algorithm: FlowLayoutKnobs['elk']['algorithm'] = (() => {
    if (elkLayoutRaw === 'elk.force') return 'force'
    if (elkLayoutRaw === 'elk.mrtree') return 'mrtree'
    if (elkLayoutRaw === 'elk.stress') return 'stress'
    return 'layered'
  })()

  const node = {
    widthPx: DEFAULT_FLOW_NODE_WIDTH_PX,
    heightPx: DEFAULT_FLOW_NODE_HEIGHT_PX,
    paddingX: DEFAULT_FLOW_NODE_PADDING_X_PX,
    paddingY: DEFAULT_FLOW_NODE_PADDING_Y_PX,
  }

  const handle = {
    sizePx: DEFAULT_FLOW_HANDLE_SIZE_PX,
    lineHeightPx: DEFAULT_FLOW_HANDLE_LINE_HEIGHT_PX,
  }

  const elkDirection = args.rankdir === 'LR' ? 'RIGHT' : 'DOWN'
  const elkNodeNodeSpacing = 40 + Math.floor(padding / 2)
  const elkLayerSpacing = 80 + padding
  const elkEdgeNodeSpacing = 24 + Math.floor(padding / 3)

  const scaled = {
    engine,
    node: {
      ...node,
      widthPx: Math.max(24, node.widthPx),
      heightPx: Math.max(16, node.heightPx),
      paddingX: Math.max(0, node.paddingX),
      paddingY: Math.max(0, node.paddingY),
    },
    handle: {
      ...handle,
      sizePx: Math.max(4, handle.sizePx),
      lineHeightPx: Math.max(8, handle.lineHeightPx),
    },
    elk: {
      direction: elkDirection,
      algorithm,
      layoutTimeoutMs: Math.max(200, clampInt(DEFAULT_FLOW_ELK_LAYOUT_TIMEOUT_MS, 200, 20_000) ?? 1500),
      nodeNodeSpacingPx: Math.max(24, elkNodeNodeSpacing),
      layerSpacingPx: Math.max(48, elkLayerSpacing),
      edgeNodeSpacingPx: Math.max(16, elkEdgeNodeSpacing),
    },
  } satisfies FlowLayoutKnobs

  return scaled
}

export const readForceLinkDistance = (schema: GraphSchema, edge: Pick<GraphEdge, 'label'>): number => {
  const byLabel = schema.layout?.forces?.linkDistanceByLabel || null
  const label = typeof edge.label === 'string' ? edge.label : String(edge.label || '')
  const v = byLabel && label ? (byLabel as Record<string, unknown>)[label] : null
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : DEFAULT_LINK_DISTANCE
}

export const readForceCharge = (schema: GraphSchema): number => {
  const v = schema.layout?.forces?.charge
  return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_CHARGE
}

export const readFitPadding = (schema: GraphSchema): number => {
  const padding = schema.layout?.fitPadding
  return typeof padding === 'number' && Number.isFinite(padding)
    ? Math.max(20, Math.min(160, Math.floor(padding)))
    : DEFAULT_FIT_PADDING
}

export const readEdgeOpacity2d = (schema: GraphSchema): number => {
  const cfg = schema.layout?.edges || null
  const baseRaw = cfg && typeof (cfg as { opacity?: unknown }).opacity === 'number' ? (cfg as { opacity: number }).opacity : null
  const underRaw = cfg && typeof (cfg as { opacityUnderGroups?: unknown }).opacityUnderGroups === 'number'
    ? (cfg as { opacityUnderGroups: number }).opacityUnderGroups
    : null
  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
  const base = typeof baseRaw === 'number' && Number.isFinite(baseRaw) ? clamp01(baseRaw) : DEFAULT_EDGE_OPACITY_2D
  const under = typeof underRaw === 'number' && Number.isFinite(underRaw) ? clamp01(underRaw) : DEFAULT_EDGE_OPACITY_2D_UNDER_GROUPS
  const groupsEnabled = schema.layout?.groups?.enabled !== false
  return groupsEnabled ? Math.min(base, under) : base
}

export const readZoomScaleExtent = (schema: GraphSchema): [number, number] => {
  const rawMin = schema.performance?.zoom?.minScale
  const rawMax = schema.performance?.zoom?.maxScale
  const min = typeof rawMin === 'number' && Number.isFinite(rawMin) && rawMin > 0 ? rawMin : DEFAULT_ZOOM_MIN_SCALE
  const max = typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax > 0 ? rawMax : DEFAULT_ZOOM_MAX_SCALE
  if (min <= max) return [min, max]
  return [max, min]
}
